import { Request, Response } from 'express';
import crypto from 'crypto';
import { Booking } from '../models/Booking.model';
import { Payment } from '../models/Payment.model';
import { Notification } from '../models/Notification.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { generateInvoiceNumber } from '../utils/referenceGenerator';
import { createGatewayOrder, verifyPaymentHmacSignature, computeExpectedPaymentSignature } from '../services/payment.service';
import { releaseAtomicInventoryLock } from '../services/inventory.service';
import { sendTransactionalEmail } from '../services/email.service';
import { recordAuditLog } from '../services/audit.service';
import { env } from '../config/env';

export const createPaymentOrder = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.body;
  if (!bookingId) throw new ApiError(400, 'bookingId is required.', 'MISSING_BOOKING_ID');
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  if (String(booking.guest) !== String(req.user!._id)) throw new ApiError(403, 'Forbidden ownership.', 'FORBIDDEN_OWNERSHIP');
  if (booking.paymentStatus === 'paid' || booking.status === 'confirmed') throw new ApiError(409, 'Already paid.', 'ALREADY_PAID');

  let payment = await Payment.findOne({ booking: booking._id, verificationStatus: 'pending' });
  if (!payment) {
    const gatewayOrder = await createGatewayOrder({ amountInRupees: booking.pricing.totalAmount, currency: booking.pricing.currency || 'INR', receipt: booking.bookingReference });
    payment = await Payment.create({
      booking: booking._id,
      guest: booking.guest,
      hotel: booking.hotel,
      invoiceNumber: generateInvoiceNumber(),
      amount: booking.pricing.totalAmount,
      currency: gatewayOrder.currency,
      provider: gatewayOrder.provider,
      providerOrderId: gatewayOrder.orderId,
      verificationStatus: 'pending'
    });
  }

  const sandboxTestPaymentId = `pay_sandbox_${crypto.randomBytes(5).toString('hex')}`;
  const sandboxTestSignature = payment.provider === 'razorpay_sandbox' ? computeExpectedPaymentSignature(payment.providerOrderId, sandboxTestPaymentId) : undefined;

  res.status(200).json({
    success: true,
    order: {
      paymentRecordId: payment._id,
      bookingId: booking._id,
      bookingReference: booking.bookingReference,
      orderId: payment.providerOrderId,
      amount: payment.amount,
      amountPaise: Math.round(payment.amount * 100),
      currency: payment.currency,
      provider: payment.provider,
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_hotelpro_sandbox',
      isSandboxMode: payment.provider === 'razorpay_sandbox',
      ...(payment.provider === 'razorpay_sandbox' ? { sandboxHelper: { samplePaymentId: sandboxTestPaymentId, sampleValidSignature: sandboxTestSignature } } : {})
    }
  });
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');

  const payment = await Payment.findOne({ booking: booking._id, providerOrderId: razorpay_order_id });
  if (!payment) throw new ApiError(404, 'Order not found.', 'ORDER_NOT_FOUND');

  if (payment.verificationStatus === 'verified' && booking.paymentStatus === 'paid') {
    res.status(200).json({ success: true, idempotentReplay: true, message: 'Payment already verified.', booking, payment });
    return;
  }

  if (amount !== undefined && Number(amount) !== booking.pricing.totalAmount) {
    throw new ApiError(400, 'Payment amount mismatch.', 'AMOUNT_MISMATCH');
  }

  if (!verifyPaymentHmacSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    payment.verificationStatus = 'failed';
    await payment.save();
    throw new ApiError(400, 'Payment signature verification failed.', 'INVALID_PAYMENT_SIGNATURE');
  }

  payment.providerPaymentId = razorpay_payment_id;
  payment.providerSignature = razorpay_signature;
  payment.verificationStatus = 'verified';
  await payment.save();

  booking.status = 'confirmed';
  booking.paymentStatus = 'paid';
  booking.holdExpiresAt = undefined;
  await booking.save();

  await Notification.create({
    recipient: booking.guest,
    type: 'booking_confirmed',
    title: `Booking Confirmed — ${booking.bookingReference}`,
    message: `Payment verified. Invoice ${payment.invoiceNumber} issued.`,
    relatedBooking: booking._id
  });

  await sendTransactionalEmail({
    to: booking.guestDetails.email,
    subject: `HotelPro — Reservation Confirmed (${booking.bookingReference})`,
    html: `<p>Your reservation ${booking.bookingReference} is confirmed.</p>`
  });

  res.status(200).json({ success: true, message: 'Payment verified and reservation confirmed.', booking, payment });
});

export const handlePaymentFailure = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  if (booking.status === 'pending_payment') {
    if (booking.inventoryLocked) {
      await releaseAtomicInventoryLock({ roomTypeId: booking.roomType, checkInDate: booking.checkInDate, checkOutDate: booking.checkOutDate, roomQuantity: booking.roomQuantity });
      booking.inventoryLocked = false;
    }
    booking.status = 'payment_failed';
    booking.paymentStatus = 'failed';
    await booking.save();
  }
  res.status(200).json({ success: true, booking });
});

export const processRefund = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  if (booking.paymentStatus !== 'refund_pending') throw new ApiError(400, 'No pending refund.', 'NO_PENDING_REFUND');
  const payment = await Payment.findOne({ booking: booking._id });
  if (!payment) throw new ApiError(404, 'Payment not found.', 'PAYMENT_NOT_FOUND');

  payment.refund.refundId = `rfnd_${crypto.randomBytes(5).toString('hex')}`;
  payment.refund.status = 'processed';
  payment.refund.processedAt = new Date();
  await payment.save();

  booking.paymentStatus = payment.refund.amount < payment.amount ? 'partially_refunded' : 'refunded';
  await booking.save();
  await recordAuditLog({ actorId: req.user!._id, actorRole: req.user!.role, action: 'REFUND_PROCESSED', affectedResource: 'Payment', resourceId: String(payment._id), ipAddress: req.ip });
  res.status(200).json({ success: true, booking, payment });
});

import { Request, Response } from 'express';
import { Booking } from '../models/Booking.model';
import { Hotel } from '../models/Hotel.model';
import { RoomType } from '../models/RoomType.model';
import { Payment } from '../models/Payment.model';
import { Notification } from '../models/Notification.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { generateBookingReference } from '../utils/referenceGenerator';
import { acquireAtomicInventoryLock, releaseAtomicInventoryLock } from '../services/inventory.service';
import { verifyHotelScope } from '../middleware/auth.middleware';
import { sendTransactionalEmail } from '../services/email.service';
import { recordAuditLog } from '../services/audit.service';

export const createBooking = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { hotelId, roomTypeId, checkInDate, checkOutDate, roomQuantity, guestsCount, guestDetails } = req.body;

  const roomType = await RoomType.findById(roomTypeId);
  if (!roomType || String(roomType.hotel) !== String(hotelId)) {
    throw new ApiError(400, 'Selected room category does not belong to the specified hotel.', 'INVALID_ROOM_HOTEL');
  }
  if (guestsCount.adults > roomType.maxOccupancy.adults * roomQuantity) {
    throw new ApiError(400, 'Guest count exceeds room category capacity.', 'CAPACITY_EXCEEDED');
  }

  const quote = await acquireAtomicInventoryLock({ roomTypeId, checkInDate, checkOutDate, roomQuantity });
  const bookingReference = generateBookingReference();

  const booking = await Booking.create({
    bookingReference,
    guest: user._id,
    guestDetails,
    hotel: hotelId,
    roomType: roomTypeId,
    checkInDate,
    checkOutDate,
    nights: quote.nights,
    guestsCount,
    roomQuantity,
    pricing: {
      nightlyRates: quote.nightlyRates,
      baseAmount: quote.baseAmount,
      taxesAndFees: quote.taxesAndFees,
      discountAmount: 0,
      additionalCharges: 0,
      totalAmount: quote.totalAmount,
      currency: quote.currency
    },
    status: 'pending_payment',
    paymentStatus: 'unpaid',
    inventoryLocked: true,
    holdExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    statusHistory: [{ status: 'pending_payment', changedAt: new Date(), changedBy: user._id, note: '15-minute inventory hold created.' }]
  });

  res.status(201).json({ success: true, message: 'Reservation hold created.', booking });
});

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const bookings = await Booking.find({ guest: req.user!._id })
    .populate('hotel', 'name city state address images policies contact')
    .populate('roomType', 'name code bedConfiguration images')
    .sort({ createdAt: -1 })
    .lean();
  res.status(200).json({ success: true, data: bookings });
});

export const getBookingById = asyncHandler(async (req: Request, res: Response) => {
  const booking = await Booking.findById(req.params.id)
    .populate('hotel', 'name city state address images policies contact')
    .populate('roomType', 'name code bedConfiguration images amenities')
    .populate('guest', 'name email phone');

  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');

  const user = req.user!;
  const isOwner = String(booking.guest._id || booking.guest) === String(user._id);
  if (!isOwner) {
    if (user.role === 'guest') throw new ApiError(403, 'Forbidden ownership.', 'FORBIDDEN_OWNERSHIP');
    const hotelId = String((booking.hotel as { _id?: unknown })._id || booking.hotel);
    if (!(await verifyHotelScope(user, hotelId))) throw new ApiError(403, 'Forbidden hotel scope.', 'FORBIDDEN_HOTEL_SCOPE');
  }

  const payment = await Payment.findOne({ booking: booking._id }).lean();
  res.status(200).json({ success: true, booking, payment });
});

export const modifyBooking = asyncHandler(async (req: Request, res: Response) => {
  const { specialRequests, guestDetails } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  if (String(booking.guest) !== String(req.user!._id) && req.user!.role === 'guest') {
    throw new ApiError(403, 'Forbidden ownership.', 'FORBIDDEN_OWNERSHIP');
  }
  if (!['pending_payment', 'confirmed'].includes(booking.status)) {
    throw new ApiError(400, 'Cannot modify booking in current state.', 'INVALID_STATE_TRANSITION');
  }
  if (specialRequests !== undefined) booking.guestDetails.specialRequests = specialRequests;
  if (guestDetails?.fullName) booking.guestDetails.fullName = guestDetails.fullName;
  if (guestDetails?.phone) booking.guestDetails.phone = guestDetails.phone;
  await booking.save();
  res.status(200).json({ success: true, message: 'Reservation updated.', booking });
});

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  const { reason = 'Guest requested cancellation' } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');

  const user = req.user!;
  if (String(booking.guest) !== String(user._id)) {
    if (user.role === 'guest') throw new ApiError(403, 'Forbidden ownership.', 'FORBIDDEN_OWNERSHIP');
    if (!(await verifyHotelScope(user, String(booking.hotel)))) throw new ApiError(403, 'Forbidden hotel scope.', 'FORBIDDEN_HOTEL_SCOPE');
  }

  if (['checked_in', 'checked_out', 'cancelled'].includes(booking.status)) {
    throw new ApiError(400, 'Booking cannot be cancelled in current state.', 'INVALID_CANCELLATION_STATE');
  }

  const hotel = await Hotel.findById(booking.hotel);
  const windowHours = hotel?.policies?.cancellationWindowHours ?? 48;
  const penaltyPercent = hotel?.policies?.cancellationPenaltyPercent ?? 50;
  const checkInTimestamp = new Date(`${booking.checkInDate}T14:00:00.000Z`).getTime();
  const hoursUntilCheckIn = (checkInTimestamp - Date.now()) / (1000 * 60 * 60);

  let eligibleRefundAmount = 0;
  if (booking.paymentStatus === 'paid') {
    if (hoursUntilCheckIn >= windowHours) eligibleRefundAmount = booking.pricing.totalAmount;
    else if (hoursUntilCheckIn > 0) eligibleRefundAmount = Math.round(booking.pricing.totalAmount * ((100 - penaltyPercent) / 100));
  }

  if (booking.inventoryLocked) {
    await releaseAtomicInventoryLock({
      roomTypeId: booking.roomType,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      roomQuantity: booking.roomQuantity
    });
    booking.inventoryLocked = false;
  }

  booking.status = 'cancelled';
  if (booking.paymentStatus === 'paid' && eligibleRefundAmount > 0) {
    booking.paymentStatus = 'refund_pending';
    await Payment.findOneAndUpdate({ booking: booking._id }, { $set: { 'refund.amount': eligibleRefundAmount, 'refund.status': 'pending' } });
  }

  booking.cancellation = {
    requestedAt: new Date(),
    cancelledAt: new Date(),
    reason,
    eligibleRefundAmount,
    refundStatus: booking.paymentStatus === 'refund_pending' ? 'pending' : 'none'
  };
  await booking.save();

  await sendTransactionalEmail({
    to: booking.guestDetails.email,
    subject: `HotelPro — Booking ${booking.bookingReference} Cancelled`,
    html: `<p>Your reservation ${booking.bookingReference} has been cancelled.</p>`
  });
  await recordAuditLog({ actorId: user._id, actorRole: user.role, action: 'BOOKING_CANCELLED', affectedResource: 'Booking', resourceId: String(booking._id), metadata: { eligibleRefundAmount }, ipAddress: req.ip });

  res.status(200).json({ success: true, message: 'Booking cancelled and inventory released.', booking });
});

import mongoose, { Schema, Document } from 'mongoose';

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancellation_requested'
  | 'cancelled'
  | 'payment_failed';

export type PaymentStatus =
  | 'unpaid'
  | 'paid'
  | 'refund_pending'
  | 'partially_refunded'
  | 'refunded'
  | 'failed';

export interface IBooking extends Document {
  bookingReference: string;
  guest: mongoose.Types.ObjectId;
  guestDetails: {
    fullName: string;
    email: string;
    phone: string;
    specialRequests?: string;
  };
  hotel: mongoose.Types.ObjectId;
  roomType: mongoose.Types.ObjectId;
  assignedRooms: string[];
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  guestsCount: {
    adults: number;
    children: number;
  };
  roomQuantity: number;
  pricing: {
    nightlyRates: Array<{ date: string; ratePerRoom: number }>;
    baseAmount: number;
    taxesAndFees: number;
    discountAmount: number;
    additionalCharges: number;
    totalAmount: number;
    currency: string;
  };
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  inventoryLocked: boolean;
  holdExpiresAt?: Date;
  checkInRecord?: {
    checkedInAt?: Date;
    checkedInBy?: mongoose.Types.ObjectId;
    idProofVerified?: boolean;
  };
  checkOutRecord?: {
    checkedOutAt?: Date;
    checkedOutBy?: mongoose.Types.ObjectId;
    additionalCharges?: number;
    notes?: string;
  };
  cancellation?: {
    requestedAt?: Date;
    cancelledAt?: Date;
    reason?: string;
    eligibleRefundAmount?: number;
    refundStatus?: 'none' | 'pending' | 'approved' | 'rejected' | 'processed';
  };
  statusHistory: Array<{
    status: BookingStatus;
    changedAt: Date;
    changedBy?: mongoose.Types.ObjectId;
    note?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    bookingReference: { type: String, required: true, unique: true, index: true },
    guest: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    guestDetails: {
      fullName: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
      specialRequests: { type: String, default: '' }
    },
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomType: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    assignedRooms: [{ type: String }],
    checkInDate: { type: String, required: true, index: true },
    checkOutDate: { type: String, required: true, index: true },
    nights: { type: Number, required: true, min: 1 },
    guestsCount: {
      adults: { type: Number, required: true, min: 1 },
      children: { type: Number, default: 0, min: 0 }
    },
    roomQuantity: { type: Number, required: true, min: 1, max: 10 },
    pricing: {
      nightlyRates: [
        {
          date: { type: String, required: true },
          ratePerRoom: { type: Number, required: true }
        }
      ],
      baseAmount: { type: Number, required: true },
      taxesAndFees: { type: Number, required: true },
      discountAmount: { type: Number, default: 0 },
      additionalCharges: { type: Number, default: 0 },
      totalAmount: { type: Number, required: true },
      currency: { type: String, default: 'INR' }
    },
    status: {
      type: String,
      enum: [
        'pending_payment',
        'confirmed',
        'checked_in',
        'checked_out',
        'cancellation_requested',
        'cancelled',
        'payment_failed'
      ],
      default: 'pending_payment',
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'refund_pending', 'partially_refunded', 'refunded', 'failed'],
      default: 'unpaid',
      index: true
    },
    inventoryLocked: { type: Boolean, default: true },
    holdExpiresAt: { type: Date },
    checkInRecord: {
      checkedInAt: { type: Date },
      checkedInBy: { type: Schema.Types.ObjectId, ref: 'User' },
      idProofVerified: { type: Boolean, default: false }
    },
    checkOutRecord: {
      checkedOutAt: { type: Date },
      checkedOutBy: { type: Schema.Types.ObjectId, ref: 'User' },
      additionalCharges: { type: Number, default: 0 },
      notes: { type: String, default: '' }
    },
    cancellation: {
      requestedAt: { type: Date },
      cancelledAt: { type: Date },
      reason: { type: String },
      eligibleRefundAmount: { type: Number, default: 0 },
      refundStatus: {
        type: String,
        enum: ['none', 'pending', 'approved', 'rejected', 'processed'],
        default: 'none'
      }
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        note: { type: String }
      }
    ]
  },
  { timestamps: true }
);

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema);

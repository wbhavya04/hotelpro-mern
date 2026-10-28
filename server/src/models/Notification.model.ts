import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  type: 'booking_confirmed' | 'booking_cancelled' | 'payment_verified' | 'check_in' | 'check_out' | 'service_request' | 'system';
  title: string;
  message: string;
  relatedBooking?: mongoose.Types.ObjectId;
  link?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['booking_confirmed', 'booking_cancelled', 'payment_verified', 'check_in', 'check_out', 'service_request', 'system'],
      default: 'system'
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    relatedBooking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    link: { type: String, default: '/dashboard/bookings' },
    isRead: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  booking: mongoose.Types.ObjectId;
  guest: mongoose.Types.ObjectId;
  hotel: mongoose.Types.ObjectId;
  invoiceNumber: string;
  amount: number;
  currency: string;
  provider: 'razorpay' | 'razorpay_sandbox';
  providerOrderId: string;
  providerPaymentId?: string;
  providerSignature?: string;
  verificationStatus: 'pending' | 'verified' | 'failed';
  refund: {
    refundId?: string;
    amount: number;
    status: 'none' | 'pending' | 'processed' | 'failed';
    processedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    guest: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    invoiceNumber: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    provider: { type: String, enum: ['razorpay', 'razorpay_sandbox'], required: true },
    providerOrderId: { type: String, required: true, unique: true, index: true },
    providerPaymentId: { type: String, sparse: true, index: true },
    providerSignature: { type: String, select: false },
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending',
      index: true
    },
    refund: {
      refundId: { type: String },
      amount: { type: Number, default: 0 },
      status: { type: String, enum: ['none', 'pending', 'processed', 'failed'], default: 'none' },
      processedAt: { type: Date }
    }
  },
  { timestamps: true }
);

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

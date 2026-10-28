import mongoose, { Schema, Document } from 'mongoose';

export interface IReview extends Document {
  guest: mongoose.Types.ObjectId;
  hotel: mongoose.Types.ObjectId;
  booking: mongoose.Types.ObjectId;
  rating: number;
  title: string;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    guest: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    comment: { type: String, required: true, trim: true, maxlength: 1500 }
  },
  { timestamps: true }
);

export const Review = mongoose.model<IReview>('Review', reviewSchema);

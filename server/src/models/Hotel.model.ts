import mongoose, { Schema, Document } from 'mongoose';

export interface IHotel extends Document {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contact: {
    phone: string;
    email: string;
  };
  amenities: string[];
  images: Array<{ url: string; alt: string; isPrimary: boolean }>;
  policies: {
    checkInTime: string;
    checkOutTime: string;
    cancellationWindowHours: number;
    cancellationPenaltyPercent: number;
    taxRatePercent: number;
  };
  ratingAverage: number;
  ratingCount: number;
  startingPrice: number;
  managers: mongoose.Types.ObjectId[];
  operationalStatus: 'active' | 'maintenance' | 'inactive';
  featured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const hotelSchema = new Schema<IHotel>(
  {
    name: { type: String, required: true, trim: true, index: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    tagline: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true, index: true },
    state: { type: String, required: true },
    country: { type: String, required: true, default: 'India' },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true }
    },
    amenities: [{ type: String, index: true }],
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, required: true },
        isPrimary: { type: Boolean, default: false }
      }
    ],
    policies: {
      checkInTime: { type: String, default: '14:00' },
      checkOutTime: { type: String, default: '11:00' },
      cancellationWindowHours: { type: Number, default: 48, min: 0 },
      cancellationPenaltyPercent: { type: Number, default: 50, min: 0, max: 100 },
      taxRatePercent: { type: Number, default: 18, min: 0, max: 50 }
    },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5, index: true },
    ratingCount: { type: Number, default: 0, min: 0 },
    startingPrice: { type: Number, default: 0, min: 0, index: true },
    managers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    operationalStatus: {
      type: String,
      enum: ['active', 'maintenance', 'inactive'],
      default: 'active',
      index: true
    },
    featured: { type: Boolean, default: false }
  },
  { timestamps: true }
);

hotelSchema.index({ name: 'text', city: 'text', state: 'text', description: 'text' });

export const Hotel = mongoose.model<IHotel>('Hotel', hotelSchema);

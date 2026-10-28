import mongoose, { Schema, Document } from 'mongoose';

export interface ISeasonalPriceRule {
  label: string;
  startDate: string;
  endDate: string;
  multiplier: number;
}

export interface IRoomType extends Document {
  hotel: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description: string;
  maxOccupancy: {
    adults: number;
    children: number;
  };
  bedConfiguration: string;
  sizeSqFt: number;
  amenities: string[];
  totalInventory: number;
  basePricePerNight: number;
  seasonalPricing: ISeasonalPriceRule[];
  images: Array<{ url: string; alt: string }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const roomTypeSchema = new Schema<IRoomType>(
  {
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, required: true },
    maxOccupancy: {
      adults: { type: Number, required: true, min: 1, max: 10 },
      children: { type: Number, default: 1, min: 0, max: 6 }
    },
    bedConfiguration: { type: String, required: true },
    sizeSqFt: { type: Number, required: true, min: 100 },
    amenities: [{ type: String }],
    totalInventory: { type: Number, required: true, min: 1, max: 200 },
    basePricePerNight: { type: Number, required: true, min: 500, index: true },
    seasonalPricing: [
      {
        label: { type: String, required: true },
        startDate: { type: String, required: true },
        endDate: { type: String, required: true },
        multiplier: { type: Number, required: true, min: 0.5, max: 5.0 }
      }
    ],
    images: [
      {
        url: { type: String, required: true },
        alt: { type: String, required: true }
      }
    ],
    isActive: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

roomTypeSchema.index({ hotel: 1, code: 1 }, { unique: true });

export const RoomType = mongoose.model<IRoomType>('RoomType', roomTypeSchema);

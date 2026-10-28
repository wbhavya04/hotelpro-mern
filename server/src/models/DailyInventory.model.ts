import mongoose, { Schema, Document } from 'mongoose';

export interface IDailyInventory extends Document {
  hotel: mongoose.Types.ObjectId;
  roomType: mongoose.Types.ObjectId;
  date: string;
  totalInventory: number;
  bookedCount: number;
  maintenanceBlockCount: number;
  priceOverride?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const dailyInventorySchema = new Schema<IDailyInventory>(
  {
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomType: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true },
    date: { type: String, required: true },
    totalInventory: { type: Number, required: true, min: 0 },
    bookedCount: { type: Number, required: true, default: 0, min: 0 },
    maintenanceBlockCount: { type: Number, required: true, default: 0, min: 0 },
    priceOverride: { type: Number, default: null }
  },
  { timestamps: true }
);

dailyInventorySchema.index({ roomType: 1, date: 1 }, { unique: true });
dailyInventorySchema.index({ hotel: 1, date: 1 });

export const DailyInventory = mongoose.model<IDailyInventory>('DailyInventory', dailyInventorySchema);

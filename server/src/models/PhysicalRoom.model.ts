import mongoose, { Schema, Document } from 'mongoose';

export type HousekeepingStatus = 'clean' | 'dirty' | 'inspected' | 'out_of_service';
export type OccupancyStatus = 'vacant' | 'occupied' | 'maintenance_block';

export interface IPhysicalRoom extends Document {
  hotel: mongoose.Types.ObjectId;
  roomType: mongoose.Types.ObjectId;
  roomNumber: string;
  floor: number;
  housekeepingStatus: HousekeepingStatus;
  occupancyStatus: OccupancyStatus;
  currentBooking?: mongoose.Types.ObjectId | null;
  notes?: string;
  lastCleanedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const physicalRoomSchema = new Schema<IPhysicalRoom>(
  {
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    roomType: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true, index: true },
    roomNumber: { type: String, required: true, trim: true },
    floor: { type: Number, required: true },
    housekeepingStatus: {
      type: String,
      enum: ['clean', 'dirty', 'inspected', 'out_of_service'],
      default: 'clean',
      index: true
    },
    occupancyStatus: {
      type: String,
      enum: ['vacant', 'occupied', 'maintenance_block'],
      default: 'vacant',
      index: true
    },
    currentBooking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    notes: { type: String, default: '' },
    lastCleanedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

physicalRoomSchema.index({ hotel: 1, roomNumber: 1 }, { unique: true });

export const PhysicalRoom = mongoose.model<IPhysicalRoom>('PhysicalRoom', physicalRoomSchema);

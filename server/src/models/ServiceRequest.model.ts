import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceRequest extends Document {
  hotel: mongoose.Types.ObjectId;
  booking?: mongoose.Types.ObjectId;
  guest?: mongoose.Types.ObjectId;
  roomNumber: string;
  requestType: 'housekeeping' | 'room_service' | 'maintenance' | 'concierge' | 'amenities';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'cancelled';
  assignedStaff?: mongoose.Types.ObjectId | null;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const serviceRequestSchema = new Schema<IServiceRequest>(
  {
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking' },
    guest: { type: Schema.Types.ObjectId, ref: 'User' },
    roomNumber: { type: String, required: true, trim: true },
    requestType: {
      type: String,
      enum: ['housekeeping', 'room_service', 'maintenance', 'concierge', 'amenities'],
      required: true
    },
    description: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    status: {
      type: String,
      enum: ['open', 'in_progress', 'resolved', 'cancelled'],
      default: 'open',
      index: true
    },
    assignedStaff: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date }
  },
  { timestamps: true }
);

export const ServiceRequest = mongoose.model<IServiceRequest>('ServiceRequest', serviceRequestSchema);

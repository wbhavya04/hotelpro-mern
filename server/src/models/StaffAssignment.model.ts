import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffAssignment extends Document {
  staff: mongoose.Types.ObjectId;
  hotel: mongoose.Types.ObjectId;
  department: 'front_desk' | 'housekeeping' | 'concierge' | 'maintenance' | 'management';
  shift: 'morning' | 'evening' | 'night';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const staffAssignmentSchema = new Schema<IStaffAssignment>(
  {
    staff: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hotel: { type: Schema.Types.ObjectId, ref: 'Hotel', required: true, index: true },
    department: {
      type: String,
      enum: ['front_desk', 'housekeeping', 'concierge', 'maintenance', 'management'],
      default: 'front_desk'
    },
    shift: { type: String, enum: ['morning', 'evening', 'night'], default: 'morning' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

staffAssignmentSchema.index({ staff: 1, hotel: 1 }, { unique: true });

export const StaffAssignment = mongoose.model<IStaffAssignment>('StaffAssignment', staffAssignmentSchema);

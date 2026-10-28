import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Booking } from '../models/Booking.model';
import { Payment } from '../models/Payment.model';
import { RoomType } from '../models/RoomType.model';
import { User } from '../models/User.model';
import { StaffAssignment } from '../models/StaffAssignment.model';
import { AuditLog } from '../models/AuditLog.model';
import { Notification } from '../models/Notification.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getAssignedHotelIds } from '../middleware/auth.middleware';
import { recordAuditLog } from '../services/audit.service';

export const getAnalyticsOverview = asyncHandler(async (req: Request, res: Response) => {
  const assignedIds = await getAssignedHotelIds(req.user!);
  const targetHotelObjectIds = assignedIds.map((id) => new mongoose.Types.ObjectId(id));
  const matchStage = { hotel: { $in: targetHotelObjectIds } };

  const [bookingStats, roomTypes] = await Promise.all([
    Booking.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          confirmedBookings: { $sum: { $cond: [{ $in: ['$status', ['confirmed', 'checked_in', 'checked_out']] }, 1, 0] } },
          cancelledBookings: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          confirmedRevenue: { $sum: { $cond: [{ $in: ['$paymentStatus', ['paid', 'partially_refunded']] }, '$pricing.totalAmount', 0] } },
          totalRoomNightsSold: { $sum: { $cond: [{ $in: ['$status', ['confirmed', 'checked_in', 'checked_out']] }, { $multiply: ['$nights', '$roomQuantity'] }, 0] } }
        }
      }
    ]),
    RoomType.find({ hotel: { $in: targetHotelObjectIds }, isActive: true }, 'totalInventory').lean()
  ]);

  const raw = bookingStats[0] || { totalBookings: 0, confirmedBookings: 0, cancelledBookings: 0, confirmedRevenue: 0, totalRoomNightsSold: 0 };
  const totalInv = roomTypes.reduce((acc, r) => acc + r.totalInventory, 0) || 1;
  const occupancyRate = Math.min(100, Number(((raw.totalRoomNightsSold / (totalInv * 30)) * 100).toFixed(1)));
  const cancellationRate = raw.totalBookings > 0 ? Number(((raw.cancelledBookings / raw.totalBookings) * 100).toFixed(1)) : 0;
  const averageBookingValue = raw.confirmedBookings > 0 ? Math.round(raw.confirmedRevenue / raw.confirmedBookings) : 0;

  res.status(200).json({
    success: true,
    metrics: { ...raw, occupancyRate, cancellationRate, averageBookingValue },
    categoryPerformance: [],
    bookingTrends: [],
    paymentStatusDistribution: []
  });
});

export const listAllUsersAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const users = await User.find({}).sort({ createdAt: -1 }).lean();
  const assignments = await StaffAssignment.find({ isActive: true }).populate('hotel', 'name city').lean();
  res.status(200).json({ success: true, users, assignments });
});

export const updateUserRoleOrStatusAdmin = asyncHandler(async (req: Request, res: Response) => {
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) throw new ApiError(404, 'User not found.', 'USER_NOT_FOUND');
  if (req.body.role) targetUser.role = req.body.role;
  if (req.body.accountStatus) targetUser.accountStatus = req.body.accountStatus;
  await targetUser.save();
  await recordAuditLog({ actorId: req.user!._id, actorRole: req.user!.role, action: 'USER_UPDATED', affectedResource: 'User', resourceId: String(targetUser._id), ipAddress: req.ip });
  res.status(200).json({ success: true, user: targetUser });
});

export const getAuditLogsAdmin = asyncHandler(async (_req: Request, res: Response) => {
  const logs = await AuditLog.find({}).populate('actor', 'name email role').sort({ createdAt: -1 }).limit(100).lean();
  res.status(200).json({ success: true, logs });
});

export const listManagerReservations = asyncHandler(async (req: Request, res: Response) => {
  const assignedIds = await getAssignedHotelIds(req.user!);
  const bookings = await Booking.find({ hotel: { $in: assignedIds } }).populate('hotel', 'name city').populate('roomType', 'name code').sort({ createdAt: -1 }).limit(100).lean();
  const payments = await Payment.find({ booking: { $in: bookings.map((b) => b._id) } }).lean();
  res.status(200).json({ success: true, bookings, payments });
});

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await Notification.find({ recipient: req.user!._id }).sort({ createdAt: -1 }).limit(40).lean();
  const unreadCount = await Notification.countDocuments({ recipient: req.user!._id, isRead: false });
  res.status(200).json({ success: true, unreadCount, notifications });
});

export const markNotificationRead = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === 'all') {
    await Notification.updateMany({ recipient: req.user!._id, isRead: false }, { $set: { isRead: true } });
  } else {
    await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user!._id }, { $set: { isRead: true } });
  }
  res.status(200).json({ success: true });
});

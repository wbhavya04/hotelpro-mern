import { Request, Response } from 'express';
import { Booking } from '../models/Booking.model';
import { PhysicalRoom } from '../models/PhysicalRoom.model';
import { DailyInventory } from '../models/DailyInventory.model';
import { ServiceRequest } from '../models/ServiceRequest.model';
import { Review } from '../models/Review.model';
import { Hotel } from '../models/Hotel.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { getAssignedHotelIds, verifyHotelScope } from '../middleware/auth.middleware';
import { recordAuditLog } from '../services/audit.service';

export const getFrontDeskOverview = asyncHandler(async (req: Request, res: Response) => {
  const assignedIds = await getAssignedHotelIds(req.user!);
  const todayStr = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const [arrivals, departures, inHouse, physicalRooms, serviceRequests] = await Promise.all([
    Booking.find({ hotel: { $in: assignedIds }, checkInDate: todayStr, status: 'confirmed' }).populate('hotel', 'name city').populate('roomType', 'name code').lean(),
    Booking.find({ hotel: { $in: assignedIds }, checkOutDate: todayStr, status: 'checked_in' }).populate('hotel', 'name city').populate('roomType', 'name code').lean(),
    Booking.find({ hotel: { $in: assignedIds }, status: 'checked_in' }).populate('hotel', 'name city').populate('roomType', 'name code').lean(),
    PhysicalRoom.find({ hotel: { $in: assignedIds } }).populate('roomType', 'name code').sort({ roomNumber: 1 }).lean(),
    ServiceRequest.find({ hotel: { $in: assignedIds } }).sort({ createdAt: -1 }).limit(50).lean()
  ]);
  res.status(200).json({ success: true, date: todayStr, arrivals, departures, inHouse, physicalRooms, serviceRequests });
});

export const performCheckIn = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, assignedRooms, idProofVerified = true } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  if (!(await verifyHotelScope(req.user!, String(booking.hotel)))) {
    throw new ApiError(403, 'Forbidden hotel scope.', 'FORBIDDEN_HOTEL_SCOPE');
  }
  if (booking.status !== 'confirmed' || booking.paymentStatus !== 'paid') {
    throw new ApiError(400, 'Booking must be confirmed and paid before check-in.', 'INVALID_CHECKIN_STATUS');
  }

  let roomsToAssign: string[] = Array.isArray(assignedRooms) && assignedRooms.length > 0 ? assignedRooms : [];
  if (roomsToAssign.length > 0) {
    const requestedDocs = await PhysicalRoom.find({ hotel: booking.hotel, roomNumber: { $in: roomsToAssign } });
    for (const rm of requestedDocs) {
      if (rm.housekeepingStatus === 'out_of_service' || rm.occupancyStatus === 'maintenance_block') {
        throw new ApiError(400, `Room ${rm.roomNumber} is under maintenance.`, 'ROOM_UNDER_MAINTENANCE');
      }
      if (rm.occupancyStatus === 'occupied') {
        throw new ApiError(400, `Room ${rm.roomNumber} is occupied.`, 'ROOM_OCCUPIED');
      }
    }
  } else {
    const avail = await PhysicalRoom.find({ hotel: booking.hotel, roomType: booking.roomType, occupancyStatus: 'vacant', housekeepingStatus: { $in: ['clean', 'inspected'] } }).limit(booking.roomQuantity).lean();
    roomsToAssign = avail.map((r) => r.roomNumber);
  }

  if (roomsToAssign.length > 0) {
    await PhysicalRoom.updateMany({ hotel: booking.hotel, roomNumber: { $in: roomsToAssign } }, { $set: { occupancyStatus: 'occupied', currentBooking: booking._id } });
  }

  booking.status = 'checked_in';
  booking.assignedRooms = roomsToAssign;
  booking.checkInRecord = { checkedInAt: new Date(), checkedInBy: req.user!._id, idProofVerified };
  await booking.save();
  await recordAuditLog({ actorId: req.user!._id, actorRole: req.user!.role, action: 'BOOKING_CHECKED_IN', affectedResource: 'Booking', resourceId: String(booking._id), ipAddress: req.ip });
  res.status(200).json({ success: true, booking });
});

export const performCheckOut = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, additionalCharges = 0, notes = '' } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  if (!(await verifyHotelScope(req.user!, String(booking.hotel)))) {
    throw new ApiError(403, 'Forbidden hotel scope.', 'FORBIDDEN_HOTEL_SCOPE');
  }
  if (booking.status !== 'checked_in') {
    throw new ApiError(400, 'Only checked-in bookings can be checked out.', 'INVALID_CHECKOUT_STATUS');
  }

  if (booking.assignedRooms.length > 0) {
    await PhysicalRoom.updateMany({ hotel: booking.hotel, roomNumber: { $in: booking.assignedRooms } }, { $set: { occupancyStatus: 'vacant', housekeepingStatus: 'dirty', currentBooking: null } });
  }

  const extra = Math.max(0, Number(additionalCharges) || 0);
  booking.pricing.additionalCharges = extra;
  booking.pricing.totalAmount += extra;
  booking.status = 'checked_out';
  booking.checkOutRecord = { checkedOutAt: new Date(), checkedOutBy: req.user!._id, additionalCharges: extra, notes };
  await booking.save();
  res.status(200).json({ success: true, booking });
});

export const updatePhysicalRoomStatus = asyncHandler(async (req: Request, res: Response) => {
  const room = await PhysicalRoom.findById(req.params.id);
  if (!room) throw new ApiError(404, 'Room not found.', 'ROOM_NOT_FOUND');
  if (!(await verifyHotelScope(req.user!, String(room.hotel)))) throw new ApiError(403, 'Forbidden hotel scope.', 'FORBIDDEN_HOTEL_SCOPE');
  if (req.body.housekeepingStatus) room.housekeepingStatus = req.body.housekeepingStatus;
  if (req.body.occupancyStatus) room.occupancyStatus = req.body.occupancyStatus;
  await room.save();
  res.status(200).json({ success: true, room });
});

export const createServiceRequest = asyncHandler(async (req: Request, res: Response) => {
  const sr = await ServiceRequest.create({ ...req.body, hotel: req.body.hotelId, guest: req.user!._id, status: 'open' });
  res.status(201).json({ success: true, serviceRequest: sr });
});

export const updateServiceRequestStatus = asyncHandler(async (req: Request, res: Response) => {
  const sr = await ServiceRequest.findById(req.params.id);
  if (!sr) throw new ApiError(404, 'Not found.', 'NOT_FOUND');
  if (req.body.status) sr.status = req.body.status;
  await sr.save();
  res.status(200).json({ success: true, serviceRequest: sr });
});

export const createReview = asyncHandler(async (req: Request, res: Response) => {
  const { bookingId, rating, title, comment } = req.body;
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError(404, 'Booking not found.', 'BOOKING_NOT_FOUND');
  if (String(booking.guest) !== String(req.user!._id)) throw new ApiError(403, 'Forbidden ownership.', 'FORBIDDEN_OWNERSHIP');
  if (booking.status !== 'checked_out') throw new ApiError(400, 'Stay not completed.', 'STAY_NOT_COMPLETED');

  const review = await Review.create({ guest: req.user!._id, hotel: booking.hotel, booking: booking._id, rating, title, comment });
  const stats = await Review.aggregate([{ $match: { hotel: booking.hotel } }, { $group: { _id: '$hotel', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }]);
  if (stats.length > 0) {
    await Hotel.findByIdAndUpdate(booking.hotel, { ratingAverage: Number(stats[0].avgRating.toFixed(1)), ratingCount: stats[0].count });
  }
  res.status(201).json({ success: true, review });
});

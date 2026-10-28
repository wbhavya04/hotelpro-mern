import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Hotel } from '../models/Hotel.model';
import { RoomType } from '../models/RoomType.model';
import { PhysicalRoom } from '../models/PhysicalRoom.model';
import { DailyInventory } from '../models/DailyInventory.model';
import { Review } from '../models/Review.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { checkAvailabilityAndCalculateQuote } from '../services/inventory.service';
import { verifyHotelScope } from '../middleware/auth.middleware';
import { recordAuditLog } from '../services/audit.service';

export const listHotels = asyncHandler(async (req: Request, res: Response) => {
  const { search, city, minPrice, maxPrice, minRating, amenities, sort = 'featured', page = '1', limit = '9' } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = { operationalStatus: 'active' };
  if (search && search.trim()) {
    const regex = new RegExp(search.trim(), 'i');
    filter.$or = [{ name: regex }, { city: regex }, { state: regex }, { tagline: regex }];
  }
  if (city && city !== 'all') filter.city = new RegExp(`^${city.trim()}$`, 'i');
  if (minPrice || maxPrice) {
    const pq: Record<string, number> = {};
    if (minPrice) pq.$gte = Number(minPrice);
    if (maxPrice) pq.$lte = Number(maxPrice);
    filter.startingPrice = pq;
  }
  if (minRating) filter.ratingAverage = { $gte: Number(minRating) };
  if (amenities && amenities.trim()) {
    const list = amenities.split(',').map((a) => a.trim()).filter(Boolean);
    if (list.length > 0) filter.amenities = { $all: list };
  }

  let sortOption: Record<string, 1 | -1> = { featured: -1, ratingAverage: -1 };
  if (sort === 'price_asc') sortOption = { startingPrice: 1 };
  else if (sort === 'price_desc') sortOption = { startingPrice: -1 };
  else if (sort === 'rating_desc') sortOption = { ratingAverage: -1, ratingCount: -1 };

  const pageNum = Math.max(1, parseInt(page || '1', 10));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit || '9', 10)));
  const skip = (pageNum - 1) * limitNum;

  const [hotels, total] = await Promise.all([
    Hotel.find(filter).sort(sortOption).skip(skip).limit(limitNum).lean(),
    Hotel.countDocuments(filter)
  ]);

  res.status(200).json({
    success: true,
    data: hotels,
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 }
  });
});

export const getHotelDetails = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { checkInDate, checkOutDate, roomQuantity = '1' } = req.query as Record<string, string | undefined>;
  const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { slug: id };
  const hotel = await Hotel.findOne(query).lean();
  if (!hotel) throw new ApiError(404, 'Hotel not found.', 'HOTEL_NOT_FOUND');

  const roomTypes = await RoomType.find({ hotel: hotel._id, isActive: true }).sort({ basePricePerNight: 1 }).lean();
  const reviews = await Review.find({ hotel: hotel._id }).populate('guest', 'name profile.city').sort({ createdAt: -1 }).limit(10).lean();

  const enrichedRooms = await Promise.all(
    roomTypes.map(async (rt) => {
      if (checkInDate && checkOutDate) {
        try {
          const quote = await checkAvailabilityAndCalculateQuote({
            roomTypeId: rt._id,
            checkInDate,
            checkOutDate,
            roomQuantity: Math.max(1, parseInt(roomQuantity || '1', 10))
          });
          return { ...rt, availabilityQuote: quote };
        } catch {
          return { ...rt, availabilityQuote: null };
        }
      }
      return { ...rt, availabilityQuote: null };
    })
  );

  res.status(200).json({ success: true, hotel, roomTypes: enrichedRooms, reviews });
});

export const createHotel = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body;
  const slug = body.slug || body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const hotel = await Hotel.create({ ...body, slug, managers: req.user!.role === 'manager' ? [req.user!._id] : body.managers || [] });
  await recordAuditLog({ actorId: req.user!._id, actorRole: req.user!.role, action: 'HOTEL_CREATED', affectedResource: 'Hotel', resourceId: String(hotel._id), metadata: { name: hotel.name }, ipAddress: req.ip });
  res.status(201).json({ success: true, message: 'Hotel created.', hotel });
});

export const updateHotel = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!(await verifyHotelScope(req.user!, id))) throw new ApiError(403, 'Forbidden hotel scope.', 'FORBIDDEN_HOTEL_SCOPE');
  const hotel = await Hotel.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
  if (!hotel) throw new ApiError(404, 'Hotel not found.', 'HOTEL_NOT_FOUND');
  res.status(200).json({ success: true, message: 'Hotel updated.', hotel });
});

export const listRooms = asyncHandler(async (req: Request, res: Response) => {
  const { hotelId } = req.query as { hotelId?: string };
  const filter: Record<string, unknown> = { isActive: true };
  if (hotelId) filter.hotel = hotelId;
  const rooms = await RoomType.find(filter).populate('hotel', 'name city slug policies').sort({ basePricePerNight: 1 }).lean();
  res.status(200).json({ success: true, data: rooms });
});

export const getRoomDetails = asyncHandler(async (req: Request, res: Response) => {
  const room = await RoomType.findById(req.params.id).populate('hotel').lean();
  if (!room) throw new ApiError(404, 'Room category not found.', 'ROOM_NOT_FOUND');
  res.status(200).json({ success: true, room });
});

export const createRoomType = asyncHandler(async (req: Request, res: Response) => {
  const { hotel: hotelId } = req.body;
  if (!(await verifyHotelScope(req.user!, hotelId))) throw new ApiError(403, 'Forbidden hotel scope.', 'FORBIDDEN_HOTEL_SCOPE');
  const roomType = await RoomType.create(req.body);
  const minRoom = await RoomType.findOne({ hotel: hotelId, isActive: true }).sort({ basePricePerNight: 1 });
  if (minRoom) await Hotel.findByIdAndUpdate(hotelId, { startingPrice: minRoom.basePricePerNight });

  const docs = [];
  for (let i = 1; i <= roomType.totalInventory; i++) {
    docs.push({ hotel: hotelId, roomType: roomType._id, roomNumber: `${roomType.code}-${100 + i}`, floor: Math.ceil(i / 4), housekeepingStatus: 'inspected' as const, occupancyStatus: 'vacant' as const });
  }
  await PhysicalRoom.insertMany(docs);
  res.status(201).json({ success: true, message: 'Room category created.', roomType });
});

export const updateRoomType = asyncHandler(async (req: Request, res: Response) => {
  const existing = await RoomType.findById(req.params.id);
  if (!existing) throw new ApiError(404, 'Room category not found.', 'ROOM_NOT_FOUND');
  if (!(await verifyHotelScope(req.user!, String(existing.hotel)))) throw new ApiError(403, 'Forbidden hotel scope.', 'FORBIDDEN_HOTEL_SCOPE');
  Object.assign(existing, req.body);
  await existing.save();
  if (typeof req.body.totalInventory === 'number') {
    await DailyInventory.updateMany({ roomType: existing._id }, { $set: { totalInventory: req.body.totalInventory } });
  }
  res.status(200).json({ success: true, message: 'Room category updated.', roomType: existing });
});

export const getAvailabilityQuote = asyncHandler(async (req: Request, res: Response) => {
  const { roomTypeId, checkInDate, checkOutDate, roomQuantity = '1' } = req.query as Record<string, string>;
  if (!roomTypeId || !checkInDate || !checkOutDate) throw new ApiError(400, 'Missing query params.', 'MISSING_QUERY_PARAMS');
  const quote = await checkAvailabilityAndCalculateQuote({ roomTypeId, checkInDate, checkOutDate, roomQuantity: Math.max(1, parseInt(roomQuantity, 10)) });
  res.status(200).json({ success: true, quote });
});

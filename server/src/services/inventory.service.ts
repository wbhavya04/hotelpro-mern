import mongoose from 'mongoose';
import { DailyInventory } from '../models/DailyInventory.model';
import { RoomType, IRoomType } from '../models/RoomType.model';
import { Hotel } from '../models/Hotel.model';
import { getStayNightStrings } from '../utils/referenceGenerator';
import { ApiError } from '../utils/ApiError';

export interface StayAvailabilityAndQuote {
  isAvailable: boolean;
  minAvailableRooms: number;
  nights: number;
  nightlyRates: Array<{ date: string; ratePerRoom: number }>;
  baseAmount: number;
  taxesAndFees: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
}

export function validateAndExtractStayNights(checkInDate: string, checkOutDate: string): string[] {
  const start = new Date(`${checkInDate}T00:00:00.000Z`);
  const end = new Date(`${checkOutDate}T00:00:00.000Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new ApiError(400, 'Invalid check-in or check-out date format. Expected YYYY-MM-DD.', 'INVALID_DATE');
  }
  if (end <= start) {
    throw new ApiError(400, 'Check-out date must be after check-in date.', 'INVALID_DATE_RANGE');
  }

  const nights = getStayNightStrings(checkInDate, checkOutDate);
  if (nights.length < 1 || nights.length > 30) {
    throw new ApiError(400, 'Stay duration must be between 1 and 30 nights.', 'INVALID_STAY_DURATION');
  }
  return nights;
}

export function computeNightRate(roomType: IRoomType, dateStr: string, priceOverride?: number | null): number {
  if (typeof priceOverride === 'number' && priceOverride > 0) return Math.round(priceOverride);
  let rate = roomType.basePricePerNight;
  for (const rule of roomType.seasonalPricing || []) {
    if (dateStr >= rule.startDate && dateStr <= rule.endDate) {
      rate = Math.round(rate * rule.multiplier);
      break;
    }
  }
  return rate;
}

export async function checkAvailabilityAndCalculateQuote(params: {
  roomTypeId: string | mongoose.Types.ObjectId;
  checkInDate: string;
  checkOutDate: string;
  roomQuantity: number;
}): Promise<StayAvailabilityAndQuote> {
  const nights = validateAndExtractStayNights(params.checkInDate, params.checkOutDate);
  const roomType = await RoomType.findById(params.roomTypeId);
  if (!roomType || !roomType.isActive) {
    throw new ApiError(404, 'Selected room category is not available.', 'ROOM_TYPE_UNAVAILABLE');
  }
  const hotel = await Hotel.findById(roomType.hotel);
  if (!hotel || hotel.operationalStatus !== 'active') {
    throw new ApiError(400, 'Hotel is currently under maintenance or unavailable for booking.', 'HOTEL_UNAVAILABLE');
  }

  await Promise.all(
    nights.map((dateStr) =>
      DailyInventory.updateOne(
        { roomType: roomType._id, date: dateStr },
        {
          $setOnInsert: {
            hotel: roomType.hotel,
            roomType: roomType._id,
            date: dateStr,
            totalInventory: roomType.totalInventory,
            bookedCount: 0,
            maintenanceBlockCount: 0,
            priceOverride: null
          }
        },
        { upsert: true }
      )
    )
  );

  const buckets = await DailyInventory.find({ roomType: roomType._id, date: { $in: nights } }).lean();
  const bucketMap = new Map(buckets.map((b) => [b.date, b]));

  let minAvailableRooms = roomType.totalInventory;
  const nightlyRates: Array<{ date: string; ratePerRoom: number }> = [];
  let singleRoomSum = 0;

  for (const dateStr of nights) {
    const bucket = bucketMap.get(dateStr);
    const totalInv = bucket ? bucket.totalInventory : roomType.totalInventory;
    const booked = bucket ? bucket.bookedCount : 0;
    const maint = bucket ? bucket.maintenanceBlockCount : 0;
    const available = Math.max(0, totalInv - booked - maint);
    if (available < minAvailableRooms) minAvailableRooms = available;

    const ratePerRoom = computeNightRate(roomType, dateStr, bucket?.priceOverride);
    nightlyRates.push({ date: dateStr, ratePerRoom });
    singleRoomSum += ratePerRoom;
  }

  const baseAmount = singleRoomSum * params.roomQuantity;
  const taxRate = hotel.policies?.taxRatePercent ?? 18;
  const taxesAndFees = Math.round((baseAmount * taxRate) / 100);
  const totalAmount = baseAmount + taxesAndFees;

  return {
    isAvailable: minAvailableRooms >= params.roomQuantity,
    minAvailableRooms,
    nights: nights.length,
    nightlyRates,
    baseAmount,
    taxesAndFees,
    discountAmount: 0,
    totalAmount,
    currency: 'INR'
  };
}

export async function acquireAtomicInventoryLock(params: {
  roomTypeId: string | mongoose.Types.ObjectId;
  checkInDate: string;
  checkOutDate: string;
  roomQuantity: number;
}): Promise<StayAvailabilityAndQuote> {
  const quote = await checkAvailabilityAndCalculateQuote(params);
  const nights = getStayNightStrings(params.checkInDate, params.checkOutDate);
  const lockedDates: string[] = [];

  try {
    for (const dateStr of nights) {
      const updated = await DailyInventory.findOneAndUpdate(
        {
          roomType: params.roomTypeId,
          date: dateStr,
          $expr: {
            $gte: [
              { $subtract: ['$totalInventory', { $add: ['$bookedCount', '$maintenanceBlockCount'] }] },
              params.roomQuantity
            ]
          }
        },
        { $inc: { bookedCount: params.roomQuantity } },
        { new: true }
      );

      if (!updated) {
        throw new ApiError(409, `Insufficient room inventory on ${dateStr}.`, 'INSUFFICIENT_INVENTORY');
      }
      lockedDates.push(dateStr);
    }
    return quote;
  } catch (error) {
    if (lockedDates.length > 0) {
      await DailyInventory.updateMany(
        { roomType: params.roomTypeId, date: { $in: lockedDates } },
        { $inc: { bookedCount: -params.roomQuantity } }
      );
    }
    throw error;
  }
}

export async function releaseAtomicInventoryLock(params: {
  roomTypeId: string | mongoose.Types.ObjectId;
  checkInDate: string;
  checkOutDate: string;
  roomQuantity: number;
}): Promise<void> {
  const nights = getStayNightStrings(params.checkInDate, params.checkOutDate);
  await DailyInventory.updateMany(
    { roomType: params.roomTypeId, date: { $in: nights }, bookedCount: { $gte: params.roomQuantity } },
    { $inc: { bookedCount: -params.roomQuantity } }
  );
}

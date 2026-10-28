import { Booking } from '../models/Booking.model';
import { releaseAtomicInventoryLock } from '../services/inventory.service';

export async function releaseExpiredBookingHolds(): Promise<number> {
  const expiredBookings = await Booking.find({
    status: 'pending_payment',
    inventoryLocked: true,
    holdExpiresAt: { $lte: new Date() }
  });
  for (const booking of expiredBookings) {
    await releaseAtomicInventoryLock({
      roomTypeId: booking.roomType,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      roomQuantity: booking.roomQuantity
    });
    booking.status = 'payment_failed';
    booking.paymentStatus = 'failed';
    booking.inventoryLocked = false;
    await booking.save();
  }
  return expiredBookings.length;
}

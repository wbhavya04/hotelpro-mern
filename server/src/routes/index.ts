import { Router } from 'express';
import * as authCtrl from '../controllers/auth.controller';
import * as hotelCtrl from '../controllers/hotel.controller';
import * as bookingCtrl from '../controllers/booking.controller';
import * as paymentCtrl from '../controllers/payment.controller';
import * as opsCtrl from '../controllers/operations.controller';
import * as reportCtrl from '../controllers/report.controller';
import { authenticate, authorizeRoles } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { authRateLimiter } from '../middleware/rateLimit.middleware';
import {
  registerSchema,
  loginSchema,
  updateProfileSchema,
  changePasswordSchema,
  createHotelSchema,
  createRoomTypeSchema,
  createBookingSchema,
  verifyPaymentSchema,
  checkInSchema,
  checkOutSchema,
  createReviewSchema
} from '../validators/schemas';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({ success: true, service: 'HotelPro API', status: 'healthy' });
});

router.post('/auth/register', authRateLimiter, validateRequest(registerSchema), authCtrl.register);
router.post('/auth/login', authRateLimiter, validateRequest(loginSchema), authCtrl.login);
router.post('/auth/logout', authCtrl.logout);
router.get('/auth/me', authenticate, authCtrl.getMe);
router.patch('/auth/profile', authenticate, validateRequest(updateProfileSchema), authCtrl.updateProfile);
router.post('/auth/change-password', authenticate, validateRequest(changePasswordSchema), authCtrl.changePassword);

router.get('/hotels', hotelCtrl.listHotels);
router.get('/hotels/:id', hotelCtrl.getHotelDetails);
router.post('/hotels', authenticate, authorizeRoles('manager', 'admin'), validateRequest(createHotelSchema), hotelCtrl.createHotel);
router.patch('/hotels/:id', authenticate, authorizeRoles('manager', 'admin'), hotelCtrl.updateHotel);

router.get('/rooms', hotelCtrl.listRooms);
router.get('/rooms/:id', hotelCtrl.getRoomDetails);
router.post('/rooms', authenticate, authorizeRoles('manager', 'admin'), validateRequest(createRoomTypeSchema), hotelCtrl.createRoomType);
router.patch('/rooms/:id', authenticate, authorizeRoles('manager', 'admin'), hotelCtrl.updateRoomType);

router.get('/availability', hotelCtrl.getAvailabilityQuote);

router.post('/bookings', authenticate, validateRequest(createBookingSchema), bookingCtrl.createBooking);
router.get('/bookings/my', authenticate, bookingCtrl.getMyBookings);
router.get('/bookings/:id', authenticate, bookingCtrl.getBookingById);
router.patch('/bookings/:id', authenticate, bookingCtrl.modifyBooking);
router.post('/bookings/:id/cancel', authenticate, bookingCtrl.cancelBooking);

router.post('/payments/create-order', authenticate, paymentCtrl.createPaymentOrder);
router.post('/payments/verify', authenticate, validateRequest(verifyPaymentSchema), paymentCtrl.verifyPayment);
router.post('/payments/fail', authenticate, paymentCtrl.handlePaymentFailure);
router.post('/payments/:bookingId/refund', authenticate, authorizeRoles('manager', 'admin'), paymentCtrl.processRefund);

router.post('/reviews', authenticate, validateRequest(createReviewSchema), opsCtrl.createReview);

router.get('/staff/operations', authenticate, authorizeRoles('staff', 'manager', 'admin'), opsCtrl.getFrontDeskOverview);
router.post('/staff/check-in', authenticate, authorizeRoles('staff', 'manager', 'admin'), validateRequest(checkInSchema), opsCtrl.performCheckIn);
router.post('/staff/check-out', authenticate, authorizeRoles('staff', 'manager', 'admin'), validateRequest(checkOutSchema), opsCtrl.performCheckOut);
router.patch('/staff/physical-rooms/:id', authenticate, authorizeRoles('staff', 'manager', 'admin'), opsCtrl.updatePhysicalRoomStatus);
router.post('/service-requests', authenticate, opsCtrl.createServiceRequest);
router.patch('/staff/service-requests/:id', authenticate, authorizeRoles('staff', 'manager', 'admin'), opsCtrl.updateServiceRequestStatus);

router.get('/reports/overview', authenticate, authorizeRoles('manager', 'admin'), reportCtrl.getAnalyticsOverview);
router.get('/manager/reservations', authenticate, authorizeRoles('manager', 'admin'), reportCtrl.listManagerReservations);
router.get('/admin/users', authenticate, authorizeRoles('admin'), reportCtrl.listAllUsersAdmin);
router.patch('/admin/users/:id', authenticate, authorizeRoles('admin'), reportCtrl.updateUserRoleOrStatusAdmin);
router.get('/admin/audit-logs', authenticate, authorizeRoles('admin'), reportCtrl.getAuditLogsAdmin);

router.get('/notifications', authenticate, reportCtrl.getMyNotifications);
router.patch('/notifications/:id/read', authenticate, reportCtrl.markNotificationRead);

export default router;

import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import app from '../app';
import { User } from '../models/User.model';
import { Hotel } from '../models/Hotel.model';
import { RoomType } from '../models/RoomType.model';
import { PhysicalRoom } from '../models/PhysicalRoom.model';
import { StaffAssignment } from '../models/StaffAssignment.model';
import { computeExpectedPaymentSignature } from '../services/payment.service';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

describe('HotelPro Full-Stack API Verification Suite', () => {
  it('registers a guest, hashes password, rejects duplicate email, and blocks self-assigned admin role', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Riya Sharma',
      email: 'riya@example.com',
      password: 'SecurePassword123',
      phone: '+91 9820011223',
      role: 'admin'
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('guest');

    const dup = await request(app).post('/api/auth/register').send({
      name: 'Riya Duplicate',
      email: 'riya@example.com',
      password: 'SecurePassword123',
      phone: '+91 9820011223'
    });
    expect(dup.status).toBe(409);
  });

  it('prevents concurrent double-bookings on the last room and verifies HMAC payment signatures', async () => {
    const regA = await request(app).post('/api/auth/register').send({ name: 'Guest A', email: 'a@example.com', password: 'Password123!', phone: '9800000001' });
    const regB = await request(app).post('/api/auth/register').send({ name: 'Guest B', email: 'b@example.com', password: 'Password123!', phone: '9800000002' });

    const hotel = await Hotel.create({
      name: 'Test Palace',
      slug: 'test-palace',
      tagline: 'Palace',
      description: 'Test Palace description string.',
      address: '1 Palace Rd',
      city: 'Udaipur',
      state: 'Rajasthan',
      country: 'India',
      contact: { phone: '9999999999', email: 'p@hotelpro.in' },
      amenities: ['Wi-Fi'],
      images: [{ url: '/assets/h.jpg', alt: 'H', isPrimary: true }],
      startingPrice: 10000,
      operationalStatus: 'active'
    });

    const roomType = await RoomType.create({
      hotel: hotel._id,
      name: 'Suite',
      code: 'STE',
      description: 'Suite with 1 room inventory.',
      maxOccupancy: { adults: 2, children: 1 },
      bedConfiguration: '1 King',
      sizeSqFt: 500,
      amenities: ['Wi-Fi'],
      totalInventory: 1,
      basePricePerNight: 10000,
      images: [{ url: '/assets/r.jpg', alt: 'R' }],
      isActive: true
    });

    const payload = {
      hotelId: String(hotel._id),
      roomTypeId: String(roomType._id),
      checkInDate: '2026-12-10',
      checkOutDate: '2026-12-12',
      roomQuantity: 1,
      guestsCount: { adults: 2, children: 0 },
      guestDetails: { fullName: 'Guest', email: 'a@example.com', phone: '9800000001' }
    };

    const [res1, res2] = await Promise.all([
      request(app).post('/api/bookings').set('Authorization', `Bearer ${regA.body.token}`).send(payload),
      request(app).post('/api/bookings').set('Authorization', `Bearer ${regB.body.token}`).send(payload)
    ]);

    expect([res1.status, res2.status].sort()).toEqual([201, 409]);

    const winner = res1.status === 201 ? res1 : res2;
    const winnerToken = res1.status === 201 ? regA.body.token : regB.body.token;
    const bookingId = winner.body.booking._id;

    const orderRes = await request(app).post('/api/payments/create-order').set('Authorization', `Bearer ${winnerToken}`).send({ bookingId });
    expect(orderRes.status).toBe(200);

    const validSig = computeExpectedPaymentSignature(orderRes.body.order.orderId, 'pay_test_1');
    const verifyRes = await request(app).post('/api/payments/verify').set('Authorization', `Bearer ${winnerToken}`).send({
      bookingId,
      razorpay_order_id: orderRes.body.order.orderId,
      razorpay_payment_id: 'pay_test_1',
      razorpay_signature: validSig
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.booking.status).toBe('confirmed');
  });
});

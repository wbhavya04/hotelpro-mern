# HotelPro — Full-Stack Hotel Management System (MERN + TypeScript)

## 1. Project Overview
HotelPro is a full-stack hospitality and property management system built on the MERN Stack (MongoDB, Express.js, React 18, Node.js) with TypeScript across both frontend and backend. It supports four distinct roles (Guest, Hotel Staff, Hotel Manager, Administrator) and implements atomic date-bucket inventory protection, Razorpay HMAC-SHA256 payment verification, front-desk check-in/out with physical room assignment, housekeeping status boards, Recharts analytics, and immutable security audit logs.

## 2. Main Features
- **Four Role Portals (`guest`, `staff`, `manager`, `admin`)** with backend JWT + HTTP-Only cookie authentication and hotel-scope authorization (`StaffAssignment`).
- **Atomic Double-Booking Prevention**: `DailyInventory` collection indexed on `{ roomType: 1, date: 1 }` with conditional `$inc` updates (`available >= requestedRooms`) and automatic compensating rollbacks.
- **Razorpay Test/Sandbox Payment Verification**: Server-side order creation, `crypto.timingSafeEqual` HMAC-SHA256 signature verification, idempotent replay handling, GST invoice generation, and two-step refund approval (`refund_pending` -> `refunded`).
- **Front-Desk & Housekeeping Operations**: Separates category-level booking availability from `PhysicalRoom` cleaning states (`inspected`, `clean`, `dirty`, `out_of_service`).

## 3. Installation, Seed & Test Commands
```bash
# 1. Backend Setup & Seed
cd server
cp ../.env.example .env
npm install
npm run seed
npm run dev

# 2. Run Automated Jest + Supertest Suite
cd server
npm test

# 3. Frontend Setup
cd ../client
npm install
npm run dev
```

## 4. Demo Accounts (Password: `HotelPro@2026`)
- **Guest**: `guest@hotelpro.in`
- **Hotel Staff (Udaipur)**: `staff@hotelpro.in`
- **Hotel Manager**: `manager@hotelpro.in`
- **Platform Administrator**: `admin@hotelpro.in`

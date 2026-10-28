import { z } from 'zod';

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    phone: z.string().trim().min(8).max(20)
  })
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email(),
    password: z.string().min(1)
  })
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    phone: z.string().trim().min(8).max(20).optional(),
    city: z.string().trim().max(80).optional(),
    country: z.string().trim().max(80).optional(),
    preferences: z.array(z.string()).optional()
  })
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(72)
  })
});

export const createHotelSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3),
    slug: z.string().trim().min(3).optional(),
    tagline: z.string().trim().min(5),
    description: z.string().trim().min(20),
    address: z.string().trim().min(5),
    city: z.string().trim().min(2),
    state: z.string().trim().min(2),
    country: z.string().trim().default('India'),
    contact: z.object({
      phone: z.string().trim().min(8),
      email: z.string().trim().email()
    }),
    amenities: z.array(z.string()).default([]),
    images: z.array(z.object({ url: z.string().min(1), alt: z.string().min(1), isPrimary: z.boolean().default(false) })).min(1),
    policies: z.object({
      checkInTime: z.string().default('14:00'),
      checkOutTime: z.string().default('11:00'),
      cancellationWindowHours: z.number().min(0).default(48),
      cancellationPenaltyPercent: z.number().min(0).max(100).default(50),
      taxRatePercent: z.number().min(0).max(50).default(18)
    }).optional(),
    featured: z.boolean().optional()
  })
});

export const createRoomTypeSchema = z.object({
  body: z.object({
    hotel: z.string().min(1),
    name: z.string().trim().min(3),
    code: z.string().trim().min(2).max(16),
    description: z.string().trim().min(10),
    maxOccupancy: z.object({ adults: z.number().int().min(1).max(10), children: z.number().int().min(0).max(6).default(1) }),
    bedConfiguration: z.string().trim().min(3),
    sizeSqFt: z.number().int().min(100),
    amenities: z.array(z.string()).default([]),
    totalInventory: z.number().int().min(1).max(200),
    basePricePerNight: z.number().min(500),
    seasonalPricing: z.array(z.object({ label: z.string().min(2), startDate: z.string().regex(dateRegex), endDate: z.string().regex(dateRegex), multiplier: z.number().min(0.5).max(5.0) })).default([]),
    images: z.array(z.object({ url: z.string().min(1), alt: z.string().min(1) })).default([])
  })
});

export const createBookingSchema = z.object({
  body: z.object({
    hotelId: z.string().min(1),
    roomTypeId: z.string().min(1),
    checkInDate: z.string().regex(dateRegex),
    checkOutDate: z.string().regex(dateRegex),
    roomQuantity: z.number().int().min(1).max(10),
    guestsCount: z.object({ adults: z.number().int().min(1).max(20), children: z.number().int().min(0).max(10).default(0) }),
    guestDetails: z.object({ fullName: z.string().trim().min(2), email: z.string().trim().email(), phone: z.string().trim().min(8), specialRequests: z.string().max(500).optional().default('') })
  })
});

export const verifyPaymentSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1),
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    amount: z.number().optional()
  })
});

export const checkInSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1),
    assignedRooms: z.array(z.string().min(1)).optional(),
    idProofVerified: z.boolean().default(true)
  })
});

export const checkOutSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1),
    additionalCharges: z.number().min(0).default(0),
    notes: z.string().max(500).optional().default('')
  })
});

export const createReviewSchema = z.object({
  body: z.object({
    bookingId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().min(3).max(120),
    comment: z.string().trim().min(10).max(1500)
  })
});

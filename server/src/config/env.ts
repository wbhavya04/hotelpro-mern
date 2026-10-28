import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  SERVER_PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters long'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  EMAIL_HOST: z.string().optional().default(''),
  EMAIL_PORT: z.coerce.number().optional().default(587),
  EMAIL_USER: z.string().optional().default(''),
  EMAIL_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default('HotelPro Reservations <reservations@hotelpro.in>'),
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default('')
});

const parsed = envSchema.safeParse({
  ...process.env,
  MONGODB_URI: process.env.MONGODB_URI || (process.env.NODE_ENV === 'test' ? 'mongodb://127.0.0.1:27017/hotelpro_test' : undefined),
  JWT_SECRET: process.env.JWT_SECRET || (process.env.NODE_ENV !== 'production' ? 'dev_only_hotelpro_jwt_secret_key_change_in_prod_998877' : undefined)
});

if (!parsed.success) {
  console.error('[HotelPro Startup Error] Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
  hasRazorpayCredentials: Boolean(parsed.data.RAZORPAY_KEY_ID && parsed.data.RAZORPAY_KEY_SECRET),
  hasEmailCredentials: Boolean(parsed.data.EMAIL_HOST && parsed.data.EMAIL_USER && parsed.data.EMAIL_PASSWORD)
};

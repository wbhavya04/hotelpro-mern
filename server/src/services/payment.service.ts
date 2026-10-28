import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';

const SANDBOX_SECRET = env.RAZORPAY_KEY_SECRET || 'hotelpro_dev_sandbox_hmac_secret_2026';

let razorpayClient: Razorpay | null = null;
if (env.hasRazorpayCredentials) {
  razorpayClient = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
}

export async function createGatewayOrder(params: {
  amountInRupees: number;
  currency: string;
  receipt: string;
}): Promise<{
  orderId: string;
  amountPaise: number;
  currency: string;
  provider: 'razorpay' | 'razorpay_sandbox';
  keyId: string;
}> {
  const amountPaise = Math.round(params.amountInRupees * 100);
  if (razorpayClient && env.hasRazorpayCredentials) {
    const order = await razorpayClient.orders.create({ amount: amountPaise, currency: params.currency, receipt: params.receipt });
    return { orderId: order.id, amountPaise, currency: params.currency, provider: 'razorpay', keyId: env.RAZORPAY_KEY_ID };
  }
  const randomHex = crypto.randomBytes(6).toString('hex');
  return { orderId: `order_sandbox_${randomHex}`, amountPaise, currency: params.currency, provider: 'razorpay_sandbox', keyId: 'rzp_test_hotelpro_sandbox' };
}

export function computeExpectedPaymentSignature(orderId: string, paymentId: string): string {
  return crypto.createHmac('sha256', SANDBOX_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
}

export function verifyPaymentHmacSignature(orderId: string, paymentId: string, providedSignature: string): boolean {
  const expected = computeExpectedPaymentSignature(orderId, paymentId);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

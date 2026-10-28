import nodemailer from 'nodemailer';
import { env } from '../config/env';

let transporter: nodemailer.Transporter | null = null;

if (env.hasEmailCredentials) {
  transporter = nodemailer.createTransport({
    host: env.EMAIL_HOST,
    port: env.EMAIL_PORT,
    secure: env.EMAIL_PORT === 465,
    auth: { user: env.EMAIL_USER, pass: env.EMAIL_PASSWORD }
  });
}

export async function sendTransactionalEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ delivered: boolean; mode: 'smtp' | 'dev_log' }> {
  if (!transporter) {
    if (!env.isTest) {
      console.info(`[HotelPro Email skipped — SMTP credentials not configured] To: ${options.to} | Subject: ${options.subject}`);
    }
    return { delivered: false, mode: 'dev_log' };
  }
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM, to: options.to, subject: options.subject, html: options.html });
    return { delivered: true, mode: 'smtp' };
  } catch (error) {
    console.error('[HotelPro Email Delivery Error]:', error);
    return { delivered: false, mode: 'smtp' };
  }
}

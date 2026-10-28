import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User } from '../models/User.model';
import { Notification } from '../models/Notification.model';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';
import { signAuthToken, attachAuthCookie, clearAuthCookie } from '../utils/jwt';
import { sendTransactionalEmail } from '../services/email.service';
import { getAssignedHotelIds } from '../middleware/auth.middleware';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, phone } = req.body;
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw new ApiError(409, 'An account with this email address already exists.', 'DUPLICATE_EMAIL');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(24).toString('hex');

  const user = await User.create({
    name,
    email: email.toLowerCase(),
    passwordHash,
    phone,
    role: 'guest',
    isEmailVerified: false,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
  });

  await Notification.create({
    recipient: user._id,
    type: 'system',
    title: 'Welcome to HotelPro',
    message: 'Your guest profile is active. Explore curated heritage palaces, riverside forts, and urban hotels across India.',
    link: '/hotels'
  });

  await sendTransactionalEmail({
    to: user.email,
    subject: 'Welcome to HotelPro — Verify Your Email',
    html: `<p>Dear ${user.name},</p><p>Welcome to <strong>HotelPro</strong>. Your verification code is <code>${verificationToken}</code>.</p>`
  });

  const token = signAuthToken({ sub: String(user._id), role: user.role, email: user.email });
  attachAuthCookie(res, token);

  res.status(201).json({
    success: true,
    message: 'Registration completed.',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      accountStatus: user.accountStatus,
      profile: user.profile,
      assignedHotels: []
    }
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  if (!user) throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  if (user.accountStatus === 'suspended') {
    throw new ApiError(403, 'Your account has been suspended.', 'ACCOUNT_SUSPENDED');
  }
  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');

  const assignedHotels = await getAssignedHotelIds(user);
  const token = signAuthToken({ sub: String(user._id), role: user.role, email: user.email });
  attachAuthCookie(res, token);

  res.status(200).json({
    success: true,
    message: 'Signed in successfully.',
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      accountStatus: user.accountStatus,
      profile: user.profile,
      assignedHotels
    }
  });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  clearAuthCookie(res);
  res.status(200).json({ success: true, message: 'Signed out successfully.' });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const assignedHotels = await getAssignedHotelIds(user);
  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      accountStatus: user.accountStatus,
      profile: user.profile,
      assignedHotels
    }
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const { name, phone, city, country, preferences } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (city !== undefined) user.profile.city = city;
  if (country !== undefined) user.profile.country = country;
  if (Array.isArray(preferences)) user.profile.preferences = preferences;
  await user.save();
  res.status(200).json({ success: true, message: 'Profile updated.', user });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user!._id).select('+passwordHash');
  if (!user) throw new ApiError(404, 'User not found.', 'NOT_FOUND');
  const valid = await user.comparePassword(currentPassword);
  if (!valid) throw new ApiError(400, 'Current password is incorrect.', 'INVALID_PASSWORD');
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  res.status(200).json({ success: true, message: 'Password updated.' });
});

import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { env } from '../config/env';

export interface JwtPayloadData {
  sub: string;
  role: 'guest' | 'staff' | 'manager' | 'admin';
  email: string;
}

export const AUTH_COOKIE_NAME = 'hotelpro_token';

export function signAuthToken(payload: JwtPayloadData): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']
  });
}

export function verifyAuthToken(token: string): JwtPayloadData {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayloadData;
}

export function attachAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? 'none' : 'lax',
    path: '/'
  });
}

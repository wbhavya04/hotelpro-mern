import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new ApiError(404, `Endpoint not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));
}

export function globalErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {})
    });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      success: false,
      code: 'DB_VALIDATION_ERROR',
      message: Object.values(err.errors).map((e) => e.message).join('; ')
    });
    return;
  }

  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: number }).code === 11000) {
    res.status(409).json({
      success: false,
      code: 'DUPLICATE_RESOURCE',
      message: 'A record with the provided unique identifier already exists.'
    });
    return;
  }

  if (!env.isTest) {
    console.error('[HotelPro Unhandled Error]:', err);
  }

  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected server error occurred. Please try again later.'
  });
}

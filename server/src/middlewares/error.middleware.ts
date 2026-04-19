import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { captureException } from '../config/sentry';
import { env } from '../config/env';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    console.error('[ErrorHandler] ApiError:', err.statusCode, err.message, JSON.stringify(err.errors));
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: Object.keys(err.errors).length > 0 ? err.errors : undefined,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    console.error('[ErrorHandler] Mongoose ValidationError:', err.message);
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.message,
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // Mongoose duplicate key error
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    res.status(409).json({
      success: false,
      message: 'Duplicate entry',
      ...(env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
    return;
  }

  // Default 500 — report to Sentry
  captureException(err);
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    // In development, surface the real error message so the client toast can show it.
    // In production we hide internals to avoid leaking implementation details.
    message: env.NODE_ENV === 'development' ? (err.message || 'Internal server error') : 'Internal server error',
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

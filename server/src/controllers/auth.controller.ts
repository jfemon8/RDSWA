import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../utils/ApiResponse';
import { asyncHandler } from '../utils/asyncHandler';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.register(req.body);
  ApiResponse.created(res, {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  }, 'Registration successful. Please verify your email.');
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, tokens } = await authService.login(req.body, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  // Set refresh token as httpOnly cookie
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict', // 'none' needed for cross-origin (Vercel↔Render)
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  ApiResponse.success(res, {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      isEmailVerified: user.isEmailVerified,
      membershipStatus: user.membershipStatus,
    },
    accessToken: tokens.accessToken,
  }, 'Login successful');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  if (req.user && refreshToken) {
    await authService.logout((req.user._id as any).toString(), refreshToken);
  }
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
  });
  ApiResponse.success(res, null, 'Logged out successfully');
});

export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken || req.body.refreshToken;
  if (!token) {
    return ApiResponse.success(res, null, 'No refresh token provided');
  }

  const tokens = await authService.refreshToken(token);

  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('refreshToken', tokens.refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  ApiResponse.success(res, { accessToken: tokens.accessToken }, 'Token refreshed');
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  await authService.verifyEmail(req.body.token);
  ApiResponse.success(res, null, 'Email verified successfully');
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email);
  ApiResponse.success(res, null, 'If that email exists, a reset link has been sent');
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.body.token, req.body.password);
  ApiResponse.success(res, null, 'Password reset successful');
});

export const verifyOtp = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.verifyOtp(req.body.email, req.body.otp);
  ApiResponse.success(res, { _id: user._id, email: user.email }, 'OTP verified');
});

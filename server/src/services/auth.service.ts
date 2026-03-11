import { User, IUserDocument, LoginHistory, ChatGroup } from '../models';
import { ApiError } from '../utils/ApiError';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateRandomToken,
  generateOTP,
} from '../utils/token';
import { SUPER_ADMIN_EMAILS } from '../config/constants';
import { UserRole, ROLE_HIERARCHY } from '@rdswa/shared';
import { sendEmail } from '../config/mail';
import { env } from '../config/env';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<IUserDocument> {
    const existing = await User.findOne({ email: input.email });
    if (existing) {
      throw ApiError.conflict('Email is already registered');
    }

    // Determine initial role
    let role = UserRole.USER;
    if (SUPER_ADMIN_EMAILS.includes(input.email)) {
      role = UserRole.SUPER_ADMIN;
    }

    const emailVerificationToken = generateRandomToken();
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await User.create({
      ...input,
      role,
      emailVerificationToken,
      emailVerificationExpiry,
    });

    // Send verification email
    const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${emailVerificationToken}`;
    await sendEmail(
      user.email,
      'Verify your RDSWA account',
      `<h2>Welcome to RDSWA!</h2>
       <p>Hello ${user.name},</p>
       <p>Please verify your email by clicking the link below:</p>
       <a href="${verifyUrl}">${verifyUrl}</a>
       <p>This link expires in 24 hours.</p>`
    ).catch((err) => console.error('Email send error:', err));

    return user;
  }

  async login(
    input: LoginInput,
    meta: { ip?: string; userAgent?: string }
  ): Promise<{ user: IUserDocument; tokens: AuthTokens }> {
    const user = await User.findOne({ email: input.email }).select('+password +refreshTokens');
    if (!user || user.isDeleted) {
      await this.logLogin(null, meta, false, 'User not found');
      throw ApiError.unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      await this.logLogin(user._id as any, meta, false, 'Account deactivated');
      throw ApiError.unauthorized('Your account has been deactivated');
    }

    const isMatch = await user.comparePassword(input.password);
    if (!isMatch) {
      await this.logLogin(user._id as any, meta, false, 'Wrong password');
      throw ApiError.unauthorized('Invalid email or password');
    }

    // SuperAdmin check
    if (SUPER_ADMIN_EMAILS.includes(user.email) && user.role !== UserRole.SUPER_ADMIN) {
      user.role = UserRole.SUPER_ADMIN;
    }

    const tokens = this.generateTokens(user);

    // Store refresh token
    user.refreshTokens.push(tokens.refreshToken);
    // Keep only last 5 refresh tokens
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    user.lastLogin = new Date();
    await user.save();

    await this.logLogin(user._id as any, meta, true);

    // Auto-join Admin/SuperAdmin to all existing groups with admin access
    const roleIdx = ROLE_HIERARCHY.indexOf(user.role as UserRole);
    const adminIdx = ROLE_HIERARCHY.indexOf(UserRole.ADMIN);
    if (roleIdx >= adminIdx) {
      ChatGroup.updateMany(
        { isDeleted: false, members: { $ne: user._id } },
        { $addToSet: { members: user._id, admins: user._id } }
      ).exec().catch(() => { /* non-blocking */ });
    }

    return { user, tokens };
  }

  async refreshToken(token: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const user = await User.findById(payload.userId).select('+refreshTokens');
    if (!user || user.isDeleted || !user.isActive) {
      throw ApiError.unauthorized('User not found');
    }

    if (!user.refreshTokens.includes(token)) {
      // Possible token reuse — invalidate all tokens
      user.refreshTokens = [];
      await user.save();
      throw ApiError.unauthorized('Refresh token reuse detected');
    }

    // Rotate refresh token
    const newTokens = this.generateTokens(user);
    user.refreshTokens = user.refreshTokens.filter((t) => t !== token);
    user.refreshTokens.push(newTokens.refreshToken);
    await user.save();

    return newTokens;
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $pull: { refreshTokens: refreshToken },
    });
  }

  async verifyEmail(token: string): Promise<void> {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() },
    });

    if (!user) {
      throw ApiError.badRequest('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return;
    }

    const resetToken = generateRandomToken();
    user.passwordResetToken = resetToken;
    user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save();

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;
    await sendEmail(
      user.email,
      'Reset your RDSWA password',
      `<h2>Password Reset</h2>
       <p>Hello ${user.name},</p>
       <p>Click the link below to reset your password:</p>
       <a href="${resetUrl}">${resetUrl}</a>
       <p>This link expires in 1 hour.</p>`
    ).catch((err) => console.error('Email send error:', err));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpiry: { $gt: new Date() },
    });

    if (!user) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    user.refreshTokens = []; // Invalidate all sessions
    await user.save();
  }

  async verifyOtp(email: string, otp: string): Promise<IUserDocument> {
    const user = await User.findOne({
      email,
      otp,
      otpExpiry: { $gt: new Date() },
    });

    if (!user) {
      throw ApiError.badRequest('Invalid or expired OTP');
    }

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.isEmailVerified = true;
    await user.save();

    return user;
  }

  private generateTokens(user: IUserDocument): AuthTokens {
    const accessToken = signAccessToken({
      userId: (user._id as any).toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      userId: (user._id as any).toString(),
    });

    return { accessToken, refreshToken };
  }

  private async logLogin(
    userId: any,
    meta: { ip?: string; userAgent?: string },
    success: boolean,
    failureReason?: string
  ): Promise<void> {
    if (!userId) return;
    await LoginHistory.create({
      user: userId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      success,
      failureReason,
    }).catch((err) => console.error('Login history error:', err));
  }
}

export const authService = new AuthService();

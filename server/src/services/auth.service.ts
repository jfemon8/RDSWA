import { User, IUserDocument, LoginHistory, ChatGroup } from '../models';
import { isSuperAdminUser, syncUserDepartmentGroups } from './departmentGroup.service';
import { seatSuperAdminEverywhere } from './groupMembership.service';
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
import { renderEmailLayout, getAppUrl, getCanonicalAppUrl } from '../utils/emailTemplate';
import { ensureCentralGroup } from '../jobs/groupInitializer';

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
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(input.email);
    if (isSuperAdmin) {
      role = UserRole.SUPER_ADMIN;
    }

    const emailVerificationToken = generateRandomToken();
    const emailVerificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await User.create({
      ...input,
      role,
      emailVerificationToken,
      emailVerificationExpiry,
      ...(isSuperAdmin && {
        membershipStatus: 'approved',
        isModerator: true,
        isEmailVerified: true,
      }),
    });

    // SuperAdmin is auto-approved so joins the central group at registration, while regular users join once membership is approved.
    if (isSuperAdmin) {
      ensureCentralGroup()
        .then(() => seatSuperAdminEverywhere(user._id as any))
        .catch(() => {});
    }

    // Send verification email
    const buttonUrl = `${getAppUrl()}/verify-email?token=${emailVerificationToken}`;
    const fallbackUrl = `${getCanonicalAppUrl()}/verify-email?token=${emailVerificationToken}`;
    const html = await renderEmailLayout({
      heading: 'Welcome to RDSWA!',
      preheader: 'Verify your email to activate your RDSWA account.',
      greeting: `Hello ${user.name},`,
      intro: 'Thanks for joining RDSWA. Please verify your email address by clicking the button below:',
      cta: { label: 'Verify Email', url: buttonUrl },
      fallbackUrl,
      footerNote:
        'This link expires in 24 hours. If you didn\'t create an RDSWA account, you can safely ignore this email.',
    });
    await sendEmail(
      user.email,
      'Verify your RDSWA account',
      html
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

    // SuperAdmin check: ensure role + flags are always correct
    if (SUPER_ADMIN_EMAILS.includes(user.email)) {
      user.role = UserRole.SUPER_ADMIN;
      user.membershipStatus = 'approved' as any;
      user.isModerator = true;
      user.isEmailVerified = true;
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

    // Only a SuperAdmin is seated in every group; no lower rank earns a seat anywhere it is not a member.
    if (isSuperAdminUser(user)) {
      seatSuperAdminEverywhere(user._id as any).catch(() => { /* non-blocking */ });
    } else {
      syncUserDepartmentGroups(user._id as any).catch(() => { /* non-blocking */ });
    }

    return { user, tokens };
  }

  /** Rotate a refresh token via an atomic compare-and-swap, with a short grace window so concurrent refreshes all receive the same replacement. */
  async refreshToken(token: string): Promise<AuthTokens> {
    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const user = await User.findById(payload.userId).select(
      '+refreshTokens +recentlyRotated'
    );
    if (!user || user.isDeleted || !user.isActive) {
      throw ApiError.unauthorized('User not found');
    }

    const GRACE_MS = 30 * 1000; // 30s overlap window for concurrent refreshes
    const MAX_ACTIVE = 5; // cap per-user concurrent sessions
    const MAX_HISTORY = 10; // cap rotation history entries
    const now = new Date();
    const newTokens = this.generateTokens(user);
    const cutoff = new Date(now.getTime() - GRACE_MS);

    // A pipeline update gives a single-document compare-and-swap, which mixed `$pull`/`$push` cannot do on the same array path.
    const rotated = await User.findOneAndUpdate(
      { _id: user._id, refreshTokens: token },
      [
        {
          $set: {
            refreshTokens: {
              $concatArrays: [
                {
                  $filter: {
                    input: { $ifNull: ['$refreshTokens', []] },
                    cond: { $ne: ['$$this', token] },
                  },
                },
                [newTokens.refreshToken],
              ],
            },
            recentlyRotated: {
              $concatArrays: [
                { $ifNull: ['$recentlyRotated', []] },
                [
                  {
                    token,
                    replacedBy: newTokens.refreshToken,
                    rotatedAt: now,
                  },
                ],
              ],
            },
          },
        },
      ],
      { new: true }
    ).select('+refreshTokens +recentlyRotated');

    if (rotated) {
      // Best-effort trim of active sessions and aged-out rotation entries, re-enforced on the next rotation if it fails.
      const fresh = rotated as IUserDocument;
      const liveHistory = (fresh.recentlyRotated || []).filter(
        (r) => r.rotatedAt && r.rotatedAt > cutoff
      );
      const overActive = fresh.refreshTokens.length > MAX_ACTIVE;
      const overHistory = (fresh.recentlyRotated || []).length > MAX_HISTORY;
      if (overActive || overHistory) {
        await User.findByIdAndUpdate(fresh._id, {
          $set: {
            refreshTokens: fresh.refreshTokens.slice(-MAX_ACTIVE),
            recentlyRotated: liveHistory.slice(-MAX_HISTORY),
          },
        });
      }
      return newTokens;
    }

    // CAS lost, so re-read and decide between a concurrent refresh and genuine reuse.
    const fresh = await User.findById(user._id).select(
      '+refreshTokens +recentlyRotated'
    );
    if (!fresh) throw ApiError.unauthorized('User not found');

    const graceEntry = (fresh.recentlyRotated || []).find(
      (r) => r.token === token && r.rotatedAt && r.rotatedAt > cutoff
    );

    if (graceEntry && fresh.refreshTokens.includes(graceEntry.replacedBy)) {
      // Concurrent-refresh path, so return the same replacement to keep cookies coherent.
      const accessToken = signAccessToken({
        userId: (fresh._id as any).toString(),
        email: fresh.email,
        role: fresh.role,
      });
      return { accessToken, refreshToken: graceEntry.replacedBy };
    }

    // Genuine reuse of an unknown or already-rotated token, so wipe the whole family.
    await User.findByIdAndUpdate(user._id, {
      $set: { refreshTokens: [], recentlyRotated: [] },
    });
    throw ApiError.unauthorized('Refresh token reuse detected');
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

    // CLIENT_URL is a comma-separated CORS allowlist, so pick concrete URLs for the email link.
    const buttonUrl = `${getAppUrl()}/reset-password?token=${resetToken}`;
    const fallbackUrl = `${getCanonicalAppUrl()}/reset-password?token=${resetToken}`;

    const html = await renderEmailLayout({
      heading: 'Password Reset',
      preheader: 'Reset your RDSWA password, link expires in 1 hour.',
      greeting: `Hello ${user.name},`,
      intro: 'Please click the button below to reset your password:',
      cta: { label: 'Reset Password', url: buttonUrl },
      fallbackUrl,
      footerNote:
        'This link expires in 1 hour. If you didn\'t request a password reset, please ignore this email, your account is safe.',
    });

    // Persist the token and return immediately rather than blocking the response on a slow or throttled SMTP send.
    void sendEmail(
      user.email,
      'Reset your RDSWA password',
      html
    ).catch((err: any) => {
      console.error(
        `[forgotPassword] Email send failed to ${user.email}:`,
        err?.code || '',
        err?.message || err
      );
    });
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

  /** Change an authenticated user's password and invalidate existing refresh tokens so other sessions log out. */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await User.findById(userId).select('+password +refreshTokens');
    if (!user) throw ApiError.notFound('User not found');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

    if (currentPassword === newPassword) {
      throw ApiError.badRequest('New password must be different from current');
    }

    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();
  }

  async sendOtp(email: string): Promise<void> {
    const user = await User.findOne({ email, isDeleted: false });
    if (!user) {
      // Don't reveal whether user exists
      return;
    }

    if (user.isEmailVerified) {
      throw ApiError.badRequest('Email is already verified');
    }

    const otp = generateOTP(6);
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    const html = await renderEmailLayout({
      heading: 'Email Verification',
      preheader: `Your RDSWA verification code: ${otp}`,
      greeting: `Hello ${user.name},`,
      intro: 'Use the verification code below to confirm your email address:',
      code: otp,
      footerNote:
        'This code expires in 10 minutes. If you didn\'t request this, please ignore this email.',
    });
    await sendEmail(
      user.email,
      'RDSWA Email Verification OTP',
      html
    ).catch((err) => console.error('OTP email send error:', err));
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

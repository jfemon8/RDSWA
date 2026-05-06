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

    // SuperAdmin is auto-approved on registration → add to central group immediately.
    // Regular users are added to the central group only after their membership is approved
    // by an admin (handled in userService.approveMembership).
    if (isSuperAdmin) {
      ensureCentralGroup().then(() => {
        ChatGroup.findOneAndUpdate(
          { type: 'central', isDeleted: false },
          { $addToSet: { members: user._id, admins: user._id } }
        ).exec().catch(() => {});
      }).catch(() => {});
    }

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

    // SuperAdmin check — ensure role + flags are always correct
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

  /**
   * Rotates a refresh token. Designed to be safe under concurrent refresh
   * requests carrying the *same* old token — a common pattern when the
   * access token expires and the SPA fires several parallel API calls that
   * all 401 at once.
   *
   * Strategy:
   *  1. Verify the JWT signature.
   *  2. Atomic compare-and-swap (CAS) via findOneAndUpdate filtered on the
   *     old token's presence. Exactly one concurrent caller wins and rotates.
   *  3. Losing callers fall back to a short grace window: if the same old
   *     token was rotated within the last few seconds and its replacement
   *     is still active, we return that replacement idempotently — both the
   *     winner and the losers therefore see the same new refresh token, and
   *     whichever Set-Cookie response the browser keeps is internally
   *     consistent.
   *  4. Outside the grace window, an unknown token means a genuine reuse
   *     (likely theft) — wipe all sessions, force re-auth.
   */
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

    // Atomic rotate via an aggregation-pipeline update. Two reasons we use
    // a pipeline rather than `$pull` + `$push`:
    //   1. Mongo rejects mixed `$pull`/`$push` on the same array path
    //      ("Updating the path 'refreshTokens' would create a conflict").
    //   2. The pipeline gives us a single-document atomic compare-and-swap:
    //      the filter requires the old token to be present, and Mongo
    //      serialises concurrent writes to the same document — so exactly
    //      one of the racing callers will see the document still matching
    //      and win the rotation. The losers' query no longer matches and
    //      they fall through to the grace-window branch below.
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
      // Trim active sessions to the most recent MAX_ACTIVE and prune
      // rotation entries that have aged out of the grace window. Best-effort
      // — if this update fails, the cap is enforced on the next rotation.
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

    // CAS lost. Two possibilities — re-read and decide.
    const fresh = await User.findById(user._id).select(
      '+refreshTokens +recentlyRotated'
    );
    if (!fresh) throw ApiError.unauthorized('User not found');

    const graceEntry = (fresh.recentlyRotated || []).find(
      (r) => r.token === token && r.rotatedAt && r.rotatedAt > cutoff
    );

    if (graceEntry && fresh.refreshTokens.includes(graceEntry.replacedBy)) {
      // Concurrent-refresh path: another caller just rotated this very
      // token. Return the same replacement so cookies stay coherent.
      const accessToken = signAccessToken({
        userId: (fresh._id as any).toString(),
        email: fresh.email,
        role: fresh.role,
      });
      return { accessToken, refreshToken: graceEntry.replacedBy };
    }

    // Genuine reuse: unknown token, or its replacement was already rotated
    // out. Treat as compromise — wipe the family.
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

    const resetUrl = `${env.CLIENT_URL}/reset-password?token=${resetToken}`;

    // Don't block the API response on SMTP. If Gmail is slow, throttling,
    // or the App Password has been revoked, the user previously waited
    // up to 10 minutes for a reset request to complete (Nodemailer's
    // default socket timeout). Now: persist the token, return a 200
    // immediately, and let the email send in the background. Failures
    // are logged with enough detail to diagnose (recipient + error code).
    void sendEmail(
      user.email,
      'Reset your RDSWA password',
      `<h2>Password Reset</h2>
       <p>Hello ${user.name},</p>
       <p>Click the link below to reset your password:</p>
       <a href="${resetUrl}">${resetUrl}</a>
       <p>This link expires in 1 hour.</p>`
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

  /**
   * Change password for an authenticated user. Verifies the current password,
   * updates to the new one, and invalidates existing refresh tokens so other
   * sessions are logged out — a standard security hygiene step after a
   * password rotation.
   */
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

    await sendEmail(
      user.email,
      'RDSWA Email Verification OTP',
      `<h2>Email Verification</h2>
       <p>Hello ${user.name},</p>
       <p>Your OTP for email verification is:</p>
       <h1 style="letter-spacing: 8px; font-size: 32px; text-align: center; padding: 16px; background: #f5f5f5; border-radius: 8px;">${otp}</h1>
       <p>This OTP expires in 10 minutes.</p>
       <p>If you did not request this, please ignore this email.</p>`
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

import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/token';
import { ApiError } from '../utils/ApiError';
import { User, IUserDocument } from '../models';
import { SUPER_ADMIN_EMAILS } from '../config/constants';
import { UserRole } from '@rdswa/shared';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      tokenPayload?: AccessTokenPayload;
    }
  }
}

/**
 * Auth middleware — verifies JWT and attaches user to request.
 * If `optional` is true, allows unauthenticated access (for public routes).
 */
export function authenticate(optional = false) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

      if (!token) {
        if (optional) return next();
        throw ApiError.unauthorized('Access token is required');
      }

      let payload: AccessTokenPayload;
      try {
        payload = verifyAccessToken(token);
      } catch {
        if (optional) return next();
        throw ApiError.unauthorized('Invalid or expired access token');
      }

      const user = await User.findById(payload.userId);
      if (!user || user.isDeleted || !user.isActive) {
        throw ApiError.unauthorized('User not found or deactivated');
      }

      // SuperAdmin auto-detection — ensure role + flags are always correct
      if (SUPER_ADMIN_EMAILS.includes(user.email)) {
        let needsSave = false;
        if (user.role !== UserRole.SUPER_ADMIN) { user.role = UserRole.SUPER_ADMIN; needsSave = true; }
        if (user.membershipStatus !== 'approved') { user.membershipStatus = 'approved' as any; needsSave = true; }
        if (!user.isModerator) { user.isModerator = true; needsSave = true; }
        if (!user.isEmailVerified) { user.isEmailVerified = true; needsSave = true; }
        if (needsSave) await user.save();
      }

      req.user = user;
      req.tokenPayload = payload;
      next();
    } catch (error) {
      next(error);
    }
  };
}

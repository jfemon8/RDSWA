import { Request, Response, NextFunction } from 'express';
import { UserRole, ROLE_HIERARCHY, PERMISSIONS } from '@rdswa/shared';
import { ApiError } from '../utils/ApiError';

/**
 * Authorize by specific roles.
 * Usage: authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    const userRole = req.user.role as UserRole;

    // SuperAdmin always passes
    if (userRole === UserRole.SUPER_ADMIN) {
      return next();
    }

    // Suspended users cannot access any protected resource
    if ((req.user as any).membershipStatus === 'suspended') {
      return next(ApiError.forbidden('Your account has been suspended. Please contact an admin.'));
    }

    // Check if user's role is in the allowed list
    if (allowedRoles.includes(userRole)) {
      return next();
    }

    // Check if user's role is higher in hierarchy than any allowed role
    const userRoleIndex = ROLE_HIERARCHY.indexOf(userRole);
    const minRequiredIndex = Math.min(
      ...allowedRoles.map((r) => ROLE_HIERARCHY.indexOf(r))
    );

    if (userRoleIndex >= minRequiredIndex) {
      return next();
    }

    next(ApiError.forbidden('You do not have permission to perform this action'));
  };
}

/**
 * Check permission by module:action key.
 * Usage: hasPermission('events', 'create')
 */
export function hasPermission(module: string, action: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }

    const userRole = req.user.role as UserRole;

    // SuperAdmin always passes
    if (userRole === UserRole.SUPER_ADMIN) {
      return next();
    }

    const key = `${module}:${action}`;
    const allowedRoles = PERMISSIONS[key];

    if (!allowedRoles) {
      // If no permission defined, deny by default
      return next(ApiError.forbidden('Permission not configured'));
    }

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    next(ApiError.forbidden('You do not have permission to perform this action'));
  };
}

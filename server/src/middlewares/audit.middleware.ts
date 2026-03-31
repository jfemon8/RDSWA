import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models';

/**
 * Audit logging middleware — logs CRUD operations after response.
 * Usage: auditLog('user.approve')
 */
export function auditLog(action: string, resource: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Hook into response finish event to log after response is sent
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      // Only log successful mutations (2xx status for POST/PATCH/PUT/DELETE)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.method !== 'GET') {
        AuditLog.create({
          actor: req.user?._id,
          action,
          resource,
          resourceId: req.params.id || body?.data?._id,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          changes: req.body && Object.keys(req.body).length > 0 ? req.body : undefined,
        }).catch((err) => console.error('Audit log error:', err));
      }

      return originalJson(body);
    };

    next();
  };
}

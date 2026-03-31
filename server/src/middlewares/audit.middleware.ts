import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models';
import requestIp from 'request-ip';

/**
 * Extract real client IP from request.
 * Uses request-ip which checks 15+ headers:
 * x-client-ip, x-forwarded-for, cf-connecting-ip (Cloudflare),
 * fastly-client-ip, x-real-ip, x-cluster-client-ip,
 * x-forwarded, forwarded-for, forwarded, and more.
 * Works behind any proxy/CDN (Vercel, Render, Cloudflare, AWS, nginx).
 */
function getClientIp(req: Request): string {
  return requestIp.getClientIp(req) || req.ip || 'unknown';
}

/**
 * Audit logging middleware — logs CRUD operations after response.
 * Usage: auditLog('user.approve')
 */
export function auditLog(action: string, resource: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = getClientIp(req);
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.method !== 'GET') {
        AuditLog.create({
          actor: req.user?._id,
          action,
          resource,
          resourceId: req.params.id || body?.data?._id,
          ip: clientIp,
          userAgent: req.headers['user-agent'],
          changes: req.body && Object.keys(req.body).length > 0 ? { after: req.body } : undefined,
        }).catch((err) => console.error('Audit log error:', err));
      }

      return originalJson(body);
    };

    next();
  };
}

export { getClientIp };

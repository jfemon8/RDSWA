import { Request, Response, NextFunction } from 'express';
import { getRedis } from '../config/redis';

/** Redis response cache for GET requests on public, read-heavy endpoints, held for the given TTL. */
export function cacheResponse(ttlSeconds: number = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const redis = getRedis();
    if (!redis || req.method !== 'GET') return next();

    const cacheKey = `api:${req.originalUrl}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        res.set('X-Cache', 'HIT');
        return res.json(data);
      }
    } catch {
      // Cache read failed, proceed normally
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && redis) {
        redis.setex(cacheKey, ttlSeconds, JSON.stringify(body)).catch(() => {});
      }
      res.set('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}

/** Invalidate cache entries matching a prefix, to call after writes on cached resources. */
export async function invalidateCachePrefix(prefix: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const keys = await redis.keys(`api:${prefix}*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {
    // Silently ignore cache invalidation errors
  }
}

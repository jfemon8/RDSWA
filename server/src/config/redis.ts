import Redis from 'ioredis';
import { env } from './env';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  return redis;
}

export async function connectRedis(): Promise<void> {
  if (!env.REDIS_URL) {
    console.warn('REDIS_URL not set — running without Redis (in-memory fallback)');
    return;
  }

  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null; // stop retrying after 5 attempts
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  redis.on('connect', () => {
    console.log('Redis connected');
  });

  try {
    await redis.connect();
  } catch (err) {
    console.error('Failed to connect to Redis — falling back to in-memory');
    redis.disconnect();
    redis = null;
  }
}

/** Cache helper: get cached value or compute & store it */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  if (!redis) return compute();

  const hit = await redis.get(key);
  if (hit) return JSON.parse(hit) as T;

  const value = await compute();
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
  return value;
}

/** Invalidate one or more cache keys (supports glob patterns) */
export async function invalidateCache(...patterns: string[]): Promise<void> {
  if (!redis) return;

  for (const pattern of patterns) {
    if (pattern.includes('*')) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) await redis.del(...keys);
    } else {
      await redis.del(pattern);
    }
  }
}

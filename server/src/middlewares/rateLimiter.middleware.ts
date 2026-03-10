import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getRedis } from '../config/redis';

function createStore(prefix: string) {
  const redis = getRedis();
  if (!redis) return undefined; // falls back to in-memory

  return new RedisStore({
    sendCommand: (...args: string[]) =>
      redis.call(args[0], ...args.slice(1)) as never,
    prefix: `rl:${prefix}:`,
  });
}

/** General API rate limiter: 100 requests per 15 minutes */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('api'),
  message: { success: false, message: 'Too many requests, please try again later' },
});

/** Auth rate limiter: 20 requests per 15 minutes */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createStore('auth'),
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});

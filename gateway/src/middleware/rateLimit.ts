import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { createClient } from 'redis';
import { AuthenticatedRequest } from '@/types';
import { sendRateLimit } from '@/utils/response';
import { logRateLimit } from '@/utils/logger';
import config from '@/config';

// Redis client for distributed rate limiting
let redisClient: any = null;

if (config.redis.url) {
  redisClient = createClient({
    url: config.redis.url,
    password: config.redis.password || undefined,
  });

  redisClient.on('error', (err: Error) => {
    console.error('Redis rate limit client error:', err);
  });

  redisClient.connect().catch(console.error);
}

/**
 * Create a custom rate limit store using Redis
 */
class RedisStore {
  private prefix: string;
  private client: any;

  constructor(prefix: string = 'rl:') {
    this.prefix = prefix;
    this.client = redisClient;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: Date }> {
    if (!this.client) {
      throw new Error('Redis client not available');
    }

    const fullKey = this.prefix + key;
    const now = Date.now();
    const resetTime = new Date(now + windowMs);

    try {
      const multi = this.client.multi();
      multi.incr(fullKey);
      multi.expire(fullKey, Math.ceil(windowMs / 1000));
      const results = await multi.exec();
      
      const count = results[0];
      
      return {
        count: count || 1,
        resetTime,
      };
    } catch (error) {
      console.error('Redis rate limit error:', error);
      throw error;
    }
  }

  async decrement(key: string): Promise<void> {
    if (!this.client) return;

    const fullKey = this.prefix + key;
    try {
      await this.client.decr(fullKey);
    } catch (error) {
      console.error('Redis rate limit decrement error:', error);
    }
  }

  async reset(key: string): Promise<void> {
    if (!this.client) return;

    const fullKey = this.prefix + key;
    try {
      await this.client.del(fullKey);
    } catch (error) {
      console.error('Redis rate limit reset error:', error);
    }
  }
}

/**
 * Generate rate limit key based on IP and user
 */
const generateKey = (req: AuthenticatedRequest): string => {
  const user = req.user;
  
  if (user?.id) {
    return `user:${user.id}`;
  }
  
  return `ip:${req.ip}`;
};

/**
 * Custom rate limit handler
 */
const rateLimitHandler = (req: AuthenticatedRequest, res: Response): void => {
  const remaining = parseInt(res.getHeader('X-RateLimit-Remaining') as string) || 0;
  const limit = parseInt(res.getHeader('X-RateLimit-Limit') as string) || 0;
  
  logRateLimit(req, limit, remaining);
  sendRateLimit(res, 'Too many requests, please try again later', req.requestId);
};

/**
 * Skip rate limiting for successful requests (optional)
 */
const skipSuccessfulRequests = (req: Request, res: Response): boolean => {
  return config.rateLimit.skipSuccessfulRequests && res.statusCode < 400;
};

/**
 * Default rate limiter
 */
export const defaultRateLimit = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  skip: skipSuccessfulRequests,
  ...(redisClient && {
    store: new RedisStore() as any,
  }),
});

/**
 * Authentication rate limiter (stricter for login attempts)
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => `auth:${req.ip}`,
  handler: (req: AuthenticatedRequest, res: Response) => {
    logRateLimit(req, 5, 0);
    sendRateLimit(res, 'Too many authentication attempts, please try again in 15 minutes', req.requestId);
  },
  ...(redisClient && {
    store: new RedisStore('auth:') as any,
  }),
});

/**
 * Search rate limiter
 */
export const searchRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 searches per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  message: 'Too many search requests, please try again in a minute',
  ...(redisClient && {
    store: new RedisStore('search:') as any,
  }),
});

/**
 * Payment rate limiter
 */
export const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 payment operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  message: 'Too many payment requests, please try again in a minute',
  ...(redisClient && {
    store: new RedisStore('payment:') as any,
  }),
});

/**
 * Upload rate limiter
 */
export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 uploads per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  message: 'Too many upload requests, please try again in a minute',
  ...(redisClient && {
    store: new RedisStore('upload:') as any,
  }),
});

/**
 * Admin rate limiter (more lenient for admin operations)
 */
export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute for admin
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  ...(redisClient && {
    store: new RedisStore('admin:') as any,
  }),
});

/**
 * Create custom rate limiter
 */
export const createRateLimit = (
  windowMs: number,
  maxRequests: number,
  keyPrefix?: string,
  message?: string
) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: generateKey,
    handler: (req: AuthenticatedRequest, res: Response) => {
      logRateLimit(req, maxRequests, 0);
      sendRateLimit(res, message || 'Rate limit exceeded', req.requestId);
    },
    ...(redisClient && keyPrefix && {
      store: new RedisStore(keyPrefix) as any,
    }),
  });
};

/**
 * Dynamic rate limiter based on user subscription
 */
export const subscriptionBasedRateLimit = (req: AuthenticatedRequest, res: Response, next: any) => {
  const user = req.user;
  let maxRequests = config.rateLimit.maxRequests;

  // Adjust rate limits based on subscription plan
  if (user?.subscription) {
    switch (user.subscription.planType) {
      case 'BASIC':
        maxRequests = 500;
        break;
      case 'STANDARD':
        maxRequests = 1000;
        break;
      case 'PREMIUM':
        maxRequests = 2000;
        break;
      default:
        maxRequests = 100; // Free tier
    }
  }

  const dynamicRateLimit = createRateLimit(
    config.rateLimit.windowMs,
    maxRequests,
    'sub:',
    `Rate limit exceeded for your subscription plan`
  );

  return dynamicRateLimit(req, res, next);
};

/**
 * Burst rate limiter (allows short bursts but limits sustained usage)
 */
export const burstRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: generateKey,
  handler: rateLimitHandler,
  // Allow burst but with shorter windows
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  ...(redisClient && {
    store: new RedisStore('burst:') as any,
  }),
});

export default {
  defaultRateLimit,
  authRateLimit,
  searchRateLimit,
  paymentRateLimit,
  uploadRateLimit,
  adminRateLimit,
  createRateLimit,
  subscriptionBasedRateLimit,
  burstRateLimit,
};
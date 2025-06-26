import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '@/types';
import { sendInternalError } from '@/utils/response';
import { logRequest, logError } from '@/utils/logger';
import config from '@/config';

/**
 * Request ID middleware
 * Assigns a unique ID to each request for tracking
 */
export const requestId = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  req.requestId = req.headers['x-request-id'] as string || uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
};

/**
 * Request timing middleware
 * Tracks request start time for performance monitoring
 */
export const requestTiming = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  req.startTime = Date.now();
  next();
};

/**
 * Request logging middleware
 * Logs request details and response times
 */
export const requestLogging = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const originalSend = res.send;
  
  res.send = function(body: any) {
    const responseTime = Date.now() - (req.startTime || Date.now());
    logRequest(req, res, responseTime);
    return originalSend.call(this, body);
  };
  
  next();
};

/**
 * CORS middleware with dynamic origin
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = Array.isArray(config.cors.origin) 
      ? config.cors.origin 
      : [config.cors.origin];
    
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Request-ID',
    'X-API-Key',
    'Accept',
    'Origin',
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  maxAge: 86400, // 24 hours
});

/**
 * Security middleware
 */
export const securityMiddleware = config.security.helmetEnabled 
  ? helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  : (req: Request, res: Response, next: NextFunction) => next();

/**
 * Compression middleware
 */
export const compressionMiddleware = config.security.compressionEnabled 
  ? compression({
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        return compression.filter(req, res);
      },
      level: 6,
      threshold: 1024,
    })
  : (req: Request, res: Response, next: NextFunction) => next();

/**
 * Body parser middleware
 */
export const bodyParser = [
  express.json({ 
    limit: config.request.bodyParserLimit,
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }),
  express.urlencoded({ 
    extended: true, 
    limit: config.request.bodyParserLimit 
  }),
];

/**
 * Request size limiter
 */
export const requestSizeLimiter = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  const maxSize = parseInt(config.request.maxSize.replace(/[^\d]/g, ''), 10) * 1024 * 1024; // Convert MB to bytes
  
  if (contentLength > maxSize) {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: `Request entity too large. Maximum size is ${config.request.maxSize}`,
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  next();
};

/**
 * Request timeout middleware
 */
export const requestTimeout = (req: Request, res: Response, next: NextFunction): void => {
  const timeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: {
          code: 'REQUEST_TIMEOUT',
          message: 'Request timeout',
        },
        timestamp: new Date().toISOString(),
      });
    }
  }, config.request.timeout);

  res.on('finish', () => {
    clearTimeout(timeout);
  });

  res.on('close', () => {
    clearTimeout(timeout);
  });

  next();
};

/**
 * Health check endpoint middleware
 */
export const healthCheck = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === '/health' || req.path === '/ping') {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    });
    return;
  }
  next();
};

/**
 * Service name header middleware
 */
export const serviceHeaders = (req: Request, res: Response, next: NextFunction): void => {
  res.setHeader('X-Service', 'WatchFlixx-API-Gateway');
  res.setHeader('X-Version', config.apiVersion);
  next();
};

/**
 * IP trust middleware for proxies
 */
export const trustProxy = (req: Request, res: Response, next: NextFunction): void => {
  // Trust first proxy (for load balancers)
  req.app.set('trust proxy', 1);
  next();
};

/**
 * Error handling middleware
 */
export const errorHandler = (
  error: Error,
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  logError(error, req, 'Gateway Error Handler');

  if (res.headersSent) {
    return next(error);
  }

  // Handle specific error types
  if (error.name === 'SyntaxError' && 'body' in error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Invalid JSON in request body',
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
    return;
  }

  if (error.message === 'Not allowed by CORS') {
    res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ERROR',
        message: 'CORS policy violation',
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
    });
    return;
  }

  // Default error response
  sendInternalError(
    res,
    config.nodeEnv === 'production' 
      ? 'Internal server error' 
      : error.message,
    config.nodeEnv === 'development' ? { stack: error.stack } : undefined,
    req.requestId
  );
};

/**
 * 404 handler middleware
 */
export const notFoundHandler = (req: AuthenticatedRequest, res: Response): void => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
};

/**
 * API version middleware
 */
export const apiVersion = (version: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestedVersion = req.headers['x-api-version'] as string || config.apiVersion;
    
    if (requestedVersion !== version) {
      res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_API_VERSION',
          message: `API version ${requestedVersion} is not supported. Current version: ${version}`,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    next();
  };
};

/**
 * Request validation middleware
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Basic request validation
  const userAgent = req.headers['user-agent'];
  
  if (!userAgent) {
    res.status(400).json({
      success: false,
      error: {
        code: 'MISSING_USER_AGENT',
        message: 'User-Agent header is required',
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }
  
  next();
};

export default {
  requestId,
  requestTiming,
  requestLogging,
  corsMiddleware,
  securityMiddleware,
  compressionMiddleware,
  bodyParser,
  requestSizeLimiter,
  requestTimeout,
  healthCheck,
  serviceHeaders,
  trustProxy,
  errorHandler,
  notFoundHandler,
  apiVersion,
  validateRequest,
};
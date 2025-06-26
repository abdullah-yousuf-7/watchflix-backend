import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest } from '@/types';
import { sendUnauthorized, sendForbidden } from '@/utils/response';
import config from '@/config';
import logger from '@/utils/logger';

interface JwtPayload {
  id: string;
  email: string;
  profileId?: string;
  subscription?: {
    planType: string;
    status: string;
  };
  iat: number;
  exp: number;
}

/**
 * Extract JWT token from request headers
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }

  // Support both "Bearer token" and "token" formats
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return authHeader;
};

/**
 * Verify JWT token
 */
const verifyToken = (token: string): Promise<JwtPayload> => {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.jwt.secret, (err, decoded) => {
      if (err) {
        reject(err);
      } else {
        resolve(decoded as JwtPayload);
      }
    });
  });
};

/**
 * Authentication middleware
 * Verifies JWT token and attaches user info to request
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (!token) {
      sendUnauthorized(res, 'Authentication token required', req.requestId);
      return;
    }

    const decoded = await verifyToken(token);
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      profileId: decoded.profileId,
      subscription: decoded.subscription,
    };

    logger.debug('User authenticated', {
      userId: decoded.id,
      email: decoded.email,
      requestId: req.requestId,
    });

    next();
  } catch (error: any) {
    logger.warn('Authentication failed', {
      error: error.message,
      requestId: req.requestId,
      ip: req.ip,
    });

    if (error.name === 'TokenExpiredError') {
      sendUnauthorized(res, 'Token has expired', req.requestId);
    } else if (error.name === 'JsonWebTokenError') {
      sendUnauthorized(res, 'Invalid token', req.requestId);
    } else {
      sendUnauthorized(res, 'Authentication failed', req.requestId);
    }
  }
};

/**
 * Optional authentication middleware
 * Verifies token if present but doesn't require it
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    
    if (token) {
      const decoded = await verifyToken(token);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        profileId: decoded.profileId,
        subscription: decoded.subscription,
      };
    }

    next();
  } catch (error) {
    // Log the error but continue without authentication
    logger.debug('Optional authentication failed', {
      error: (error as Error).message,
      requestId: req.requestId,
    });
    next();
  }
};

/**
 * Subscription requirement middleware
 */
export const requireSubscription = (allowedPlans?: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'Authentication required', req.requestId);
      return;
    }

    const subscription = req.user.subscription;
    
    if (!subscription || subscription.status !== 'ACTIVE') {
      sendForbidden(res, 'Active subscription required', req.requestId);
      return;
    }

    if (allowedPlans && !allowedPlans.includes(subscription.planType)) {
      sendForbidden(res, `${allowedPlans.join(' or ')} subscription required`, req.requestId);
      return;
    }

    next();
  };
};

/**
 * Profile requirement middleware
 */
export const requireProfile = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    sendUnauthorized(res, 'Authentication required', req.requestId);
    return;
  }

  if (!req.user.profileId) {
    sendForbidden(res, 'Profile selection required', req.requestId);
    return;
  }

  next();
};

/**
 * Admin requirement middleware
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    sendUnauthorized(res, 'Authentication required', req.requestId);
    return;
  }

  // Check if user is admin (this would typically be stored in the JWT or checked against a service)
  // For now, we'll use a simple email check
  const adminEmails = ['admin@watchflixx.com'];
  
  if (!adminEmails.includes(req.user.email)) {
    sendForbidden(res, 'Admin access required', req.requestId);
    return;
  }

  next();
};

/**
 * Role-based access control middleware
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'Authentication required', req.requestId);
      return;
    }

    // In a real implementation, roles would be stored in the JWT or fetched from a service
    // For now, we'll implement basic role logic
    const userRole = req.user.email.includes('admin') ? 'admin' : 'user';
    
    if (!allowedRoles.includes(userRole)) {
      sendForbidden(res, `Access denied. Required roles: ${allowedRoles.join(', ')}`, req.requestId);
      return;
    }

    next();
  };
};

/**
 * IP whitelist middleware
 */
export const requireWhitelistedIP = (whitelistedIPs: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || '';
    
    if (!whitelistedIPs.includes(clientIP)) {
      logger.warn('Access denied for non-whitelisted IP', {
        ip: clientIP,
        requestId: req.requestId,
      });
      
      sendForbidden(res, 'Access denied', req.requestId);
      return;
    }

    next();
  };
};

/**
 * API key authentication middleware
 */
export const authenticateApiKey = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    sendUnauthorized(res, 'API key required', req.requestId);
    return;
  }

  // In a real implementation, validate API key against database
  const validApiKeys = [process.env.ADMIN_API_KEY, process.env.SERVICE_API_KEY].filter(Boolean);
  
  if (!validApiKeys.includes(apiKey)) {
    sendUnauthorized(res, 'Invalid API key', req.requestId);
    return;
  }

  next();
};

export default {
  authenticate,
  optionalAuth,
  requireSubscription,
  requireProfile,
  requireAdmin,
  requireRole,
  requireWhitelistedIP,
  authenticateApiKey,
};
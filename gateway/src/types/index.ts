import { Request, Response } from 'express';

// Extended Express Request interface
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    profileId?: string;
    subscription?: {
      planType: string;
      status: string;
    };
  };
  requestId?: string;
  startTime?: number;
}

// Service Health Status
export interface ServiceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  responseTime: number;
  lastChecked: Date;
  error?: string;
}

// Circuit Breaker State
export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  nextRetryTime?: Date;
}

// Load Balancer Service Instance
export interface ServiceInstance {
  id: string;
  url: string;
  health: ServiceHealth;
  weight: number;
  currentConnections: number;
}

// API Response Format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
  timestamp: string;
  requestId?: string;
  version: string;
}

// Error Types
export type ErrorType = 
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'RATE_LIMIT_ERROR'
  | 'INTERNAL_ERROR'
  | 'GATEWAY_TIMEOUT'
  | 'BAD_GATEWAY';

// Service Route Configuration
export interface ServiceRoute {
  path: string;
  target: string;
  methods: string[];
  auth: boolean;
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  timeout?: number;
  retries?: number;
  circuitBreaker?: boolean;
}

// Metrics Data
export interface MetricsData {
  requestCount: number;
  errorCount: number;
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  statusCodes: Record<string, number>;
  services: Record<string, {
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
  }>;
}

// Cache Configuration
export interface CacheConfig {
  ttl: number;
  key: string;
  tags?: string[];
}

// Proxy Options
export interface ProxyOptions {
  target: string;
  changeOrigin: boolean;
  timeout: number;
  retries: number;
  pathRewrite?: Record<string, string>;
  onProxyReq?: (proxyReq: any, req: Request, res: Response) => void;
  onProxyRes?: (proxyRes: any, req: Request, res: Response) => void;
  onError?: (err: Error, req: Request, res: Response) => void;
}

// Rate Limit Configuration
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

// Middleware Configuration
export interface MiddlewareConfig {
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  helmet: boolean;
  compression: boolean;
  bodyParser: {
    limit: string;
    extended: boolean;
  };
  rateLimit: RateLimitConfig;
}

export default {};
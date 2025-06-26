import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest, ProxyOptions } from '@/types';
import { handleProxyError } from '@/utils/response';
import logger from '@/utils/logger';
import { circuitBreakerManager } from './circuitBreaker';
import { loadBalancerManager } from './loadBalancer';
import config from '@/config';

export interface ServiceProxyConfig {
  serviceName: string;
  targetUrls: string[];
  pathRewrite?: Record<string, string>;
  timeout?: number;
  retryAttempts?: number;
  circuitBreaker?: boolean;
  loadBalancer?: boolean;
  headers?: Record<string, string>;
  removeHeaders?: string[];
}

export class ProxyService {
  private proxyMiddlewares = new Map<string, any>();

  /**
   * Create proxy middleware for a service
   */
  public createServiceProxy(serviceConfig: ServiceProxyConfig) {
    const {
      serviceName,
      targetUrls,
      pathRewrite = {},
      timeout = config.request.timeout,
      retryAttempts = config.loadBalancer.retryAttempts,
      circuitBreaker = true,
      loadBalancer = true,
      headers = {},
      removeHeaders = [],
    } = serviceConfig;

    // Setup load balancer if enabled
    const loadBalancerInstance = loadBalancer 
      ? loadBalancerManager.getLoadBalancer(serviceName, targetUrls)
      : null;

    // Setup circuit breaker if enabled
    const circuitBreakerInstance = circuitBreaker
      ? circuitBreakerManager.getCircuitBreaker(serviceName)
      : null;

    const proxyOptions: Options = {
      target: targetUrls[0], // Default target (will be overridden by router)
      changeOrigin: true,
      timeout,
      pathRewrite,
      
      // Custom router function for load balancing
      router: loadBalancerInstance ? (req: Request) => {
        const instance = loadBalancerInstance.getNextInstance();
        if (!instance) {
          throw new Error(`No healthy instances available for ${serviceName}`);
        }
        return instance.url;
      } : undefined,

      // Modify request headers
      onProxyReq: (proxyReq, req: AuthenticatedRequest, res) => {
        // Add custom headers
        Object.entries(headers).forEach(([key, value]) => {
          proxyReq.setHeader(key, value);
        });

        // Add service identification headers
        proxyReq.setHeader('X-Gateway-Service', serviceName);
        proxyReq.setHeader('X-Request-ID', req.requestId || '');
        proxyReq.setHeader('X-Forwarded-For', req.ip || '');
        proxyReq.setHeader('X-Real-IP', req.ip || '');

        // Forward user information if authenticated
        if (req.user) {
          proxyReq.setHeader('X-User-ID', req.user.id);
          proxyReq.setHeader('X-User-Email', req.user.email);
          if (req.user.profileId) {
            proxyReq.setHeader('X-Profile-ID', req.user.profileId);
          }
          if (req.user.subscription) {
            proxyReq.setHeader('X-Subscription-Plan', req.user.subscription.planType);
            proxyReq.setHeader('X-Subscription-Status', req.user.subscription.status);
          }
        }

        // Remove specified headers
        removeHeaders.forEach(header => {
          proxyReq.removeHeader(header);
        });

        // Log proxy request
        logger.debug('Proxying request', {
          service: serviceName,
          method: req.method,
          path: req.path,
          target: proxyReq.getHeader('host'),
          requestId: req.requestId,
        });
      },

      // Handle response modifications
      onProxyRes: (proxyRes, req: AuthenticatedRequest, res) => {
        // Add response headers
        res.setHeader('X-Proxied-By', 'WatchFlixx-Gateway');
        res.setHeader('X-Service-Name', serviceName);
        
        // Log proxy response
        logger.debug('Proxy response received', {
          service: serviceName,
          statusCode: proxyRes.statusCode,
          responseTime: Date.now() - (req.startTime || Date.now()),
          requestId: req.requestId,
        });
      },

      // Handle proxy errors
      onError: (err: any, req: AuthenticatedRequest, res: Response) => {
        logger.error('Proxy error', {
          service: serviceName,
          error: err.message,
          requestId: req.requestId,
          method: req.method,
          path: req.path,
        });

        // Handle circuit breaker
        if (circuitBreakerInstance && this.isServiceError(err)) {
          // Circuit breaker will handle this in the wrapper
        }

        // Send appropriate error response
        if (!res.headersSent) {
          handleProxyError(err, res, req.requestId);
        }
      },

      // Verify SSL certificates in production
      secure: config.nodeEnv === 'production',

      // Follow redirects
      followRedirects: true,

      // Additional options
      logLevel: config.nodeEnv === 'development' ? 'debug' : 'warn',
    };

    // Create the base proxy middleware
    const baseProxy = createProxyMiddleware(proxyOptions);

    // Wrap with circuit breaker if enabled
    const wrappedProxy = circuitBreakerInstance
      ? this.wrapWithCircuitBreaker(baseProxy, circuitBreakerInstance, serviceName)
      : baseProxy;

    this.proxyMiddlewares.set(serviceName, wrappedProxy);
    return wrappedProxy;
  }

  /**
   * Wrap proxy middleware with circuit breaker
   */
  private wrapWithCircuitBreaker(
    proxyMiddleware: any,
    circuitBreaker: any,
    serviceName: string
  ) {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        await circuitBreaker.execute(() => {
          return new Promise<void>((resolve, reject) => {
            // Override the onError handler to reject the promise
            const originalOnError = proxyMiddleware.onError;
            proxyMiddleware.onError = (err: Error) => {
              reject(err);
            };

            // Override the onProxyRes handler to resolve the promise
            const originalOnProxyRes = proxyMiddleware.onProxyRes;
            proxyMiddleware.onProxyRes = (proxyRes: any, proxyReq: any, proxyNext: any) => {
              if (originalOnProxyRes) {
                originalOnProxyRes(proxyRes, proxyReq, proxyNext);
              }
              resolve();
            };

            proxyMiddleware(req, res, (err?: Error) => {
              if (err) {
                reject(err);
              } else {
                resolve();
              }
            });
          });
        });
      } catch (error: any) {
        if (error.message.includes('Circuit breaker is OPEN')) {
          logger.warn('Circuit breaker is open', {
            service: serviceName,
            requestId: req.requestId,
          });
          
          if (!res.headersSent) {
            res.status(503).json({
              success: false,
              error: {
                code: 'SERVICE_UNAVAILABLE',
                message: `${serviceName} service is temporarily unavailable`,
              },
              timestamp: new Date().toISOString(),
              requestId: req.requestId,
            });
          }
        } else {
          next(error);
        }
      }
    };
  }

  /**
   * Check if error should trigger circuit breaker
   */
  private isServiceError(error: any): boolean {
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      (error.response && error.response.status >= 500)
    );
  }

  /**
   * Get proxy middleware for a service
   */
  public getServiceProxy(serviceName: string) {
    return this.proxyMiddlewares.get(serviceName);
  }

  /**
   * Create a custom proxy with advanced options
   */
  public createCustomProxy(options: ProxyOptions) {
    return createProxyMiddleware({
      target: options.target,
      changeOrigin: options.changeOrigin,
      timeout: options.timeout,
      pathRewrite: options.pathRewrite,
      onProxyReq: options.onProxyReq,
      onProxyRes: options.onProxyRes,
      onError: options.onError,
      secure: config.nodeEnv === 'production',
      followRedirects: true,
    });
  }

  /**
   * Create streaming proxy for large file transfers
   */
  public createStreamingProxy(serviceName: string, targetUrl: string) {
    return createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      ws: true, // Enable WebSocket proxying
      timeout: 0, // No timeout for streaming
      
      onProxyReq: (proxyReq, req: AuthenticatedRequest) => {
        proxyReq.setHeader('X-Gateway-Service', serviceName);
        proxyReq.setHeader('X-Request-ID', req.requestId || '');
        
        logger.debug('Streaming proxy request', {
          service: serviceName,
          method: req.method,
          path: req.path,
          requestId: req.requestId,
        });
      },

      onError: (err, req: AuthenticatedRequest, res) => {
        logger.error('Streaming proxy error', {
          service: serviceName,
          error: err.message,
          requestId: req.requestId,
        });

        if (!res.headersSent) {
          handleProxyError(err, res as Response, req.requestId);
        }
      },
    });
  }

  /**
   * Create WebSocket proxy for real-time features
   */
  public createWebSocketProxy(serviceName: string, targetUrl: string) {
    return createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      ws: true,
      
      onProxyReqWs: (proxyReq, req: AuthenticatedRequest) => {
        proxyReq.setHeader('X-Gateway-Service', serviceName);
        proxyReq.setHeader('X-Request-ID', req.requestId || '');
        
        logger.debug('WebSocket proxy connection', {
          service: serviceName,
          requestId: req.requestId,
        });
      },

      onError: (err, req: AuthenticatedRequest, res) => {
        logger.error('WebSocket proxy error', {
          service: serviceName,
          error: err.message,
          requestId: req.requestId,
        });
      },
    });
  }

  /**
   * Health check for all proxied services
   */
  public async checkServicesHealth(): Promise<Record<string, any>> {
    const healthStatuses: Record<string, any> = {};
    
    // Get load balancer health summaries
    const loadBalancerSummaries = loadBalancerManager.getAllHealthSummaries();
    for (const summary of loadBalancerSummaries) {
      healthStatuses[summary.serviceName] = summary;
    }

    // Get circuit breaker states
    const circuitBreakerStates = circuitBreakerManager.getAllStates();
    for (const [serviceName, state] of Object.entries(circuitBreakerStates)) {
      if (healthStatuses[serviceName]) {
        healthStatuses[serviceName].circuitBreaker = state;
      } else {
        healthStatuses[serviceName] = { circuitBreaker: state };
      }
    }

    return healthStatuses;
  }

  /**
   * Get proxy statistics
   */
  public getProxyStats() {
    return {
      services: Array.from(this.proxyMiddlewares.keys()),
      loadBalancerStats: loadBalancerManager.getAllStats(),
      circuitBreakerMetrics: circuitBreakerManager.getAllMetrics(),
    };
  }

  /**
   * Cleanup all proxy resources
   */
  public destroy(): void {
    this.proxyMiddlewares.clear();
    loadBalancerManager.destroyAll();
    circuitBreakerManager.destroyAll();
  }
}

// Global proxy service instance
export const proxyService = new ProxyService();

export default ProxyService;
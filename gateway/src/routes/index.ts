import { Router } from 'express';
import { proxyService } from '@/services/proxy';
import { authenticate, optionalAuth, requireSubscription, requireProfile } from '@/middleware/auth';
import { 
  defaultRateLimit, 
  authRateLimit, 
  searchRateLimit, 
  paymentRateLimit,
  subscriptionBasedRateLimit 
} from '@/middleware/rateLimit';
import config from '@/config';

const router = Router();

// Initialize service proxies
const initializeServiceProxies = () => {
  // Authentication Service Proxy
  const authProxy = proxyService.createServiceProxy({
    serviceName: 'auth',
    targetUrls: [config.services.auth],
    pathRewrite: {
      '^/api/v1/auth': '/v1'
    },
    circuitBreaker: true,
    loadBalancer: false, // Single instance for now
  });

  // Content Service Proxy
  const contentProxy = proxyService.createServiceProxy({
    serviceName: 'content',
    targetUrls: [config.services.content],
    pathRewrite: {
      '^/api/v1/content': '/v1'
    },
    circuitBreaker: true,
    loadBalancer: false,
  });

  // Streaming Service Proxy
  const streamingProxy = proxyService.createServiceProxy({
    serviceName: 'streaming',
    targetUrls: [config.services.streaming],
    pathRewrite: {
      '^/api/v1/streaming': '/v1'
    },
    circuitBreaker: true,
    loadBalancer: false,
    headers: {
      'X-Streaming-Gateway': 'true'
    }
  });

  // Payment Service Proxy
  const paymentProxy = proxyService.createServiceProxy({
    serviceName: 'payment',
    targetUrls: [config.services.payment],
    pathRewrite: {
      '^/api/v1/payment': '/v1'
    },
    circuitBreaker: true,
    loadBalancer: false,
    headers: {
      'X-Payment-Gateway': 'true'
    }
  });

  // Social Service Proxy (WebSocket + HTTP)
  const socialProxy = proxyService.createServiceProxy({
    serviceName: 'social',
    targetUrls: [config.services.social],
    pathRewrite: {
      '^/api/v1/social': '/v1'
    },
    circuitBreaker: true,
    loadBalancer: false,
  });

  // Analytics Service Proxy
  const analyticsProxy = proxyService.createServiceProxy({
    serviceName: 'analytics',
    targetUrls: [config.services.analytics],
    pathRewrite: {
      '^/api/v1/analytics': '/v1'
    },
    circuitBreaker: true,
    loadBalancer: false,
  });

  // Notification Service Proxy
  const notificationProxy = proxyService.createServiceProxy({
    serviceName: 'notification',
    targetUrls: [config.services.notification],
    pathRewrite: {
      '^/api/v1/notifications': '/v1'
    },
    circuitBreaker: true,
    loadBalancer: false,
  });

  return {
    authProxy,
    contentProxy,
    streamingProxy,
    paymentProxy,
    socialProxy,
    analyticsProxy,
    notificationProxy,
  };
};

// Initialize all proxies
const proxies = initializeServiceProxies();

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Public authentication routes (no auth required)
router.use('/auth/register', authRateLimit, proxies.authProxy);
router.use('/auth/login', authRateLimit, proxies.authProxy);
router.use('/auth/oauth/:provider', authRateLimit, proxies.authProxy);
router.use('/auth/forgot-password', authRateLimit, proxies.authProxy);
router.use('/auth/reset-password', authRateLimit, proxies.authProxy);
router.use('/auth/verify-email', authRateLimit, proxies.authProxy);

// Protected authentication routes (auth required)
router.use('/auth/refresh', defaultRateLimit, proxies.authProxy);
router.use('/auth/logout', authenticate, defaultRateLimit, proxies.authProxy);
router.use('/auth/me', authenticate, defaultRateLimit, proxies.authProxy);

// Profile management routes
router.use('/auth/profiles', authenticate, defaultRateLimit, proxies.authProxy);

// ============================================================================
// CONTENT DISCOVERY ROUTES
// ============================================================================

// Public content routes (no subscription required)
router.use('/content/catalog', optionalAuth, searchRateLimit, proxies.contentProxy);
router.use('/content/search', optionalAuth, searchRateLimit, proxies.contentProxy);
router.use('/content/trending', optionalAuth, defaultRateLimit, proxies.contentProxy);
router.use('/content/:id', optionalAuth, defaultRateLimit, proxies.contentProxy);
router.use('/content/:id/seasons', optionalAuth, defaultRateLimit, proxies.contentProxy);

// Content metadata routes (subscription required for detailed info)
router.use('/content/:id/details', 
  authenticate, 
  requireSubscription(), 
  subscriptionBasedRateLimit, 
  proxies.contentProxy
);

// ============================================================================
// STREAMING & PLAYBACK ROUTES
// ============================================================================

// All streaming routes require authentication and active subscription
router.use('/streaming/play/:contentId', 
  authenticate, 
  requireProfile,
  requireSubscription(), 
  subscriptionBasedRateLimit, 
  proxies.streamingProxy
);

// Progress and history routes
router.use('/streaming/progress', 
  authenticate, 
  requireProfile,
  subscriptionBasedRateLimit, 
  proxies.streamingProxy
);

router.use('/streaming/history', 
  authenticate, 
  requireProfile,
  defaultRateLimit, 
  proxies.streamingProxy
);

// Watchlist routes
router.use('/streaming/watchlist', 
  authenticate, 
  requireProfile,
  defaultRateLimit, 
  proxies.streamingProxy
);

// Rating and review routes
router.use('/streaming/rate', 
  authenticate, 
  requireProfile,
  defaultRateLimit, 
  proxies.streamingProxy
);

router.use('/streaming/review', 
  authenticate, 
  requireProfile,
  defaultRateLimit, 
  proxies.streamingProxy
);

// ============================================================================
// PAYMENT & SUBSCRIPTION ROUTES
// ============================================================================

// Public subscription plan routes
router.use('/payment/plans', defaultRateLimit, proxies.paymentProxy);

// Protected payment routes
router.use('/payment/subscriptions', 
  authenticate, 
  paymentRateLimit, 
  proxies.paymentProxy
);

router.use('/payment/subscription', 
  authenticate, 
  paymentRateLimit, 
  proxies.paymentProxy
);

router.use('/payment/methods', 
  authenticate, 
  paymentRateLimit, 
  proxies.paymentProxy
);

router.use('/payment/invoices', 
  authenticate, 
  defaultRateLimit, 
  proxies.paymentProxy
);

// Content rental routes
router.use('/payment/rentals', 
  authenticate, 
  paymentRateLimit, 
  proxies.paymentProxy
);

// ============================================================================
// SOCIAL FEATURES ROUTES
// ============================================================================

// All social routes require authentication and profile
router.use('/social/party', 
  authenticate, 
  requireProfile,
  requireSubscription(['STANDARD', 'PREMIUM']), // Party watch for Standard+ only
  defaultRateLimit, 
  proxies.socialProxy
);

// ============================================================================
// ANALYTICS ROUTES
// ============================================================================

// User analytics (requires authentication)
router.use('/analytics/user', 
  authenticate, 
  requireProfile,
  defaultRateLimit, 
  proxies.analyticsProxy
);

// Content analytics (admin only - implemented in the analytics service)
router.use('/analytics/content', 
  authenticate, 
  defaultRateLimit, 
  proxies.analyticsProxy
);

// ============================================================================
// NOTIFICATION ROUTES
// ============================================================================

// All notification routes require authentication
router.use('/notifications', 
  authenticate, 
  defaultRateLimit, 
  proxies.notificationProxy
);

// ============================================================================
// ADMIN ROUTES
// ============================================================================

// Admin routes for all services (admin auth implemented in each service)
router.use('/admin/auth', authenticate, defaultRateLimit, proxies.authProxy);
router.use('/admin/content', authenticate, defaultRateLimit, proxies.contentProxy);
router.use('/admin/analytics', authenticate, defaultRateLimit, proxies.analyticsProxy);
router.use('/admin/users', authenticate, defaultRateLimit, proxies.authProxy);
router.use('/admin/subscriptions', authenticate, defaultRateLimit, proxies.paymentProxy);

// ============================================================================
// HEALTH CHECK ROUTES
// ============================================================================

router.get('/health', async (req, res) => {
  try {
    const servicesHealth = await proxyService.checkServicesHealth();
    const stats = proxyService.getProxyStats();
    
    const allHealthy = Object.values(servicesHealth).every((service: any) => 
      service.healthyPercentage === 100 || service.healthy > 0
    );
    
    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      gateway: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: config.apiVersion,
      },
      services: servicesHealth,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Service-specific health checks
router.get('/health/:service', async (req, res) => {
  const serviceName = req.params.service;
  
  try {
    const servicesHealth = await proxyService.checkServicesHealth();
    const serviceHealth = servicesHealth[serviceName];
    
    if (!serviceHealth) {
      return res.status(404).json({
        status: 'not_found',
        message: `Service '${serviceName}' not found`,
        timestamp: new Date().toISOString(),
      });
    }
    
    const isHealthy = serviceHealth.healthyPercentage === 100 || serviceHealth.healthy > 0;
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: serviceHealth,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: `Health check failed for service '${serviceName}'`,
      timestamp: new Date().toISOString(),
    });
  }
});

// ============================================================================
// WEBSOCKET ROUTES (for Socket.IO)
// ============================================================================

// WebSocket proxy for Social Service (Party Watch)
const socialWebSocketProxy = proxyService.createWebSocketProxy(
  'social-ws',
  config.services.social
);

// Mount WebSocket proxy
router.use('/socket.io', socialWebSocketProxy);

export default router;
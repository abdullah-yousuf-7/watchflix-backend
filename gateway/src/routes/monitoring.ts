import { Router, Request, Response } from 'express';
import { monitoringService } from '@/services/monitoring';
import { proxyService } from '@/services/proxy';
import { circuitBreakerManager } from '@/services/circuitBreaker';
import { loadBalancerManager } from '@/services/loadBalancer';
import { sendSuccess, sendError } from '@/utils/response';
import { authenticateApiKey } from '@/middleware/auth';
import config from '@/config';

const router = Router();

// Middleware to require API key for monitoring endpoints
router.use(authenticateApiKey);

/**
 * Get aggregated metrics for all services
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = monitoringService.getAggregatedMetrics();
    sendSuccess(res, metrics, 'Metrics retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve metrics', error.message);
  }
});

/**
 * Get metrics for a specific service
 */
router.get('/metrics/:service', (req: Request, res: Response) => {
  try {
    const serviceName = req.params.service;
    const metrics = monitoringService.getServiceMetrics(serviceName);
    
    if (!metrics) {
      sendError(res, 404, 'NOT_FOUND_ERROR', `No metrics found for service: ${serviceName}`);
      return;
    }
    
    sendSuccess(res, metrics, `Metrics for ${serviceName} retrieved successfully`);
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve service metrics', error.message);
  }
});

/**
 * Get slow endpoints analysis
 */
router.get('/performance/slow-endpoints', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const slowEndpoints = monitoringService.getSlowEndpoints(limit);
    
    sendSuccess(res, slowEndpoints, 'Slow endpoints analysis retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve slow endpoints', error.message);
  }
});

/**
 * Get error distribution analysis
 */
router.get('/errors/distribution', (req: Request, res: Response) => {
  try {
    const errorDistribution = monitoringService.getErrorDistribution();
    sendSuccess(res, errorDistribution, 'Error distribution retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve error distribution', error.message);
  }
});

/**
 * Get traffic patterns
 */
router.get('/traffic/patterns', (req: Request, res: Response) => {
  try {
    const patterns = monitoringService.getTrafficPatterns();
    sendSuccess(res, patterns, 'Traffic patterns retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve traffic patterns', error.message);
  }
});

/**
 * Get user activity metrics
 */
router.get('/users/activity', (req: Request, res: Response) => {
  try {
    const activity = monitoringService.getUserActivityMetrics();
    sendSuccess(res, activity, 'User activity metrics retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve user activity', error.message);
  }
});

/**
 * Get overall health score
 */
router.get('/health/score', (req: Request, res: Response) => {
  try {
    const healthScore = monitoringService.getHealthScore();
    sendSuccess(res, healthScore, 'Health score calculated successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to calculate health score', error.message);
  }
});

/**
 * Get circuit breaker status for all services
 */
router.get('/circuit-breakers', (req: Request, res: Response) => {
  try {
    const circuitBreakers = circuitBreakerManager.getAllStates();
    const metrics = circuitBreakerManager.getAllMetrics();
    
    sendSuccess(res, {
      states: circuitBreakers,
      metrics,
    }, 'Circuit breaker status retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve circuit breaker status', error.message);
  }
});

/**
 * Get load balancer statistics
 */
router.get('/load-balancers', (req: Request, res: Response) => {
  try {
    const stats = loadBalancerManager.getAllStats();
    const healthSummaries = loadBalancerManager.getAllHealthSummaries();
    
    sendSuccess(res, {
      stats,
      healthSummaries,
    }, 'Load balancer statistics retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve load balancer statistics', error.message);
  }
});

/**
 * Get comprehensive service health status
 */
router.get('/services/health', async (req: Request, res: Response) => {
  try {
    const servicesHealth = await proxyService.checkServicesHealth();
    const stats = proxyService.getProxyStats();
    
    // Calculate overall health
    const allServices = Object.values(servicesHealth) as any[];
    const healthyServices = allServices.filter(service => 
      service.healthyPercentage === 100 || service.healthy > 0
    ).length;
    
    const overallHealth = {
      status: healthyServices === allServices.length ? 'healthy' : 'degraded',
      healthyServices,
      totalServices: allServices.length,
      healthPercentage: (healthyServices / allServices.length) * 100,
    };
    
    sendSuccess(res, {
      overall: overallHealth,
      services: servicesHealth,
      stats,
    }, 'Service health status retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve service health', error.message);
  }
});

/**
 * Export metrics in Prometheus format
 */
router.get('/metrics/prometheus', (req: Request, res: Response) => {
  try {
    const prometheusMetrics = monitoringService.exportPrometheusMetrics();
    
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(prometheusMetrics);
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to export Prometheus metrics', error.message);
  }
});

/**
 * Get real-time dashboard data
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [
      metrics,
      errorDistribution,
      trafficPatterns,
      userActivity,
      healthScore,
      servicesHealth,
      slowEndpoints
    ] = await Promise.all([
      Promise.resolve(monitoringService.getAggregatedMetrics()),
      Promise.resolve(monitoringService.getErrorDistribution()),
      Promise.resolve(monitoringService.getTrafficPatterns()),
      Promise.resolve(monitoringService.getUserActivityMetrics()),
      Promise.resolve(monitoringService.getHealthScore()),
      proxyService.checkServicesHealth(),
      Promise.resolve(monitoringService.getSlowEndpoints(5))
    ]);
    
    const dashboardData = {
      overview: {
        totalRequests: metrics.requestCount,
        errorRate: metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount * 100).toFixed(2) : '0.00',
        averageResponseTime: metrics.responseTime.average,
        activeUsers: userActivity.activeUsers,
        healthScore: healthScore.score,
      },
      metrics,
      errorDistribution,
      trafficPatterns,
      userActivity,
      healthScore,
      servicesHealth,
      slowEndpoints,
      timestamp: new Date().toISOString(),
    };
    
    sendSuccess(res, dashboardData, 'Dashboard data retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve dashboard data', error.message);
  }
});

/**
 * Reset circuit breaker for a specific service
 */
router.post('/circuit-breakers/:service/reset', (req: Request, res: Response) => {
  try {
    const serviceName = req.params.service;
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(serviceName);
    
    circuitBreaker.forceClose();
    
    sendSuccess(res, { 
      service: serviceName,
      action: 'reset',
      newState: circuitBreaker.getState() 
    }, `Circuit breaker for ${serviceName} has been reset`);
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to reset circuit breaker', error.message);
  }
});

/**
 * Force open circuit breaker for a specific service
 */
router.post('/circuit-breakers/:service/open', (req: Request, res: Response) => {
  try {
    const serviceName = req.params.service;
    const circuitBreaker = circuitBreakerManager.getCircuitBreaker(serviceName);
    
    circuitBreaker.forceOpen();
    
    sendSuccess(res, { 
      service: serviceName,
      action: 'force_open',
      newState: circuitBreaker.getState() 
    }, `Circuit breaker for ${serviceName} has been force opened`);
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to open circuit breaker', error.message);
  }
});

/**
 * Get API Gateway system information
 */
router.get('/system', (req: Request, res: Response) => {
  try {
    const systemInfo = {
      gateway: {
        version: config.apiVersion,
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        uptime: process.uptime(),
        pid: process.pid,
      },
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      environment: config.nodeEnv,
      loadedServices: proxyService.getProxyStats().services,
      configuration: {
        rateLimit: {
          windowMs: config.rateLimit.windowMs,
          maxRequests: config.rateLimit.maxRequests,
        },
        circuitBreaker: {
          threshold: config.circuitBreaker.threshold,
          timeout: config.circuitBreaker.timeout,
          resetTimeout: config.circuitBreaker.resetTimeout,
        },
        healthCheck: {
          interval: config.healthCheck.interval,
          timeout: config.healthCheck.timeout,
        },
      },
    };
    
    sendSuccess(res, systemInfo, 'System information retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve system information', error.message);
  }
});

/**
 * Get service configuration
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const configuration = {
      services: config.services,
      cors: config.cors,
      rateLimit: config.rateLimit,
      circuitBreaker: config.circuitBreaker,
      loadBalancer: config.loadBalancer,
      healthCheck: config.healthCheck,
      security: config.security,
      monitoring: config.monitoring,
      swagger: config.swagger,
      ssl: config.ssl,
    };
    
    sendSuccess(res, configuration, 'Configuration retrieved successfully');
  } catch (error: any) {
    sendError(res, 500, 'INTERNAL_ERROR', 'Failed to retrieve configuration', error.message);
  }
});

/**
 * Test endpoint for monitoring validation
 */
router.get('/test', (req: Request, res: Response) => {
  const testDelay = parseInt(req.query.delay as string) || 0;
  const shouldError = req.query.error === 'true';
  
  setTimeout(() => {
    if (shouldError) {
      sendError(res, 500, 'INTERNAL_ERROR', 'Test error as requested');
    } else {
      sendSuccess(res, {
        message: 'Monitoring test successful',
        delay: testDelay,
        timestamp: new Date().toISOString(),
      });
    }
  }, testDelay);
});

export default router;
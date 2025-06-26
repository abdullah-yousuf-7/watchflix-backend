import { Request, Response } from 'express';
import NodeCache from 'node-cache';
import { AuthenticatedRequest, MetricsData } from '@/types';
import logger from '@/utils/logger';

export interface RequestMetrics {
  timestamp: number;
  method: string;
  path: string;
  statusCode: number;
  responseTime: number;
  service?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

export interface ServiceMetrics {
  serviceName: string;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  statusCodes: Record<number, number>;
  lastRequestTime: number;
  uptime: number;
}

export class MonitoringService {
  private metricsCache = new NodeCache({ 
    stdTTL: 300, // 5 minutes
    checkperiod: 60 // Check for expired keys every minute
  });
  
  private requestMetrics: RequestMetrics[] = [];
  private readonly maxMetricsHistory = 10000; // Keep last 10k requests
  private readonly metricsRetentionTime = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Cleanup old metrics periodically
    setInterval(() => {
      this.cleanupOldMetrics();
    }, 60 * 1000); // Every minute
  }

  /**
   * Record a request metric
   */
  public recordRequest(
    req: AuthenticatedRequest,
    res: Response,
    responseTime: number,
    service?: string
  ): void {
    const metric: RequestMetrics = {
      timestamp: Date.now(),
      method: req.method,
      path: this.sanitizePath(req.path),
      statusCode: res.statusCode,
      responseTime,
      service,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    };

    this.requestMetrics.push(metric);

    // Limit memory usage
    if (this.requestMetrics.length > this.maxMetricsHistory) {
      this.requestMetrics = this.requestMetrics.slice(-this.maxMetricsHistory);
    }

    // Update cached aggregated metrics
    this.updateAggregatedMetrics(metric);
  }

  /**
   * Get aggregated metrics for all services
   */
  public getAggregatedMetrics(): MetricsData {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentMetrics = this.requestMetrics.filter(
      metric => metric.timestamp >= oneHourAgo
    );

    const requestCount = recentMetrics.length;
    const errorCount = recentMetrics.filter(metric => metric.statusCode >= 400).length;
    
    const responseTimes = recentMetrics.map(metric => metric.responseTime).sort((a, b) => a - b);
    const averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
      : 0;

    const statusCodes: Record<string, number> = {};
    const services: Record<string, any> = {};

    recentMetrics.forEach(metric => {
      // Status code distribution
      const statusKey = Math.floor(metric.statusCode / 100) * 100;
      statusCodes[`${statusKey}xx`] = (statusCodes[`${statusKey}xx`] || 0) + 1;

      // Service-specific metrics
      if (metric.service) {
        if (!services[metric.service]) {
          services[metric.service] = {
            requestCount: 0,
            errorCount: 0,
            totalResponseTime: 0,
          };
        }
        
        services[metric.service].requestCount++;
        services[metric.service].totalResponseTime += metric.responseTime;
        
        if (metric.statusCode >= 400) {
          services[metric.service].errorCount++;
        }
      }
    });

    // Calculate service averages
    Object.keys(services).forEach(serviceName => {
      const service = services[serviceName];
      service.averageResponseTime = service.totalResponseTime / service.requestCount;
      delete service.totalResponseTime;
    });

    return {
      requestCount,
      errorCount,
      responseTime: {
        average: Math.round(averageResponseTime),
        p50: this.calculatePercentile(responseTimes, 50),
        p95: this.calculatePercentile(responseTimes, 95),
        p99: this.calculatePercentile(responseTimes, 99),
      },
      statusCodes,
      services,
    };
  }

  /**
   * Get metrics for a specific service
   */
  public getServiceMetrics(serviceName: string): ServiceMetrics | null {
    const cacheKey = `service_metrics_${serviceName}`;
    let metrics = this.metricsCache.get<ServiceMetrics>(cacheKey);

    if (!metrics) {
      metrics = this.calculateServiceMetrics(serviceName);
      if (metrics) {
        this.metricsCache.set(cacheKey, metrics, 60); // Cache for 1 minute
      }
    }

    return metrics;
  }

  /**
   * Get top slow endpoints
   */
  public getSlowEndpoints(limit: number = 10): Array<{
    path: string;
    averageResponseTime: number;
    requestCount: number;
  }> {
    const pathMetrics = new Map<string, { totalTime: number; count: number }>();
    
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentMetrics = this.requestMetrics.filter(
      metric => metric.timestamp >= oneHourAgo
    );

    recentMetrics.forEach(metric => {
      const key = `${metric.method} ${metric.path}`;
      const existing = pathMetrics.get(key) || { totalTime: 0, count: 0 };
      pathMetrics.set(key, {
        totalTime: existing.totalTime + metric.responseTime,
        count: existing.count + 1,
      });
    });

    return Array.from(pathMetrics.entries())
      .map(([path, data]) => ({
        path,
        averageResponseTime: Math.round(data.totalTime / data.count),
        requestCount: data.count,
      }))
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, limit);
  }

  /**
   * Get error distribution
   */
  public getErrorDistribution(): Record<string, any> {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentErrors = this.requestMetrics.filter(
      metric => metric.timestamp >= oneHourAgo && metric.statusCode >= 400
    );

    const errorsByStatus: Record<number, number> = {};
    const errorsByPath: Record<string, number> = {};
    const errorsByService: Record<string, number> = {};

    recentErrors.forEach(metric => {
      // By status code
      errorsByStatus[metric.statusCode] = (errorsByStatus[metric.statusCode] || 0) + 1;
      
      // By path
      const pathKey = `${metric.method} ${metric.path}`;
      errorsByPath[pathKey] = (errorsByPath[pathKey] || 0) + 1;
      
      // By service
      if (metric.service) {
        errorsByService[metric.service] = (errorsByService[metric.service] || 0) + 1;
      }
    });

    return {
      total: recentErrors.length,
      byStatus: errorsByStatus,
      byPath: Object.entries(errorsByPath)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [path, count]) => ({ ...obj, [path]: count }), {}),
      byService: errorsByService,
    };
  }

  /**
   * Get traffic patterns
   */
  public getTrafficPatterns(): Array<{
    timestamp: number;
    requestCount: number;
    errorCount: number;
    averageResponseTime: number;
  }> {
    const now = Date.now();
    const patterns: Array<any> = [];
    
    // Group by 5-minute intervals for the last hour
    for (let i = 11; i >= 0; i--) {
      const intervalStart = now - (i * 5 * 60 * 1000);
      const intervalEnd = intervalStart + (5 * 60 * 1000);
      
      const intervalMetrics = this.requestMetrics.filter(
        metric => metric.timestamp >= intervalStart && metric.timestamp < intervalEnd
      );
      
      const requestCount = intervalMetrics.length;
      const errorCount = intervalMetrics.filter(metric => metric.statusCode >= 400).length;
      const averageResponseTime = requestCount > 0
        ? intervalMetrics.reduce((sum, metric) => sum + metric.responseTime, 0) / requestCount
        : 0;
      
      patterns.push({
        timestamp: intervalStart,
        requestCount,
        errorCount,
        averageResponseTime: Math.round(averageResponseTime),
      });
    }
    
    return patterns;
  }

  /**
   * Get user activity metrics
   */
  public getUserActivityMetrics(): {
    activeUsers: number;
    totalRequests: number;
    topUsers: Array<{ userId: string; requestCount: number }>;
  } {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentMetrics = this.requestMetrics.filter(
      metric => metric.timestamp >= oneHourAgo && metric.userId
    );

    const userActivity = new Map<string, number>();
    
    recentMetrics.forEach(metric => {
      if (metric.userId) {
        userActivity.set(metric.userId, (userActivity.get(metric.userId) || 0) + 1);
      }
    });

    const topUsers = Array.from(userActivity.entries())
      .map(([userId, requestCount]) => ({ userId, requestCount }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    return {
      activeUsers: userActivity.size,
      totalRequests: recentMetrics.length,
      topUsers,
    };
  }

  /**
   * Generate health score based on various metrics
   */
  public getHealthScore(): {
    score: number;
    factors: Record<string, { value: number; weight: number; impact: number }>;
  } {
    const metrics = this.getAggregatedMetrics();
    const errorDistribution = this.getErrorDistribution();
    
    const factors = {
      errorRate: {
        value: metrics.requestCount > 0 ? (metrics.errorCount / metrics.requestCount) * 100 : 0,
        weight: 30,
        impact: 0,
      },
      responseTime: {
        value: metrics.responseTime.p95,
        weight: 25,
        impact: 0,
      },
      throughput: {
        value: metrics.requestCount,
        weight: 20,
        impact: 0,
      },
      availability: {
        value: this.calculateAvailability(),
        weight: 25,
        impact: 0,
      },
    };

    // Calculate impact for each factor
    factors.errorRate.impact = Math.max(0, 100 - factors.errorRate.value * 2); // Lower error rate = higher score
    factors.responseTime.impact = Math.max(0, 100 - Math.min(factors.responseTime.value / 50, 100)); // Response time impact
    factors.throughput.impact = Math.min(100, factors.throughput.value / 10); // Higher throughput = higher score (capped)
    factors.availability.impact = factors.availability.value; // Direct availability percentage

    // Calculate weighted score
    const totalWeight = Object.values(factors).reduce((sum, factor) => sum + factor.weight, 0);
    const score = Object.values(factors).reduce(
      (sum, factor) => sum + (factor.impact * factor.weight / totalWeight),
      0
    );

    return {
      score: Math.round(score),
      factors,
    };
  }

  /**
   * Export metrics for external monitoring systems
   */
  public exportPrometheusMetrics(): string {
    const metrics = this.getAggregatedMetrics();
    const timestamp = Date.now();
    
    let output = '';
    
    // Request count
    output += `# HELP watchflixx_gateway_requests_total Total number of requests\n`;
    output += `# TYPE watchflixx_gateway_requests_total counter\n`;
    output += `watchflixx_gateway_requests_total ${metrics.requestCount} ${timestamp}\n\n`;
    
    // Error count
    output += `# HELP watchflixx_gateway_errors_total Total number of errors\n`;
    output += `# TYPE watchflixx_gateway_errors_total counter\n`;
    output += `watchflixx_gateway_errors_total ${metrics.errorCount} ${timestamp}\n\n`;
    
    // Response time
    output += `# HELP watchflixx_gateway_response_time_seconds Response time in seconds\n`;
    output += `# TYPE watchflixx_gateway_response_time_seconds histogram\n`;
    output += `watchflixx_gateway_response_time_seconds{quantile="0.5"} ${metrics.responseTime.p50 / 1000} ${timestamp}\n`;
    output += `watchflixx_gateway_response_time_seconds{quantile="0.95"} ${metrics.responseTime.p95 / 1000} ${timestamp}\n`;
    output += `watchflixx_gateway_response_time_seconds{quantile="0.99"} ${metrics.responseTime.p99 / 1000} ${timestamp}\n\n`;
    
    // Service metrics
    Object.entries(metrics.services).forEach(([serviceName, serviceMetrics]) => {
      output += `watchflixx_service_requests_total{service="${serviceName}"} ${serviceMetrics.requestCount} ${timestamp}\n`;
      output += `watchflixx_service_errors_total{service="${serviceName}"} ${serviceMetrics.errorCount} ${timestamp}\n`;
      output += `watchflixx_service_response_time_avg{service="${serviceName}"} ${serviceMetrics.averageResponseTime / 1000} ${timestamp}\n`;
    });
    
    return output;
  }

  /**
   * Private helper methods
   */
  private sanitizePath(path: string): string {
    // Replace IDs with placeholders for better grouping
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9]{24}/g, '/:id');
  }

  private updateAggregatedMetrics(metric: RequestMetrics): void {
    // This could be enhanced to update running averages more efficiently
    const cacheKey = 'aggregated_metrics';
    this.metricsCache.del(cacheKey); // Invalidate cache
  }

  private calculateServiceMetrics(serviceName: string): ServiceMetrics | null {
    const serviceMetrics = this.requestMetrics.filter(
      metric => metric.service === serviceName
    );

    if (serviceMetrics.length === 0) {
      return null;
    }

    const responseTimes = serviceMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const statusCodes: Record<number, number> = {};
    
    serviceMetrics.forEach(metric => {
      statusCodes[metric.statusCode] = (statusCodes[metric.statusCode] || 0) + 1;
    });

    return {
      serviceName,
      requestCount: serviceMetrics.length,
      errorCount: serviceMetrics.filter(m => m.statusCode >= 400).length,
      averageResponseTime: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
      p50ResponseTime: this.calculatePercentile(responseTimes, 50),
      p95ResponseTime: this.calculatePercentile(responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(responseTimes, 99),
      statusCodes,
      lastRequestTime: Math.max(...serviceMetrics.map(m => m.timestamp)),
      uptime: this.calculateServiceUptime(serviceName),
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return Math.round(sortedArray[Math.max(0, index)]);
  }

  private calculateAvailability(): number {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentMetrics = this.requestMetrics.filter(
      metric => metric.timestamp >= oneHourAgo
    );

    if (recentMetrics.length === 0) return 100;
    
    const successfulRequests = recentMetrics.filter(metric => metric.statusCode < 500).length;
    return (successfulRequests / recentMetrics.length) * 100;
  }

  private calculateServiceUptime(serviceName: string): number {
    // This is a simplified calculation - in production, you'd want more sophisticated uptime tracking
    const serviceMetrics = this.requestMetrics.filter(m => m.service === serviceName);
    if (serviceMetrics.length === 0) return 0;
    
    const successfulRequests = serviceMetrics.filter(m => m.statusCode < 500).length;
    return (successfulRequests / serviceMetrics.length) * 100;
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - this.metricsRetentionTime;
    this.requestMetrics = this.requestMetrics.filter(
      metric => metric.timestamp > cutoffTime
    );
    
    logger.debug('Cleaned up old metrics', {
      remainingMetrics: this.requestMetrics.length,
      cutoffTime: new Date(cutoffTime).toISOString(),
    });
  }
}

// Global monitoring service instance
export const monitoringService = new MonitoringService();

export default MonitoringService;
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ServiceInstance, ServiceHealth } from '@/types';
import { logServiceHealth } from '@/utils/logger';
import config from '@/config';

export type LoadBalancingStrategy = 'round-robin' | 'least-connections' | 'weighted' | 'random';

export interface LoadBalancerOptions {
  strategy: LoadBalancingStrategy;
  healthCheckInterval: number;
  healthCheckTimeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export class LoadBalancer {
  private instances: ServiceInstance[] = [];
  private currentIndex = 0;
  private healthCheckTimer?: NodeJS.Timer;
  private readonly options: LoadBalancerOptions;

  constructor(
    private readonly serviceName: string,
    serviceUrls: string[],
    options: Partial<LoadBalancerOptions> = {}
  ) {
    this.options = {
      strategy: options.strategy || config.loadBalancer.strategy as LoadBalancingStrategy,
      healthCheckInterval: options.healthCheckInterval || config.healthCheck.interval,
      healthCheckTimeout: options.healthCheckTimeout || config.healthCheck.timeout,
      retryAttempts: options.retryAttempts || config.loadBalancer.retryAttempts,
      retryDelay: options.retryDelay || config.loadBalancer.retryDelay,
    };

    // Initialize service instances
    this.instances = serviceUrls.map((url, index) => ({
      id: `${serviceName}-${index}`,
      url,
      health: {
        name: serviceName,
        url,
        status: 'unknown',
        responseTime: 0,
        lastChecked: new Date(),
      },
      weight: 1,
      currentConnections: 0,
    }));

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Get the next available service instance
   */
  public getNextInstance(): ServiceInstance | null {
    const healthyInstances = this.getHealthyInstances();
    
    if (healthyInstances.length === 0) {
      return null;
    }

    switch (this.options.strategy) {
      case 'round-robin':
        return this.roundRobinSelection(healthyInstances);
      case 'least-connections':
        return this.leastConnectionsSelection(healthyInstances);
      case 'weighted':
        return this.weightedSelection(healthyInstances);
      case 'random':
        return this.randomSelection(healthyInstances);
      default:
        return this.roundRobinSelection(healthyInstances);
    }
  }

  /**
   * Execute a request with load balancing and retry logic
   */
  public async execute<T>(
    requestConfig: AxiosRequestConfig,
    maxRetries?: number
  ): Promise<AxiosResponse<T>> {
    const retries = maxRetries ?? this.options.retryAttempts;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      const instance = this.getNextInstance();
      
      if (!instance) {
        throw new Error(`No healthy instances available for ${this.serviceName}`);
      }

      try {
        // Increment connection count
        instance.currentConnections++;

        // Build request URL
        const url = `${instance.url}${requestConfig.url || ''}`;
        const config: AxiosRequestConfig = {
          ...requestConfig,
          url,
          timeout: this.options.healthCheckTimeout,
        };

        const response = await axios(config);
        
        // Decrement connection count on success
        instance.currentConnections--;
        
        return response;
      } catch (error: any) {
        // Decrement connection count on error
        instance.currentConnections--;
        
        lastError = error;
        
        // Mark instance as unhealthy if it's a connection error
        if (this.isConnectionError(error)) {
          this.markInstanceUnhealthy(instance, error.message);
        }

        // If this is the last attempt, throw the error
        if (attempt === retries) {
          break;
        }

        // Wait before retrying
        if (attempt < retries) {
          await this.delay(this.options.retryDelay * Math.pow(2, attempt)); // Exponential backoff
        }
      }
    }

    throw lastError || new Error(`Request failed after ${retries + 1} attempts`);
  }

  /**
   * Round-robin selection
   */
  private roundRobinSelection(instances: ServiceInstance[]): ServiceInstance {
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex = (this.currentIndex + 1) % instances.length;
    return instance;
  }

  /**
   * Least connections selection
   */
  private leastConnectionsSelection(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((prev, current) => 
      prev.currentConnections <= current.currentConnections ? prev : current
    );
  }

  /**
   * Weighted selection
   */
  private weightedSelection(instances: ServiceInstance[]): ServiceInstance {
    const totalWeight = instances.reduce((sum, instance) => sum + instance.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[0]; // Fallback
  }

  /**
   * Random selection
   */
  private randomSelection(instances: ServiceInstance[]): ServiceInstance {
    const randomIndex = Math.floor(Math.random() * instances.length);
    return instances[randomIndex];
  }

  /**
   * Get healthy instances
   */
  private getHealthyInstances(): ServiceInstance[] {
    return this.instances.filter(instance => instance.health.status === 'healthy');
  }

  /**
   * Start health checks for all instances
   */
  private startHealthChecks(): void {
    // Initial health check
    this.performHealthChecks();

    // Periodic health checks
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform health checks on all instances
   */
  private async performHealthChecks(): Promise<void> {
    const healthCheckPromises = this.instances.map(instance => 
      this.checkInstanceHealth(instance)
    );

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * Check health of a specific instance
   */
  private async checkInstanceHealth(instance: ServiceInstance): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get(`${instance.url}/health`, {
        timeout: this.options.healthCheckTimeout,
        validateStatus: (status) => status === 200,
      });

      const responseTime = Date.now() - startTime;
      
      instance.health = {
        name: this.serviceName,
        url: instance.url,
        status: 'healthy',
        responseTime,
        lastChecked: new Date(),
      };

      logServiceHealth(this.serviceName, true, responseTime);
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      
      instance.health = {
        name: this.serviceName,
        url: instance.url,
        status: 'unhealthy',
        responseTime,
        lastChecked: new Date(),
        error: error.message,
      };

      logServiceHealth(this.serviceName, false, responseTime, error.message);
    }
  }

  /**
   * Mark an instance as unhealthy
   */
  private markInstanceUnhealthy(instance: ServiceInstance, error: string): void {
    instance.health.status = 'unhealthy';
    instance.health.error = error;
    instance.health.lastChecked = new Date();
  }

  /**
   * Check if error is a connection error
   */
  private isConnectionError(error: any): boolean {
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.response?.status >= 500
    );
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get all instances with their health status
   */
  public getInstances(): ServiceInstance[] {
    return [...this.instances];
  }

  /**
   * Get service health summary
   */
  public getHealthSummary() {
    const healthy = this.instances.filter(i => i.health.status === 'healthy').length;
    const unhealthy = this.instances.filter(i => i.health.status === 'unhealthy').length;
    const unknown = this.instances.filter(i => i.health.status === 'unknown').length;

    return {
      serviceName: this.serviceName,
      total: this.instances.length,
      healthy,
      unhealthy,
      unknown,
      healthyPercentage: this.instances.length > 0 ? (healthy / this.instances.length) * 100 : 0,
    };
  }

  /**
   * Add a new service instance
   */
  public addInstance(url: string, weight: number = 1): void {
    const instance: ServiceInstance = {
      id: `${this.serviceName}-${this.instances.length}`,
      url,
      health: {
        name: this.serviceName,
        url,
        status: 'unknown',
        responseTime: 0,
        lastChecked: new Date(),
      },
      weight,
      currentConnections: 0,
    };

    this.instances.push(instance);
    
    // Immediately check health of new instance
    this.checkInstanceHealth(instance);
  }

  /**
   * Remove a service instance
   */
  public removeInstance(url: string): boolean {
    const index = this.instances.findIndex(instance => instance.url === url);
    
    if (index !== -1) {
      this.instances.splice(index, 1);
      return true;
    }
    
    return false;
  }

  /**
   * Update instance weight
   */
  public updateInstanceWeight(url: string, weight: number): boolean {
    const instance = this.instances.find(instance => instance.url === url);
    
    if (instance) {
      instance.weight = weight;
      return true;
    }
    
    return false;
  }

  /**
   * Get load balancer statistics
   */
  public getStats() {
    const totalConnections = this.instances.reduce(
      (sum, instance) => sum + instance.currentConnections, 
      0
    );
    
    const avgResponseTime = this.instances.length > 0 
      ? this.instances.reduce((sum, instance) => sum + instance.health.responseTime, 0) / this.instances.length
      : 0;

    return {
      serviceName: this.serviceName,
      strategy: this.options.strategy,
      totalInstances: this.instances.length,
      healthyInstances: this.getHealthyInstances().length,
      totalConnections,
      averageResponseTime: avgResponseTime,
      lastHealthCheck: Math.max(...this.instances.map(i => i.health.lastChecked.getTime())),
    };
  }

  /**
   * Stop health checks and cleanup
   */
  public destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }
}

/**
 * Load Balancer Manager
 */
export class LoadBalancerManager {
  private loadBalancers = new Map<string, LoadBalancer>();

  /**
   * Create or get a load balancer for a service
   */
  public getLoadBalancer(
    serviceName: string,
    serviceUrls: string[],
    options?: Partial<LoadBalancerOptions>
  ): LoadBalancer {
    if (!this.loadBalancers.has(serviceName)) {
      const loadBalancer = new LoadBalancer(serviceName, serviceUrls, options);
      this.loadBalancers.set(serviceName, loadBalancer);
    }

    return this.loadBalancers.get(serviceName)!;
  }

  /**
   * Get all load balancer statistics
   */
  public getAllStats() {
    const stats: any[] = [];
    
    for (const [, loadBalancer] of this.loadBalancers) {
      stats.push(loadBalancer.getStats());
    }
    
    return stats;
  }

  /**
   * Get all health summaries
   */
  public getAllHealthSummaries() {
    const summaries: any[] = [];
    
    for (const [, loadBalancer] of this.loadBalancers) {
      summaries.push(loadBalancer.getHealthSummary());
    }
    
    return summaries;
  }

  /**
   * Destroy all load balancers
   */
  public destroyAll(): void {
    for (const [, loadBalancer] of this.loadBalancers) {
      loadBalancer.destroy();
    }
    this.loadBalancers.clear();
  }
}

// Global load balancer manager instance
export const loadBalancerManager = new LoadBalancerManager();

export default LoadBalancer;
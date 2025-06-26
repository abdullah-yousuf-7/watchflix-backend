import { EventEmitter } from 'events';
import { CircuitBreakerState } from '@/types';
import { logCircuitBreaker } from '@/utils/logger';
import config from '@/config';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  threshold: number;
  timeout: number;
  resetTimeout: number;
  monitoringPeriod?: number;
  expectedErrors?: string[];
}

export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;
  private successCount: number = 0;
  private readonly options: Required<CircuitBreakerOptions>;
  private monitoringTimer?: NodeJS.Timer;

  constructor(
    private readonly serviceName: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    super();
    
    this.options = {
      threshold: options.threshold || config.circuitBreaker.threshold,
      timeout: options.timeout || config.circuitBreaker.timeout,
      resetTimeout: options.resetTimeout || config.circuitBreaker.resetTimeout,
      monitoringPeriod: options.monitoringPeriod || 60000, // 1 minute
      expectedErrors: options.expectedErrors || [],
    };

    this.startMonitoring();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
        logCircuitBreaker(this.serviceName, this.state, 'Attempting reset');
        this.emit('halfOpen');
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === CircuitState.HALF_OPEN) {
      // If we're in half-open and got a success, close the circuit
      this.reset();
      logCircuitBreaker(this.serviceName, this.state, 'Circuit closed after successful call');
      this.emit('close');
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    const isExpectedError = this.options.expectedErrors.some(
      expectedError => error.message.includes(expectedError)
    );

    if (isExpectedError) {
      // Don't count expected errors towards circuit breaker
      return;
    }

    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      // If we're in half-open and got a failure, open the circuit
      this.open();
      logCircuitBreaker(this.serviceName, this.state, 'Circuit opened after failed call in half-open');
      this.emit('open');
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.options.threshold) {
      // If we've hit the threshold, open the circuit
      this.open();
      logCircuitBreaker(this.serviceName, this.state, `Circuit opened after ${this.failureCount} failures`);
      this.emit('open');
    }
  }

  /**
   * Open the circuit
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextRetryTime = new Date(Date.now() + this.options.resetTimeout);
  }

  /**
   * Reset the circuit to closed state
   */
  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
  }

  /**
   * Check if we should attempt to reset an open circuit
   */
  private shouldAttemptReset(): boolean {
    return this.nextRetryTime ? new Date() >= this.nextRetryTime : false;
  }

  /**
   * Start monitoring circuit health
   */
  private startMonitoring(): void {
    this.monitoringTimer = setInterval(() => {
      this.emit('metrics', this.getMetrics());
    }, this.options.monitoringPeriod);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
  }

  /**
   * Get current circuit breaker metrics
   */
  public getMetrics() {
    return {
      serviceName: this.serviceName,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
      uptime: this.calculateUptime(),
    };
  }

  /**
   * Get current state
   */
  public getState(): CircuitBreakerState {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
    };
  }

  /**
   * Calculate service uptime percentage
   */
  private calculateUptime(): number {
    const totalCalls = this.failureCount + this.successCount;
    if (totalCalls === 0) return 100;
    return (this.successCount / totalCalls) * 100;
  }

  /**
   * Force open the circuit (for testing or manual intervention)
   */
  public forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextRetryTime = new Date(Date.now() + this.options.resetTimeout);
    logCircuitBreaker(this.serviceName, this.state, 'Circuit force opened');
    this.emit('open');
  }

  /**
   * Force close the circuit (for testing or manual intervention)
   */
  public forceClose(): void {
    this.reset();
    logCircuitBreaker(this.serviceName, this.state, 'Circuit force closed');
    this.emit('close');
  }

  /**
   * Check if circuit is currently open
   */
  public isOpen(): boolean {
    return this.state === CircuitState.OPEN;
  }

  /**
   * Check if circuit is currently closed
   */
  public isClosed(): boolean {
    return this.state === CircuitState.CLOSED;
  }

  /**
   * Check if circuit is currently half-open
   */
  public isHalfOpen(): boolean {
    return this.state === CircuitState.HALF_OPEN;
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopMonitoring();
    this.removeAllListeners();
  }
}

/**
 * Circuit Breaker Manager
 */
export class CircuitBreakerManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();

  /**
   * Get or create a circuit breaker for a service
   */
  public getCircuitBreaker(
    serviceName: string,
    options?: Partial<CircuitBreakerOptions>
  ): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      const circuitBreaker = new CircuitBreaker(serviceName, options);
      this.circuitBreakers.set(serviceName, circuitBreaker);
      
      // Log state changes
      circuitBreaker.on('open', () => {
        logCircuitBreaker(serviceName, 'OPEN', 'Circuit breaker opened');
      });
      
      circuitBreaker.on('close', () => {
        logCircuitBreaker(serviceName, 'CLOSED', 'Circuit breaker closed');
      });
      
      circuitBreaker.on('halfOpen', () => {
        logCircuitBreaker(serviceName, 'HALF_OPEN', 'Circuit breaker half-open');
      });
    }

    return this.circuitBreakers.get(serviceName)!;
  }

  /**
   * Get all circuit breaker states
   */
  public getAllStates(): Record<string, CircuitBreakerState> {
    const states: Record<string, CircuitBreakerState> = {};
    
    for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
      states[serviceName] = circuitBreaker.getState();
    }
    
    return states;
  }

  /**
   * Get all circuit breaker metrics
   */
  public getAllMetrics() {
    const metrics: any[] = [];
    
    for (const [, circuitBreaker] of this.circuitBreakers) {
      metrics.push(circuitBreaker.getMetrics());
    }
    
    return metrics;
  }

  /**
   * Force open all circuit breakers
   */
  public forceOpenAll(): void {
    for (const [, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.forceOpen();
    }
  }

  /**
   * Force close all circuit breakers
   */
  public forceCloseAll(): void {
    for (const [, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.forceClose();
    }
  }

  /**
   * Destroy all circuit breakers
   */
  public destroyAll(): void {
    for (const [, circuitBreaker] of this.circuitBreakers) {
      circuitBreaker.destroy();
    }
    this.circuitBreakers.clear();
  }
}

// Global circuit breaker manager instance
export const circuitBreakerManager = new CircuitBreakerManager();

export default CircuitBreaker;
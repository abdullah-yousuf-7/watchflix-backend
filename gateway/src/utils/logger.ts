import winston from 'winston';
import config from '@/config';

const { combine, timestamp, errors, json, printf, colorize } = winston.format;

// Custom format for console output in development
const devFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
});

// Production format
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json()
);

// Development format
const developmentFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  devFormat
);

// Create logger instance
const logger = winston.createLogger({
  level: config.logging.level,
  format: config.nodeEnv === 'production' ? prodFormat : developmentFormat,
  defaultMeta: { service: 'api-gateway' },
  transports: [
    // Console transport
    new winston.transports.Console({
      silent: config.nodeEnv === 'test',
    }),
  ],
});

// Add file transport in production
if (config.nodeEnv === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    maxsize: 10485760, // 10MB
    maxFiles: 5,
  }));

  logger.add(new winston.transports.File({
    filename: config.logging.file,
    maxsize: 10485760, // 10MB
    maxFiles: 10,
  }));
}

// Request logging helper
export const logRequest = (req: any, res: any, responseTime: number) => {
  const logData = {
    method: req.method,
    url: req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId: req.requestId,
  };

  if (res.statusCode >= 400) {
    logger.warn('Request completed with error', logData);
  } else {
    logger.info('Request completed', logData);
  }
};

// Error logging helper
export const logError = (error: Error, req?: any, context?: string) => {
  const logData = {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
    ...(req && {
      request: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: req.body,
        requestId: req.requestId,
      },
    }),
  };

  logger.error('Error occurred', logData);
};

// Service health logging
export const logServiceHealth = (serviceName: string, isHealthy: boolean, responseTime: number, error?: string) => {
  const logData = {
    service: serviceName,
    healthy: isHealthy,
    responseTime: `${responseTime}ms`,
    ...(error && { error }),
  };

  if (isHealthy) {
    logger.debug('Service health check passed', logData);
  } else {
    logger.warn('Service health check failed', logData);
  }
};

// Circuit breaker logging
export const logCircuitBreaker = (serviceName: string, state: string, action: string) => {
  logger.warn('Circuit breaker state change', {
    service: serviceName,
    state,
    action,
    timestamp: new Date().toISOString(),
  });
};

// Rate limit logging
export const logRateLimit = (req: any, limit: number, remaining: number) => {
  logger.warn('Rate limit triggered', {
    ip: req.ip,
    url: req.url,
    limit,
    remaining,
    userAgent: req.get('User-Agent'),
    requestId: req.requestId,
  });
};

export default logger;
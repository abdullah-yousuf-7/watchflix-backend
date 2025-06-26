import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Basic JWT authentication middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Authorization token required' }
    });
  }

  // Simple token validation (in production, validate JWT properly)
  req.user = { id: 'user-id', email: 'user@example.com' };
  next();
};

// Service URLs (update these with your actual service URLs)
const SERVICES = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  content: process.env.CONTENT_SERVICE_URL || 'http://localhost:3002',
  streaming: process.env.STREAMING_SERVICE_URL || 'http://localhost:3003',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
  social: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3005',
  analytics: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:3006',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007',
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: Object.keys(SERVICES)
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'WatchFlixx API Gateway',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      auth: '/api/v1/auth/*',
      content: '/api/v1/content/*',
      streaming: '/api/v1/streaming/*',
      payment: '/api/v1/payment/*',
      social: '/api/v1/social/*',
      analytics: '/api/v1/analytics/*',
      notifications: '/api/v1/notifications/*'
    }
  });
});

// Custom proxy function
const createCustomProxy = (serviceName: string, serviceUrl: string) => {
  return async (req: any, res: any, next: any) => {
    try {
      const targetPath = req.path.replace(`/api/v1/${serviceName}`, '/v1');
      const targetUrl = `${serviceUrl}/v1${targetPath}`;
      
      const axiosConfig: any = {
        method: req.method.toLowerCase(),
        url: targetUrl,
        headers: {
          'Content-Type': 'application/json',
          ...req.headers,
        },
        timeout: 30000,
      };
      
      // Add body for POST/PUT requests
      if (['post', 'put', 'patch'].includes(req.method.toLowerCase())) {
        axiosConfig.data = req.body;
      }
      
      // Clean up headers
      delete axiosConfig.headers['content-length'];
      delete axiosConfig.headers['host'];
      
      // Add user info for authenticated requests
      if (req.user) {
        axiosConfig.headers['X-User-Id'] = req.user.id;
        axiosConfig.headers['X-User-Email'] = req.user.email;
      }
      
      const response = await axios(axiosConfig);
      
      // Forward response
      res.status(response.status).json(response.data);
      
    } catch (error: any) {
      console.error(`❌ ${serviceName} service error:`, error.message);
      
      if (error.response) {
        res.status(error.response.status).json(error.response.data);
      } else {
        res.status(503).json({
          success: false,
          error: {
            message: `${serviceName} service unavailable`,
            code: 'SERVICE_UNAVAILABLE'
          }
        });
      }
    }
  };
};

// Authentication service (no auth required for login/register)
app.use('/api/v1/auth', createCustomProxy('auth', SERVICES.auth));

// Protected routes (require authentication)
app.use('/api/v1/content', authenticate, createCustomProxy('content', SERVICES.content));
app.use('/api/v1/streaming', authenticate, createCustomProxy('streaming', SERVICES.streaming));
app.use('/api/v1/payment', authenticate, createCustomProxy('payment', SERVICES.payment));
app.use('/api/v1/social', authenticate, createCustomProxy('social', SERVICES.social));
app.use('/api/v1/analytics', authenticate, createCustomProxy('analytics', SERVICES.analytics));
app.use('/api/v1/notifications', authenticate, createCustomProxy('notifications', SERVICES.notification));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND'
    }
  });
});

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Gateway error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 WatchFlixx API Gateway running on port ${PORT}`);
  console.log(`📚 Health endpoint: http://localhost:${PORT}/health`);
  console.log(`🔗 Services configured:`);
  Object.entries(SERVICES).forEach(([name, url]) => {
    console.log(`   ${name}: ${url}`);
  });
});

export default app;
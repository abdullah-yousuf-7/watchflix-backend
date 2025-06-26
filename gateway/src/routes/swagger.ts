import { Router } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import config from '@/config';

const router = Router();

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WatchFlixx API Gateway',
      version: config.apiVersion,
      description: 'API Gateway for WatchFlixx streaming platform microservices',
      contact: {
        name: 'WatchFlixx API Support',
        email: 'api-support@watchflixx.com',
        url: 'https://docs.watchflixx.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Development server',
      },
      {
        url: 'https://api.watchflixx.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for user authentication',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for service-to-service authentication',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            requestId: { type: 'string' },
            version: { type: 'string' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
              },
            },
            timestamp: { type: 'string', format: 'date-time' },
            requestId: { type: 'string' },
            version: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            isVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Profile: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            avatar: { type: 'string', format: 'uri' },
            ageCategory: { type: 'string', enum: ['ADULT', 'TEEN', 'CHILD'] },
            contentRating: { type: 'string' },
            isDefault: { type: 'boolean' },
            pinEnabled: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Content: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            type: { type: 'string', enum: ['MOVIE', 'SERIES', 'DOCUMENTARY'] },
            genre: { type: 'array', items: { type: 'string' } },
            releaseDate: { type: 'string', format: 'date-time' },
            duration: { type: 'integer' },
            contentRating: { type: 'string' },
            posterUrl: { type: 'string', format: 'uri' },
            isAvailable: { type: 'boolean' },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            planType: { type: 'string', enum: ['BASIC', 'STANDARD', 'PREMIUM'] },
            billingCycle: { type: 'string', enum: ['MONTHLY', 'ANNUAL'] },
            status: { type: 'string', enum: ['ACTIVE', 'PAST_DUE', 'CANCELED'] },
            amount: { type: 'number' },
            currency: { type: 'string' },
            currentPeriodEnd: { type: 'string', format: 'date-time' },
          },
        },
        HealthStatus: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
            uptime: { type: 'number' },
            memory: { type: 'object' },
            services: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad Request',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        Forbidden: {
          description: 'Forbidden',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        NotFound: {
          description: 'Not Found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        RateLimit: {
          description: 'Rate Limit Exceeded',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        InternalError: {
          description: 'Internal Server Error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        ServiceUnavailable: {
          description: 'Service Unavailable',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'Content',
        description: 'Content discovery and management',
      },
      {
        name: 'Streaming',
        description: 'Video streaming and playback',
      },
      {
        name: 'Payment',
        description: 'Subscriptions and payments',
      },
      {
        name: 'Social',
        description: 'Social features and party watch',
      },
      {
        name: 'Analytics',
        description: 'Analytics and reporting',
      },
      {
        name: 'Notifications',
        description: 'User notifications',
      },
      {
        name: 'Health',
        description: 'Service health and monitoring',
      },
      {
        name: 'Monitoring',
        description: 'System monitoring and metrics',
      },
    ],
  },
  apis: [], // We'll define paths manually below since we're using proxies
};

// Generate swagger specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Add manual API paths since we're using proxies
swaggerSpec.paths = {
  '/api/v1/health': {
    get: {
      tags: ['Health'],
      summary: 'Get API Gateway health status',
      description: 'Returns the health status of the API Gateway and all connected services',
      responses: {
        200: {
          description: 'Health status retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    properties: {
                      data: { $ref: '#/components/schemas/HealthStatus' },
                    },
                  },
                ],
              },
            },
          },
        },
        503: {
          description: 'Service degraded or unhealthy',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
      },
    },
  },
  '/api/v1/auth/login': {
    post: {
      tags: ['Authentication'],
      summary: 'User login',
      description: 'Authenticate user with email and password',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 6 },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Login successful',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                          tokens: {
                            type: 'object',
                            properties: {
                              accessToken: { type: 'string' },
                              refreshToken: { type: 'string' },
                              expiresIn: { type: 'integer' },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimit' },
      },
    },
  },
  '/api/v1/auth/register': {
    post: {
      tags: ['Authentication'],
      summary: 'User registration',
      description: 'Register a new user account',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['email', 'password', 'firstName', 'lastName'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 6 },
                firstName: { type: 'string' },
                lastName: { type: 'string' },
                acceptTerms: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'User registered successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          user: { $ref: '#/components/schemas/User' },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: { $ref: '#/components/responses/BadRequest' },
        409: {
          description: 'Email already exists',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        429: { $ref: '#/components/responses/RateLimit' },
      },
    },
  },
  '/api/v1/content/catalog': {
    get: {
      tags: ['Content'],
      summary: 'Get content catalog',
      description: 'Retrieve paginated content catalog with filters',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number',
        },
        {
          name: 'limit',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Items per page',
        },
        {
          name: 'type',
          in: 'query',
          schema: { type: 'string', enum: ['MOVIE', 'SERIES', 'DOCUMENTARY'] },
          description: 'Content type filter',
        },
        {
          name: 'genre',
          in: 'query',
          schema: { type: 'string' },
          description: 'Genre filter (comma-separated)',
        },
        {
          name: 'sortBy',
          in: 'query',
          schema: { type: 'string', enum: ['releaseDate', 'title', 'rating', 'popularity'] },
          description: 'Sort field',
        },
      ],
      responses: {
        200: {
          description: 'Content catalog retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          content: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Content' },
                          },
                          pagination: {
                            type: 'object',
                            properties: {
                              currentPage: { type: 'integer' },
                              totalPages: { type: 'integer' },
                              totalItems: { type: 'integer' },
                              hasNext: { type: 'boolean' },
                              hasPrev: { type: 'boolean' },
                            },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: { $ref: '#/components/responses/BadRequest' },
        429: { $ref: '#/components/responses/RateLimit' },
        503: { $ref: '#/components/responses/ServiceUnavailable' },
      },
    },
  },
  '/api/v1/streaming/play/{contentId}': {
    post: {
      tags: ['Streaming'],
      summary: 'Get streaming URLs',
      description: 'Get streaming URLs for content playback',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'contentId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: 'Content ID',
        },
        {
          name: 'episodeId',
          in: 'query',
          schema: { type: 'string' },
          description: 'Episode ID for series content',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['profileId'],
              properties: {
                profileId: { type: 'string' },
                quality: { type: 'string', enum: ['SD', 'HD', 'UHD'] },
                device: {
                  type: 'object',
                  properties: {
                    type: { type: 'string' },
                    userAgent: { type: 'string' },
                    ipAddress: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Streaming URLs retrieved successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          streamingUrls: {
                            type: 'object',
                            properties: {
                              hls: { type: 'string', format: 'uri' },
                              dash: { type: 'string', format: 'uri' },
                            },
                          },
                          sessionToken: { type: 'string' },
                          expiresAt: { type: 'string', format: 'date-time' },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        429: { $ref: '#/components/responses/RateLimit' },
      },
    },
  },
  '/api/v1/payment/subscriptions': {
    post: {
      tags: ['Payment'],
      summary: 'Create subscription',
      description: 'Create a new subscription for the user',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['planType', 'billingCycle', 'paymentMethodId'],
              properties: {
                planType: { type: 'string', enum: ['BASIC', 'STANDARD', 'PREMIUM'] },
                billingCycle: { type: 'string', enum: ['MONTHLY', 'ANNUAL'] },
                paymentMethodId: { type: 'string' },
                couponCode: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Subscription created successfully',
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { $ref: '#/components/schemas/ApiResponse' },
                  {
                    properties: {
                      data: {
                        type: 'object',
                        properties: {
                          subscription: { $ref: '#/components/schemas/Subscription' },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        },
        400: { $ref: '#/components/responses/BadRequest' },
        401: { $ref: '#/components/responses/Unauthorized' },
        429: { $ref: '#/components/responses/RateLimit' },
      },
    },
  },
};

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none }
  .swagger-ui .info .title { color: #e50914 }
  .swagger-ui .scheme-container { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
`;

// Swagger UI options
const swaggerUiOptions = {
  customCss,
  customSiteTitle: 'WatchFlixx API Gateway Documentation',
  customfavIcon: '/favicon.ico',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'none',
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
  },
};

// Serve Swagger documentation if enabled
if (config.swagger.enabled) {
  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(swaggerSpec, swaggerUiOptions));
  
  // Serve raw OpenAPI spec
  router.get('/openapi.json', (req, res) => {
    res.json(swaggerSpec);
  });
  
  // Serve OpenAPI spec in YAML format
  router.get('/openapi.yaml', (req, res) => {
    res.setHeader('Content-Type', 'application/x-yaml');
    res.send(JSON.stringify(swaggerSpec)); // In production, use a proper YAML library
  });
} else {
  // If Swagger is disabled, show a message
  router.get('/', (req, res) => {
    res.json({
      message: 'API documentation is disabled',
      timestamp: new Date().toISOString(),
    });
  });
}

export default router;
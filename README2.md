# WatchFlixx API Gateway

A comprehensive API Gateway for the WatchFlixx streaming platform, providing unified access to all microservices with advanced features like load balancing, circuit breakers, rate limiting, and real-time monitoring.

## 🚀 Features

### Core Gateway Features

- **Service Proxying**: Intelligent routing to microservices
- **Load Balancing**: Multiple strategies (round-robin, least-connections, weighted, random)
- **Circuit Breakers**: Automatic failover and recovery
- **Rate Limiting**: Distributed rate limiting with Redis
- **Authentication**: JWT-based auth with role-based access control
- **Request/Response Transformation**: Header manipulation and payload processing

### Advanced Features

- **Real-time Monitoring**: Comprehensive metrics and health checks
- **WebSocket Support**: Proxy WebSocket connections for real-time features
- **API Documentation**: Auto-generated Swagger/OpenAPI documentation
- **Security**: CORS, Helmet, compression, and request validation
- **Logging**: Structured logging with request tracking
- **Graceful Shutdown**: Clean resource cleanup on termination

## 📋 Prerequisites

- Node.js 18+
- Redis (for rate limiting and caching)
- PostgreSQL (for microservices)
- Docker (optional)

## 🛠️ Installation

### Local Development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment setup**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Build the application**

   ```bash
   npm run build
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

### Docker Deployment

1. **Build Docker image**

   ```bash
   docker build -t watchflixx-gateway .
   ```

2. **Run container**
   ```bash
   docker run -p 3000:3000 --env-file .env watchflixx-gateway
   ```

## ⚙️ Configuration

### Environment Variables

| Variable              | Description             | Default                  |
| --------------------- | ----------------------- | ------------------------ |
| `PORT`                | Server port             | `3000`                   |
| `NODE_ENV`            | Environment             | `development`            |
| `JWT_SECRET`          | JWT signing secret      | Required                 |
| `REDIS_URL`           | Redis connection string | `redis://localhost:6379` |
| `AUTH_SERVICE_URL`    | Auth service URL        | `http://localhost:3001`  |
| `CONTENT_SERVICE_URL` | Content service URL     | `http://localhost:3002`  |

See `.env.example` for complete configuration options.

### Service Configuration

The gateway automatically configures routes for:

- **Authentication Service** (`/api/v1/auth/*`)
- **Content Service** (`/api/v1/content/*`)
- **Streaming Service** (`/api/v1/streaming/*`)
- **Payment Service** (`/api/v1/payment/*`)
- **Social Service** (`/api/v1/social/*`)
- **Analytics Service** (`/api/v1/analytics/*`)
- **Notification Service** (`/api/v1/notifications/*`)

## 🔧 Usage

### Starting the Gateway

```bash
# Development
npm run dev

# Production
npm start

# With Docker
docker-compose up
```

### API Endpoints

#### Health Check

```bash
GET /health
```

#### API Documentation

```bash
GET /docs
```

#### Monitoring Dashboard

```bash
GET /monitoring/dashboard
```

#### Service-specific Health

```bash
GET /health/:service
```

### Authentication

Most endpoints require JWT authentication:

```bash
curl -H "Authorization: Bearer <jwt_token>" \
     http://localhost:3000/api/v1/content/catalog
```

### Rate Limiting

The gateway implements distributed rate limiting:

- **Default**: 1000 requests/hour per user
- **Authentication**: 5 requests/15 minutes per IP
- **Search**: 30 requests/minute per user
- **Payment**: 10 requests/minute per user

Rate limit headers are included in responses:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 995
X-RateLimit-Reset: 1640781600
```

## 🔍 Monitoring

### Health Checks

The gateway provides comprehensive health monitoring:

```bash
# Overall health
GET /health

# Service-specific health
GET /health/auth
GET /health/content

# Detailed monitoring (requires API key)
GET /monitoring/metrics
GET /monitoring/dashboard
```

### Metrics

Available metrics include:

- **Request Metrics**: Count, response times, error rates
- **Service Health**: Uptime, response times, error counts
- **Circuit Breaker Status**: State, failure counts, recovery times
- **Load Balancer Stats**: Instance health, connection counts
- **User Activity**: Active users, request patterns

### Prometheus Integration

Metrics are available in Prometheus format:

```bash
GET /metrics
```

Example metrics:

```
# HELP watchflixx_gateway_requests_total Total number of requests
# TYPE watchflixx_gateway_requests_total counter
watchflixx_gateway_requests_total 1500

# HELP watchflixx_gateway_response_time_seconds Response time in seconds
# TYPE watchflixx_gateway_response_time_seconds histogram
watchflixx_gateway_response_time_seconds{quantile="0.95"} 0.245
```

## 🔐 Security

### Authentication & Authorization

- **JWT Authentication**: Bearer token validation
- **Role-based Access Control**: Admin, user, service roles
- **API Key Authentication**: Service-to-service communication
- **Subscription Validation**: Plan-based access control

### Security Middleware

- **Helmet**: Security headers
- **CORS**: Cross-origin request handling
- **Rate Limiting**: DDoS protection
- **Request Validation**: Input sanitization
- **Size Limiting**: Payload size restrictions

### Example Protected Route

```typescript
router.use(
  "/admin/*",
  authenticate, // Require valid JWT
  requireRole(["admin"]), // Require admin role
  adminRateLimit, // Apply admin rate limits
  adminProxy // Proxy to admin endpoints
);
```

## 🔄 Circuit Breakers

Circuit breakers prevent cascade failures:

### States

- **CLOSED**: Normal operation
- **OPEN**: Failing fast, requests rejected
- **HALF-OPEN**: Testing recovery

### Configuration

```javascript
{
  threshold: 5,        // Failures before opening
  timeout: 60000,      // Time to stay open (ms)
  resetTimeout: 30000  // Time before retry (ms)
}
```

### Manual Control

```bash
# Reset circuit breaker
POST /monitoring/circuit-breakers/auth/reset

# Force open circuit breaker
POST /monitoring/circuit-breakers/auth/open
```

## ⚖️ Load Balancing

Multiple load balancing strategies:

### Round Robin

```javascript
// Cycles through instances equally
instance1 -> instance2 -> instance3 -> instance1
```

### Least Connections

```javascript
// Routes to instance with fewest active connections
{ instance1: 5, instance2: 3, instance3: 7 } -> instance2
```

### Weighted

```javascript
// Routes based on instance weights
{ instance1: weight=3, instance2: weight=1 } -> 75% to instance1
```

### Random

```javascript
// Random selection from healthy instances
```

## 📊 Request Flow

```
Client Request
    ↓
API Gateway
    ↓
Authentication Middleware
    ↓
Rate Limiting
    ↓
Request Validation
    ↓
Load Balancer
    ↓
Circuit Breaker
    ↓
Service Proxy
    ↓
Microservice
    ↓
Response Transformation
    ↓
Client Response
```

## 🚨 Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_ERROR",
    "message": "Too many requests",
    "details": {}
  },
  "timestamp": "2023-12-07T10:30:00Z",
  "requestId": "req_123456789"
}
```

### Error Types

- `VALIDATION_ERROR`: Invalid input
- `AUTHENTICATION_ERROR`: Auth required/failed
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `RATE_LIMIT_ERROR`: Rate limit exceeded
- `SERVICE_UNAVAILABLE`: Service down/unreachable
- `GATEWAY_TIMEOUT`: Request timeout
- `BAD_GATEWAY`: Service error

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### Load Testing

```bash
# Using artillery (install globally)
artillery run load-test.yml
```

### Health Check Testing

```bash
# Test all services
curl http://localhost:3000/health

# Test specific service
curl http://localhost:3000/health/auth
```

## 📈 Performance

### Optimizations

- **Connection Pooling**: Reuse HTTP connections
- **Response Caching**: Cache frequent responses
- **Compression**: Gzip/deflate compression
- **Keep-Alive**: Persistent connections
- **Request Batching**: Batch similar requests

### Benchmarks

- **Throughput**: 10,000+ requests/second
- **Latency**: <10ms median response time
- **Memory**: <512MB under load
- **CPU**: <50% utilization at peak

## 🔧 Development

### Project Structure

```
src/
├── config/           # Configuration management
├── middleware/       # Express middleware
├── routes/          # API route definitions
├── services/        # Core services (proxy, monitoring, etc.)
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── server.ts        # Main application entry
```

### Adding New Services

1. **Update configuration**

   ```typescript
   // config/index.ts
   services: {
     newService: process.env.NEW_SERVICE_URL || "http://localhost:3008";
   }
   ```

2. **Create proxy**

   ```typescript
   // routes/index.ts
   const newServiceProxy = proxyService.createServiceProxy({
     serviceName: "newService",
     targetUrls: [config.services.newService],
     pathRewrite: { "^/api/v1/new": "/v1" },
   });
   ```

3. **Add routes**
   ```typescript
   router.use("/new/*", authenticate, defaultRateLimit, newServiceProxy);
   ```

### Custom Middleware

```typescript
// middleware/custom.ts
export const customMiddleware = (req, res, next) => {
  // Custom logic
  next();
};

// routes/index.ts
router.use("/api/v1/custom", customMiddleware, serviceProxy);
```

## 🐳 Docker Support

### Multi-stage Build

```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production
RUN adduser -D watchflixx
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --only=production
USER watchflixx
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Docker Compose

```yaml
version: "3.8"
services:
  gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

## 📚 API Documentation

Interactive API documentation is available at `/docs` when `SWAGGER_ENABLED=true`.

### Key Endpoints

#### Authentication

- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/refresh` - Token refresh

#### Content

- `GET /api/v1/content/catalog` - Browse content
- `GET /api/v1/content/search` - Search content
- `GET /api/v1/content/:id` - Get content details

#### Streaming

- `POST /api/v1/streaming/play/:id` - Get streaming URLs
- `POST /api/v1/streaming/progress` - Update progress
- `GET /api/v1/streaming/history` - View history

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Style

- Use TypeScript
- Follow ESLint rules
- Add JSDoc comments
- Write unit tests
- Update documentation

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/watchflixx/gateway/issues)
- **Documentation**: [API Docs](https://docs.watchflixx.com)
- **Email**: api-support@watchflixx.com

## 🔗 Related Projects

- [WatchFlixx Frontend](https://github.com/watchflixx/frontend)
- [WatchFlixx Auth Service](https://github.com/watchflixx/auth-service)
- [WatchFlixx Content Service](https://github.com/watchflixx/content-service)

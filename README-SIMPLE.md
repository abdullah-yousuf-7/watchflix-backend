# Simple WatchFlixx API Gateway

A basic, lightweight API Gateway for the WatchFlixx streaming platform without advanced features like rate limiting, monitoring, or Swagger documentation.

## Features

- ✅ Service proxying to microservices
- ✅ Basic JWT authentication
- ✅ CORS and security headers
- ✅ Request compression
- ✅ Health check endpoint
- ✅ Error handling
- ✅ Request logging

## Quick Start

### 1. Install Dependencies

```bash
# Copy the simple configuration files
cp package-simple.json package.json
cp tsconfig-simple.json tsconfig.json
cp .env-simple .env

# Install dependencies
npm install
```

### 2. Update Service URLs

Edit the `.env` file with your actual service URLs:

```bash
# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
CONTENT_SERVICE_URL=http://localhost:3002
STREAMING_SERVICE_URL=http://localhost:3003
PAYMENT_SERVICE_URL=http://localhost:3004
SOCIAL_SERVICE_URL=http://localhost:3005
ANALYTICS_SERVICE_URL=http://localhost:3006
NOTIFICATION_SERVICE_URL=http://localhost:3007
```

### 3. Run the Gateway

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm run build
npm start
```

The gateway will start on `http://localhost:3000`

## API Endpoints

### Health Check
```bash
GET /health
```

### Authentication (No auth required)
```bash
POST /api/v1/auth/login
POST /api/v1/auth/register
```

### Protected Endpoints (Require Bearer token)
```bash
# Content Service
GET /api/v1/content/*

# Streaming Service  
GET /api/v1/streaming/*

# Payment Service
GET /api/v1/payment/*

# Social Service
GET /api/v1/social/*

# Analytics Service
GET /api/v1/analytics/*

# Notification Service
GET /api/v1/notifications/*
```

## Authentication

For protected endpoints, include the JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     http://localhost:3000/api/v1/content/catalog
```

## Service Configuration

The gateway automatically routes requests to the appropriate microservice:

- `/api/v1/auth/*` → Auth Service
- `/api/v1/content/*` → Content Service  
- `/api/v1/streaming/*` → Streaming Service
- `/api/v1/payment/*` → Payment Service
- `/api/v1/social/*` → Social Service
- `/api/v1/analytics/*` → Analytics Service
- `/api/v1/notifications/*` → Notification Service

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

Common error codes:
- `NOT_FOUND` - Endpoint not found
- `SERVICE_UNAVAILABLE` - Microservice is down
- `INTERNAL_ERROR` - Server error

## Frontend Configuration

Use this as your API base URL in the frontend:

```javascript
const API_BASE_URL = 'http://localhost:3000/api/v1';
```

## Project Structure

```
src/
└── simple-server.ts    # Main gateway server
```

## Adding New Services

1. Add service URL to `.env`:
```bash
NEW_SERVICE_URL=http://localhost:3008
```

2. Add service to `SERVICES` object in `simple-server.ts`:
```typescript
const SERVICES = {
  // ... existing services
  newService: process.env.NEW_SERVICE_URL || 'http://localhost:3008',
};
```

3. Add route:
```typescript
app.use('/api/v1/new-service', authenticate, createServiceProxy('new-service', SERVICES.newService));
```

## Testing

Test the gateway health:
```bash
curl http://localhost:3000/health
```

Test authentication:
```bash
# This should return 401
curl http://localhost:3000/api/v1/content/catalog

# This should proxy to the content service
curl -H "Authorization: Bearer dummy-token" \
     http://localhost:3000/api/v1/content/catalog
```
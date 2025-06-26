# WatchFlixx Backend - Microservices Architecture

A scalable streaming platform backend built with microservices architecture, shared database schema, and event-driven synchronization.

## 🏗️ Architecture Overview

The WatchFlixx backend is designed as a microservices architecture with the following services:

### Services

1. **Authentication Service** (`auth`) - User authentication, profiles, and account management
2. **Content Management Service** (`content`) - Content metadata, seasons, episodes, and media files
3. **Streaming Service** (`streaming`) - Video playback, watch history, and viewing sessions
4. **Payment Service** (`payment`) - Subscriptions, billing, and content rentals
5. **Social Service** (`social`) - Party watch, messaging, and social features
6. **Analytics Service** (`analytics`) - User analytics, content metrics, and reporting
7. **Notification Service** (`notification`) - Notifications, support tickets, and messaging

### Shared Database Schema

All microservices use a **shared PostgreSQL database** with synchronized schema:

- Single source of truth for data models
- Cross-service data consistency
- Event sourcing for inter-service communication
- Optimistic locking with version control
- Service-specific indexes for performance

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Redis 7+

### Installation

1. **Clone and setup**

   ```bash
   cd backend
   npm install
   ```

2. **Environment configuration**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database setup**

   ```bash
   # Start database
   docker-compose up postgres redis -d

   # Generate Prisma client
   npm run db:generate

   # Run migrations
   npm run db:migrate
   ```

4. **Sync schema across microservices**

   ```bash
   npm run microservices:sync
   ```

5. **Start all microservices**
   ```bash
   npm run microservices:start
   ```

## 📊 Database Schema

### Core Models by Service

#### Authentication Service

- `User` - User accounts and authentication
- `UserSettings` - User preferences and settings
- `Device` - Device tracking and sessions
- `Profile` - User profiles with parental controls
- `ProfileSettings` - Profile-specific preferences

#### Content Management Service

- `Content` - Movies, series, documentaries
- `Season` - TV show seasons
- `Episode` - Individual episodes
- `CastMember` / `CrewMember` - Cast and crew information
- `VideoFile` / `SubtitleFile` - Media assets

#### Streaming Service

- `WatchHistory` - User viewing progress
- `ViewingSession` - Detailed playback analytics
- `Watchlist` - User content lists
- `Rating` / `Review` - User content ratings

#### Payment Service

- `Subscription` - User subscription plans
- `PaymentMethod` - Stored payment methods
- `Invoice` - Billing and payment history
- `Rental` - Individual content rentals

#### Social Service

- `PartyWatchSession` - Group viewing sessions
- `PartyWatchMember` - Party participants
- `PartyWatchMessage` - Party chat messages

#### Analytics Service

- `ContentAnalytics` - Content performance metrics
- `ViewingSession` - Detailed viewing analytics

#### Notification Service

- `Notification` - User notifications
- `SupportTicket` - Customer support tickets
- `SupportResponse` - Support interactions

### Schema Synchronization

The schema includes built-in synchronization features:

```prisma
// Each model includes sync metadata
version   Int      @default(1)    // Optimistic locking
syncedAt  DateTime @default(now()) // Last sync timestamp

// Event sourcing for cross-service communication
model ServiceEvent {
  eventType   String   // UserCreated, ContentUpdated, etc.
  service     String   // Originating service
  aggregateId String   // Entity ID
  payload     Json     // Event data
  processedBy String[] // Services that processed this event
}
```

## 🔄 Microservices Management

### Schema Synchronization

```bash
# Sync schema to all services
npm run microservices:sync

# Validate schema consistency
npm run microservices:validate

# Sync specific service only
node scripts/sync-schema.js --service auth
```

### Service Operations

```bash
# Start all services
npm run microservices:start

# Stop all services
npm run microservices:stop

# View logs
npm run microservices:logs

# Rebuild and restart
npm run microservices:rebuild
```

### Individual Service Development

```bash
# Work on specific service
cd services/auth
npm install
npm run dev

# Generate Prisma client for service
npm run db:generate

# Run service tests
npm test
```

## 🔧 Configuration

### Microservices Configuration

See `microservices.config.json` for complete service configuration:

```json
{
  "microservices": {
    "auth": {
      "port": 3001,
      "primaryModels": ["User", "Profile"],
      "eventTypes": ["UserCreated", "ProfileUpdated"]
    }
  }
}
```

### Environment Variables

Key environment variables in `.env`:

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/watchflixx"

# Event Bus
REDIS_URL="redis://localhost:6379"

# External Services
STRIPE_SECRET_KEY="sk_test_..."
SENDGRID_API_KEY="SG..."

# Service Discovery
AUTH_SERVICE_URL="http://localhost:3001"
CONTENT_SERVICE_URL="http://localhost:3002"
```

## 📈 Monitoring & Health Checks

### Service Health

Each service exposes health endpoints:

```bash
# Check service health
curl http://localhost:3001/health  # Auth service
curl http://localhost:3002/health  # Content service
```

### Database Monitoring

```bash
# Open Prisma Studio
npm run db:studio

# Monitor sync status
SELECT * FROM service_status;
SELECT * FROM service_events ORDER BY created_at DESC LIMIT 10;
```

### Event Bus Monitoring

```bash
# Monitor Redis event channels
redis-cli MONITOR

# Check event processing
redis-cli LLEN watchflixx:events:user
```

## 🧪 Testing

### Database Testing

```bash
# Reset test database
npm run db:reset

# Seed test data
npm run db:seed

# Run with test database
DATABASE_URL="postgresql://user:pass@localhost:5432/watchflixx_test" npm test
```

### Integration Testing

```bash
# Test cross-service communication
npm run test:integration

# Test event synchronization
npm run test:events
```

## 📦 Deployment

### Production Deployment

```bash
# Build all services
npm run build

# Deploy database migrations
npm run db:deploy

# Start production services
NODE_ENV=production npm run microservices:start
```

### Docker Deployment

```bash
# Build production images
docker-compose -f docker-compose.microservices.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Development Workflow

### Adding New Features

1. **Update Schema**: Modify `prisma/schema.prisma`
2. **Sync Services**: Run `npm run microservices:sync`
3. **Generate Migrations**: Run `npm run db:migrate`
4. **Update Service Logic**: Implement in relevant service
5. **Add Events**: Update event types if needed
6. **Test**: Run tests across affected services

### Schema Changes

1. Always update the shared schema in `prisma/schema.prisma`
2. Run synchronization script to update all services
3. Test schema changes across all services
4. Deploy migrations in the correct order

### Adding New Microservice

1. Create service directory in `services/`
2. Add service configuration to `microservices.config.json`
3. Update Docker Compose configuration
4. Run schema sync to copy schema
5. Implement service-specific logic

## 📝 API Documentation

### Service Endpoints

- **Auth Service**: `http://localhost:3001` - Authentication, users, profiles
- **Content Service**: `http://localhost:3002` - Content management, metadata
- **Streaming Service**: `http://localhost:3003` - Playback, watch history
- **Payment Service**: `http://localhost:3004` - Subscriptions, billing
- **Social Service**: `http://localhost:3005` - Party watch, social features
- **Analytics Service**: `http://localhost:3006` - Analytics, reporting
- **Notification Service**: `http://localhost:3007` - Notifications, support

### API Gateway

All services are accessible through the API Gateway at `http://localhost:3000`

## 🤝 Contributing

1. Follow the microservices architecture principles
2. Always sync schema changes across all services
3. Use event sourcing for cross-service communication
4. Write tests for both individual services and integration
5. Update documentation for any API changes

## 📄 License

MIT License - see LICENSE file for details.

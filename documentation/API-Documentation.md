# WatchFlixx API Documentation

Complete API documentation for the WatchFlixx streaming platform microservices architecture.

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication APIs](#authentication-apis)
3. [Profile Management APIs](#profile-management-apis)
4. [Content Management APIs](#content-management-apis)
5. [Streaming & Playback APIs](#streaming--playback-apis)
6. [Payment & Subscription APIs](#payment--subscription-apis)
7. [Social Features APIs](#social-features-apis)
8. [Analytics APIs](#analytics-apis)
9. [Notification APIs](#notification-apis)
10. [Socket.IO Events](#socketio-events)
11. [Error Handling](#error-handling)
12. [Rate Limiting](#rate-limiting)

## 🌐 API Overview

### Base URLs
- **API Gateway**: `https://api.watchflixx.com/v1`
- **Auth Service**: `https://auth.watchflixx.com/v1`
- **Content Service**: `https://content.watchflixx.com/v1`
- **Streaming Service**: `https://streaming.watchflixx.com/v1`
- **Payment Service**: `https://payment.watchflixx.com/v1`
- **Social Service**: `https://social.watchflixx.com/v1`
- **Analytics Service**: `https://analytics.watchflixx.com/v1`
- **Notification Service**: `https://notification.watchflixx.com/v1`

### Authentication
All authenticated endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Common Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation completed successfully",
  "timestamp": "2023-12-07T10:30:00Z",
  "version": "1.0.0"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  },
  "timestamp": "2023-12-07T10:30:00Z"
}
```

---

## 🔐 Authentication APIs

### Register User
**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "acceptTerms": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isVerified": false,
      "createdAt": "2023-12-07T10:30:00Z"
    },
    "message": "Verification email sent to user@example.com"
  }
}
```

### Login User
**POST** `/auth/login`

Authenticate user and return access token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isVerified": true
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 3600
    },
    "subscription": {
      "planType": "PREMIUM",
      "status": "ACTIVE",
      "expiresAt": "2024-01-07T10:30:00Z"
    }
  }
}
```

### OAuth Login
**POST** `/auth/oauth/{provider}`

Login with OAuth provider (google, apple).

**Parameters:**
- `provider` (path): OAuth provider (`google`, `apple`)

**Request Body:**
```json
{
  "token": "oauth_provider_token",
  "redirectUri": "https://app.watchflixx.com/callback"
}
```

### Forgot Password
**POST** `/auth/forgot-password`

Request password reset.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### Reset Password
**POST** `/auth/reset-password`

Reset password with OTP.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "newSecurePassword123"
}
```

### Verify Email
**POST** `/auth/verify-email`

Verify user email address.

**Request Body:**
```json
{
  "token": "verification_token"
}
```

### Refresh Token
**POST** `/auth/refresh`

Refresh access token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Logout
**POST** `/auth/logout`

Logout user and invalidate tokens.

**Headers:** `Authorization: Bearer <token>`

---

## 👤 Profile Management APIs

### Get User Profiles
**GET** `/auth/profiles`

Get all profiles for the authenticated user.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "profiles": [
      {
        "id": "profile_123",
        "name": "John Doe",
        "avatar": "https://cdn.watchflixx.com/avatars/john.jpg",
        "ageCategory": "ADULT",
        "isDefault": true,
        "pinEnabled": false,
        "contentRating": "R",
        "createdAt": "2023-12-07T10:30:00Z"
      }
    ]
  }
}
```

### Create Profile
**POST** `/auth/profiles`

Create a new profile.

**Request Body:**
```json
{
  "name": "Kids Profile",
  "avatar": "https://cdn.watchflixx.com/avatars/kid1.jpg",
  "ageCategory": "CHILD",
  "contentRating": "G",
  "pinEnabled": false,
  "blockedGenres": ["horror", "thriller"],
  "viewingTimeLimit": 120
}
```

### Update Profile
**PUT** `/auth/profiles/{profileId}`

Update profile information.

**Parameters:**
- `profileId` (path): Profile ID

**Request Body:**
```json
{
  "name": "Updated Name",
  "avatar": "https://cdn.watchflixx.com/avatars/new.jpg",
  "contentRating": "PG-13",
  "pinEnabled": true,
  "pin": "1234"
}
```

### Delete Profile
**DELETE** `/auth/profiles/{profileId}`

Delete a profile.

**Parameters:**
- `profileId` (path): Profile ID

### Switch Profile
**POST** `/auth/profiles/{profileId}/switch`

Switch to a different profile.

**Parameters:**
- `profileId` (path): Profile ID

**Request Body:**
```json
{
  "pin": "1234"
}
```

---

## 🎬 Content Management APIs

### Get Content Catalog
**GET** `/content/catalog`

Get paginated content catalog with filters.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `type` (optional): Content type (`MOVIE`, `SERIES`, `DOCUMENTARY`)
- `genre` (optional): Genre filter (comma-separated)
- `language` (optional): Language filter
- `contentRating` (optional): Content rating filter
- `sortBy` (optional): Sort field (`releaseDate`, `title`, `rating`, `popularity`)
- `sortOrder` (optional): Sort order (`asc`, `desc`)

**Response:**
```json
{
  "success": true,
  "data": {
    "content": [
      {
        "id": "content_123",
        "title": "The Great Adventure",
        "description": "An epic adventure movie",
        "synopsis": "A group of explorers...",
        "type": "MOVIE",
        "genre": ["adventure", "action"],
        "releaseDate": "2023-06-15T00:00:00Z",
        "duration": 142,
        "contentRating": "PG-13",
        "posterUrl": "https://cdn.watchflixx.com/posters/adventure.jpg",
        "backdropUrl": "https://cdn.watchflixx.com/backdrops/adventure.jpg",
        "trailerUrl": "https://cdn.watchflixx.com/trailers/adventure.mp4",
        "imdbRating": 8.5,
        "watchflixxRating": 4.2,
        "isAvailable": true,
        "requiresSubscription": true,
        "isRentalOnly": false
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 50,
      "totalItems": 1000,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

### Get Content Details
**GET** `/content/{contentId}`

Get detailed information about specific content.

**Parameters:**
- `contentId` (path): Content ID

**Response:**
```json
{
  "success": true,
  "data": {
    "content": {
      "id": "content_123",
      "title": "The Great Adventure",
      "description": "An epic adventure movie",
      "synopsis": "A detailed synopsis...",
      "type": "MOVIE",
      "genre": ["adventure", "action"],
      "tags": ["heroic", "journey", "friendship"],
      "releaseDate": "2023-06-15T00:00:00Z",
      "country": ["US"],
      "language": ["en"],
      "duration": 142,
      "contentRating": "PG-13",
      "posterUrl": "https://cdn.watchflixx.com/posters/adventure.jpg",
      "backdropUrl": "https://cdn.watchflixx.com/backdrops/adventure.jpg",
      "trailerUrl": "https://cdn.watchflixx.com/trailers/adventure.mp4",
      "logoUrl": "https://cdn.watchflixx.com/logos/adventure.png",
      "imdbRating": 8.5,
      "imdbId": "tt1234567",
      "tmdbId": "12345",
      "cast": [
        {
          "name": "John Smith",
          "character": "Hero",
          "order": 1,
          "imageUrl": "https://cdn.watchflixx.com/cast/john.jpg"
        }
      ],
      "crew": [
        {
          "name": "Jane Director",
          "job": "Director",
          "department": "Directing"
        }
      ],
      "availableQualities": ["SD", "HD", "UHD"],
      "subtitleLanguages": ["en", "es", "fr"],
      "audioLanguages": ["en", "es"]
    }
  }
}
```

### Get Series Details
**GET** `/content/{seriesId}/seasons`

Get seasons and episodes for a series.

**Parameters:**
- `seriesId` (path): Series content ID

**Response:**
```json
{
  "success": true,
  "data": {
    "seasons": [
      {
        "id": "season_123",
        "seasonNumber": 1,
        "title": "Season 1",
        "description": "The first season",
        "posterUrl": "https://cdn.watchflixx.com/seasons/s1.jpg",
        "airDate": "2023-01-10T00:00:00Z",
        "episodeCount": 10,
        "episodes": [
          {
            "id": "episode_123",
            "episodeNumber": 1,
            "title": "Pilot",
            "description": "The first episode",
            "duration": 45,
            "stillUrl": "https://cdn.watchflixx.com/stills/ep1.jpg",
            "airDate": "2023-01-10T00:00:00Z"
          }
        ]
      }
    ]
  }
}
```

### Search Content
**GET** `/content/search`

Search content by title, cast, crew, or description.

**Query Parameters:**
- `q` (required): Search query
- `type` (optional): Content type filter
- `limit` (optional): Results limit (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "content_123",
        "title": "The Great Adventure",
        "type": "MOVIE",
        "posterUrl": "https://cdn.watchflixx.com/posters/adventure.jpg",
        "releaseDate": "2023-06-15T00:00:00Z",
        "matchType": "title",
        "relevanceScore": 0.95
      }
    ],
    "totalResults": 15,
    "searchTime": 0.045
  }
}
```

### Get Trending Content
**GET** `/content/trending`

Get trending content based on views and engagement.

**Query Parameters:**
- `timeframe` (optional): Trending timeframe (`day`, `week`, `month`)
- `type` (optional): Content type filter
- `limit` (optional): Results limit (default: 20)

---

## ▶️ Streaming & Playback APIs

### Get Streaming URL
**POST** `/streaming/play/{contentId}`

Get streaming URLs for content playback.

**Parameters:**
- `contentId` (path): Content ID
- `episodeId` (query, optional): Episode ID for series

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "profileId": "profile_123",
  "quality": "HD",
  "device": {
    "type": "WEB",
    "userAgent": "Mozilla/5.0...",
    "ipAddress": "192.168.1.1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "streamingUrls": {
      "hls": "https://stream.watchflixx.com/hls/content_123/playlist.m3u8",
      "dash": "https://stream.watchflixx.com/dash/content_123/manifest.mpd"
    },
    "subtitles": [
      {
        "language": "en",
        "label": "English",
        "url": "https://cdn.watchflixx.com/subtitles/content_123_en.vtt",
        "isDefault": true
      }
    ],
    "audioTracks": [
      {
        "language": "en",
        "label": "English",
        "isDefault": true
      }
    ],
    "sessionToken": "stream_session_456",
    "expiresAt": "2023-12-07T14:30:00Z",
    "maxQuality": "UHD",
    "allowedDevices": 4
  }
}
```

### Update Playback Progress
**POST** `/streaming/progress`

Update user's playback progress.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "profileId": "profile_123",
  "contentId": "content_123",
  "episodeId": "episode_123",
  "watchedDuration": 1800,
  "totalDuration": 2700,
  "progressPercent": 66.67,
  "isCompleted": false,
  "device": {
    "type": "WEB",
    "sessionId": "session_789"
  }
}
```

### Get Watch History
**GET** `/streaming/history`

Get user's watch history.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `profileId` (required): Profile ID
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (`completed`, `in_progress`, `started`)

**Response:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "history_123",
        "content": {
          "id": "content_123",
          "title": "The Great Adventure",
          "posterUrl": "https://cdn.watchflixx.com/posters/adventure.jpg",
          "type": "MOVIE"
        },
        "episode": null,
        "watchedDuration": 1800,
        "totalDuration": 2700,
        "progressPercent": 66.67,
        "isCompleted": false,
        "lastWatchedAt": "2023-12-07T10:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalItems": 100
    }
  }
}
```

### Get Watchlist
**GET** `/streaming/watchlist`

Get user's watchlist.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `profileId` (required): Profile ID

**Response:**
```json
{
  "success": true,
  "data": {
    "watchlist": [
      {
        "id": "watchlist_123",
        "content": {
          "id": "content_123",
          "title": "The Great Adventure",
          "posterUrl": "https://cdn.watchflixx.com/posters/adventure.jpg",
          "type": "MOVIE",
          "releaseDate": "2023-06-15T00:00:00Z"
        },
        "addedAt": "2023-12-07T10:30:00Z"
      }
    ]
  }
}
```

### Add to Watchlist
**POST** `/streaming/watchlist`

Add content to user's watchlist.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "profileId": "profile_123",
  "contentId": "content_123"
}
```

### Remove from Watchlist
**DELETE** `/streaming/watchlist/{contentId}`

Remove content from watchlist.

**Parameters:**
- `contentId` (path): Content ID

**Query Parameters:**
- `profileId` (required): Profile ID

### Rate Content
**POST** `/streaming/rate`

Rate content.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "profileId": "profile_123",
  "contentId": "content_123",
  "rating": 5
}
```

### Review Content
**POST** `/streaming/review`

Submit content review.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "profileId": "profile_123",
  "contentId": "content_123",
  "rating": 5,
  "title": "Amazing movie!",
  "text": "This movie was absolutely incredible..."
}
```

---

## 💳 Payment & Subscription APIs

### Get Subscription Plans
**GET** `/payment/plans`

Get available subscription plans.

**Response:**
```json
{
  "success": true,
  "data": {
    "plans": [
      {
        "id": "basic",
        "name": "Basic",
        "description": "SD quality, 1 device",
        "features": [
          "SD quality streaming (480p)",
          "1 concurrent device",
          "Basic content library",
          "Email support"
        ],
        "pricing": {
          "monthly": {
            "amount": 999,
            "currency": "USD",
            "stripePriceId": "price_basic_monthly"
          },
          "annual": {
            "amount": 9999,
            "currency": "USD",
            "stripePriceId": "price_basic_annual",
            "discount": 17
          }
        }
      }
    ]
  }
}
```

### Create Subscription
**POST** `/payment/subscriptions`

Create a new subscription.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "planType": "PREMIUM",
  "billingCycle": "MONTHLY",
  "paymentMethodId": "pm_stripe_payment_method_id",
  "couponCode": "SAVE20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "planType": "PREMIUM",
      "billingCycle": "MONTHLY",
      "status": "ACTIVE",
      "amount": 1999,
      "currency": "USD",
      "currentPeriodStart": "2023-12-07T10:30:00Z",
      "currentPeriodEnd": "2024-01-07T10:30:00Z",
      "nextBillingDate": "2024-01-07T10:30:00Z"
    },
    "invoice": {
      "id": "inv_123",
      "amount": 1999,
      "status": "PAID",
      "invoiceUrl": "https://billing.watchflixx.com/invoices/inv_123.pdf"
    }
  }
}
```

### Get User Subscription
**GET** `/payment/subscription`

Get current user subscription.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub_123",
      "planType": "PREMIUM",
      "billingCycle": "MONTHLY",
      "status": "ACTIVE",
      "amount": 1999,
      "currency": "USD",
      "currentPeriodStart": "2023-12-07T10:30:00Z",
      "currentPeriodEnd": "2024-01-07T10:30:00Z",
      "nextBillingDate": "2024-01-07T10:30:00Z",
      "cancelAt": null,
      "features": {
        "maxQuality": "UHD",
        "maxDevices": 4,
        "partyWatch": true,
        "earlyAccess": true
      }
    }
  }
}
```

### Update Subscription
**PUT** `/payment/subscription`

Update subscription plan or billing cycle.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "planType": "STANDARD",
  "billingCycle": "ANNUAL",
  "prorationBehavior": "IMMEDIATE"
}
```

### Cancel Subscription
**POST** `/payment/subscription/cancel`

Cancel subscription.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "cancelAt": "period_end",
  "reason": "too_expensive",
  "feedback": "The service is great but too expensive for me right now."
}
```

### Pause Subscription
**POST** `/payment/subscription/pause`

Pause subscription temporarily.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "pauseDuration": 2,
  "pauseUnit": "months"
}
```

### Get Payment Methods
**GET** `/payment/methods`

Get user's saved payment methods.

**Headers:** `Authorization: Bearer <token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentMethods": [
      {
        "id": "pm_123",
        "type": "card",
        "card": {
          "brand": "visa",
          "last4": "4242",
          "expMonth": 12,
          "expYear": 2025
        },
        "billingDetails": {
          "name": "John Doe",
          "email": "john@example.com"
        },
        "isDefault": true,
        "createdAt": "2023-12-07T10:30:00Z"
      }
    ]
  }
}
```

### Add Payment Method
**POST** `/payment/methods`

Add new payment method.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "paymentMethodId": "pm_stripe_payment_method_id",
  "setAsDefault": true
}
```

### Get Billing History
**GET** `/payment/invoices`

Get billing history and invoices.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "id": "inv_123",
        "amount": 1999,
        "currency": "USD",
        "status": "PAID",
        "description": "Premium Monthly Subscription",
        "periodStart": "2023-12-07T10:30:00Z",
        "periodEnd": "2024-01-07T10:30:00Z",
        "paidAt": "2023-12-07T10:30:00Z",
        "invoiceUrl": "https://billing.watchflixx.com/invoices/inv_123.pdf"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalItems": 100
    }
  }
}
```

### Rent Content
**POST** `/payment/rentals`

Rent individual content.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "contentId": "content_123",
  "quality": "HD",
  "paymentMethodId": "pm_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rental": {
      "id": "rental_123",
      "contentId": "content_123",
      "quality": "HD",
      "amount": 399,
      "currency": "USD",
      "rentalStart": "2023-12-07T10:30:00Z",
      "rentalEnd": "2023-12-09T10:30:00Z",
      "status": "ACTIVE"
    }
  }
}
```

### Get User Rentals
**GET** `/payment/rentals`

Get user's content rentals.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `expired`, `all`)

---

## 👥 Social Features APIs

### Create Party Watch
**POST** `/social/party`

Create a new watch party.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "profileId": "profile_123",
  "contentId": "content_123",
  "episodeId": "episode_123",
  "maxMembers": 10,
  "isPublic": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "party": {
      "id": "party_123",
      "partyCode": "ABC123",
      "inviteUrl": "https://app.watchflixx.com/party/join/ABC123",
      "host": {
        "profileId": "profile_123",
        "name": "John Doe"
      },
      "content": {
        "id": "content_123",
        "title": "The Great Adventure",
        "posterUrl": "https://cdn.watchflixx.com/posters/adventure.jpg"
      },
      "episode": {
        "id": "episode_123",
        "title": "Episode 1",
        "seasonNumber": 1,
        "episodeNumber": 1
      },
      "status": "WAITING",
      "maxMembers": 10,
      "currentMembers": 1,
      "createdAt": "2023-12-07T10:30:00Z"
    }
  }
}
```

### Join Party Watch
**POST** `/social/party/{partyCode}/join`

Join an existing watch party.

**Parameters:**
- `partyCode` (path): Party code

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "profileId": "profile_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "party": {
      "id": "party_123",
      "partyCode": "ABC123",
      "status": "WAITING",
      "members": [
        {
          "profileId": "profile_123",
          "name": "John Doe",
          "avatar": "https://cdn.watchflixx.com/avatars/john.jpg",
          "role": "HOST",
          "joinedAt": "2023-12-07T10:30:00Z"
        }
      ],
      "content": {
        "id": "content_123",
        "title": "The Great Adventure"
      }
    }
  }
}
```

### Get Party Details
**GET** `/social/party/{partyId}`

Get party watch details.

**Parameters:**
- `partyId` (path): Party ID

**Headers:** `Authorization: Bearer <token>`

### Leave Party Watch
**POST** `/social/party/{partyId}/leave`

Leave a watch party.

**Parameters:**
- `partyId` (path): Party ID

**Headers:** `Authorization: Bearer <token>`

### Start Party Watch
**POST** `/social/party/{partyId}/start`

Start the watch party (host only).

**Parameters:**
- `partyId` (path): Party ID

**Headers:** `Authorization: Bearer <token>`

### Get Party Messages
**GET** `/social/party/{partyId}/messages`

Get party chat messages.

**Parameters:**
- `partyId` (path): Party ID

**Query Parameters:**
- `limit` (optional): Message limit (default: 50)
- `before` (optional): Get messages before timestamp

**Headers:** `Authorization: Bearer <token>`

---

## 📊 Analytics APIs

### Get User Analytics
**GET** `/analytics/user`

Get user viewing analytics.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `profileId` (required): Profile ID
- `timeframe` (optional): Timeframe (`week`, `month`, `year`)

**Response:**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "watchTime": {
        "totalMinutes": 1440,
        "thisWeek": 360,
        "averagePerDay": 51.4
      },
      "contentStats": {
        "moviesWatched": 15,
        "seriesWatched": 8,
        "episodesWatched": 64,
        "completionRate": 78.5
      },
      "favoriteGenres": [
        {
          "genre": "action",
          "percentage": 35.2,
          "minutesWatched": 506
        }
      ],
      "viewingHours": [
        {
          "hour": 20,
          "percentage": 25.3
        }
      ]
    }
  }
}
```

### Get Content Analytics
**GET** `/analytics/content/{contentId}`

Get content performance analytics.

**Parameters:**
- `contentId` (path): Content ID

**Headers:** `Authorization: Bearer <token>` (admin only)

**Response:**
```json
{
  "success": true,
  "data": {
    "analytics": {
      "totalViews": 15420,
      "uniqueViews": 12350,
      "completionRate": 82.4,
      "averageRating": 4.6,
      "totalRatings": 1250,
      "watchlistAdds": 2840,
      "sharesCount": 156,
      "viewsByRegion": [
        {
          "region": "US",
          "views": 8500,
          "percentage": 55.1
        }
      ],
      "viewsByDevice": [
        {
          "device": "WEB",
          "views": 7200,
          "percentage": 46.7
        }
      ]
    }
  }
}
```

---

## 🔔 Notification APIs

### Get Notifications
**GET** `/notifications`

Get user notifications.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `type` (optional): Notification type filter
- `isRead` (optional): Read status filter

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif_123",
        "type": "NEW_EPISODE",
        "title": "New Episode Available",
        "message": "Episode 5 of Space Odyssey Chronicles is now available!",
        "data": {
          "contentId": "content_123",
          "episodeId": "episode_456"
        },
        "isRead": false,
        "createdAt": "2023-12-07T10:30:00Z"
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalItems": 50
    }
  }
}
```

### Mark Notification as Read
**PUT** `/notifications/{notificationId}/read`

Mark notification as read.

**Parameters:**
- `notificationId` (path): Notification ID

**Headers:** `Authorization: Bearer <token>`

### Mark All Notifications as Read
**PUT** `/notifications/read-all`

Mark all notifications as read.

**Headers:** `Authorization: Bearer <token>`

### Update Notification Settings
**PUT** `/notifications/settings`

Update notification preferences.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "email": {
    "newEpisodes": true,
    "recommendations": false,
    "billingAlerts": true,
    "partyInvites": true
  },
  "push": {
    "newEpisodes": true,
    "recommendations": false,
    "partyInvites": true
  },
  "quietHours": {
    "enabled": true,
    "startTime": "22:00",
    "endTime": "08:00",
    "timezone": "America/New_York"
  }
}
```

---

## 🔌 Socket.IO Events

### Connection & Authentication

**Client connects to:** `wss://socket.watchflixx.com`

**Authentication:**
```javascript
const socket = io('wss://socket.watchflixx.com', {
  auth: {
    token: 'jwt_access_token',
    profileId: 'profile_123'
  }
});
```

### General Events

#### `connect`
Fired when client successfully connects.

```javascript
socket.on('connect', () => {
  console.log('Connected to WatchFlixx socket');
});
```

#### `disconnect`
Fired when client disconnects.

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

#### `error`
Fired when an error occurs.

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
});
```

---

### Party Watch Socket Events

#### Client → Server Events

##### `party:create`
Create a new watch party.

```javascript
socket.emit('party:create', {
  contentId: 'content_123',
  episodeId: 'episode_456', // optional for series
  maxMembers: 10,
  isPublic: false
});
```

**Response:**
```javascript
socket.on('party:created', (data) => {
  // data.party contains party details
  // data.partyCode contains the join code
});
```

##### `party:join`
Join an existing watch party.

```javascript
socket.emit('party:join', {
  partyCode: 'ABC123'
});
```

**Response:**
```javascript
socket.on('party:joined', (data) => {
  // data.party contains party details
  // data.members contains current members
});
```

##### `party:leave`
Leave the current watch party.

```javascript
socket.emit('party:leave');
```

##### `party:start`
Start the watch party (host only).

```javascript
socket.emit('party:start');
```

##### `party:play`
Play the video (host only).

```javascript
socket.emit('party:play', {
  timestamp: 1234.56 // current video timestamp in seconds
});
```

##### `party:pause`
Pause the video (host only).

```javascript
socket.emit('party:pause', {
  timestamp: 1234.56
});
```

##### `party:seek`
Seek to a specific time (host only).

```javascript
socket.emit('party:seek', {
  timestamp: 1800.0,
  wasPlaying: true
});
```

##### `party:sync_request`
Request sync with current playback state.

```javascript
socket.emit('party:sync_request');
```

##### `party:message`
Send a chat message.

```javascript
socket.emit('party:message', {
  message: 'This scene is amazing!',
  timestamp: 1234.56 // video timestamp when message was sent
});
```

##### `party:reaction`
Send an emoji reaction.

```javascript
socket.emit('party:reaction', {
  emoji: '😂',
  timestamp: 1234.56,
  position: { x: 0.5, y: 0.3 } // normalized screen position
});
```

##### `party:typing`
Indicate user is typing.

```javascript
socket.emit('party:typing', {
  isTyping: true
});
```

##### `party:heartbeat`
Send heartbeat to maintain connection.

```javascript
socket.emit('party:heartbeat', {
  timestamp: 1234.56,
  isPlaying: true,
  quality: 'HD'
});
```

#### Server → Client Events

##### `party:created`
Party successfully created.

```javascript
socket.on('party:created', (data) => {
  console.log('Party created:', data.party);
  console.log('Join code:', data.partyCode);
  console.log('Invite URL:', data.inviteUrl);
});
```

##### `party:joined`
Successfully joined a party.

```javascript
socket.on('party:joined', (data) => {
  console.log('Joined party:', data.party);
  console.log('Current members:', data.members);
});
```

##### `party:member_joined`
A new member joined the party.

```javascript
socket.on('party:member_joined', (data) => {
  console.log('Member joined:', data.member);
  console.log('Total members:', data.memberCount);
});
```

##### `party:member_left`
A member left the party.

```javascript
socket.on('party:member_left', (data) => {
  console.log('Member left:', data.member);
  console.log('Remaining members:', data.memberCount);
});
```

##### `party:started`
Party host started the watch session.

```javascript
socket.on('party:started', (data) => {
  console.log('Party started!');
  console.log('Starting timestamp:', data.timestamp);
});
```

##### `party:ended`
Watch party ended.

```javascript
socket.on('party:ended', (data) => {
  console.log('Party ended:', data.reason);
});
```

##### `party:host_changed`
Party host transferred to another member.

```javascript
socket.on('party:host_changed', (data) => {
  console.log('New host:', data.newHost);
});
```

##### `party:play`
Video playback started.

```javascript
socket.on('party:play', (data) => {
  // Sync video playback to this timestamp
  videoPlayer.currentTime = data.timestamp;
  videoPlayer.play();
});
```

##### `party:pause`
Video playback paused.

```javascript
socket.on('party:pause', (data) => {
  // Sync video pause to this timestamp
  videoPlayer.currentTime = data.timestamp;
  videoPlayer.pause();
});
```

##### `party:seek`
Video seeked to new position.

```javascript
socket.on('party:seek', (data) => {
  videoPlayer.currentTime = data.timestamp;
  if (data.wasPlaying) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
});
```

##### `party:sync`
Sync playback state with party.

```javascript
socket.on('party:sync', (data) => {
  videoPlayer.currentTime = data.timestamp;
  if (data.isPlaying) {
    videoPlayer.play();
  } else {
    videoPlayer.pause();
  }
  console.log('Synced with party state');
});
```

##### `party:message`
New chat message received.

```javascript
socket.on('party:message', (data) => {
  displayChatMessage({
    user: data.user,
    message: data.message,
    timestamp: data.timestamp,
    videoTimestamp: data.videoTimestamp,
    createdAt: data.createdAt
  });
});
```

##### `party:reaction`
Emoji reaction received.

```javascript
socket.on('party:reaction', (data) => {
  showReactionOverlay({
    user: data.user,
    emoji: data.emoji,
    position: data.position,
    timestamp: data.videoTimestamp
  });
});
```

##### `party:typing`
User typing indicator.

```javascript
socket.on('party:typing', (data) => {
  if (data.isTyping) {
    showTypingIndicator(data.user);
  } else {
    hideTypingIndicator(data.user);
  }
});
```

##### `party:error`
Party-related error occurred.

```javascript
socket.on('party:error', (error) => {
  console.error('Party error:', error.message);
  displayErrorMessage(error.message);
});
```

##### `party:connection_quality`
Connection quality update.

```javascript
socket.on('party:connection_quality', (data) => {
  console.log('Connection quality:', data.quality);
  console.log('Latency:', data.latency);
  updateConnectionIndicator(data.quality);
});
```

##### `party:member_update`
Member status update.

```javascript
socket.on('party:member_update', (data) => {
  updateMemberStatus(data.member);
});
```

### Real-time Notification Events

##### `notification:new`
New notification received.

```javascript
socket.on('notification:new', (notification) => {
  displayNotification(notification);
  updateNotificationBadge();
});
```

##### `notification:read`
Notification marked as read.

```javascript
socket.on('notification:read', (data) => {
  markNotificationAsRead(data.notificationId);
});
```

### Content Update Events

##### `content:new`
New content available.

```javascript
socket.on('content:new', (content) => {
  if (isContentRelevant(content)) {
    showNewContentNotification(content);
  }
});
```

##### `content:updated`
Content information updated.

```javascript
socket.on('content:updated', (content) => {
  updateContentInCache(content);
});
```

---

## ❌ Error Handling

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error
- `503` - Service Unavailable

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      {
        "field": "email",
        "message": "Email is required",
        "code": "REQUIRED_FIELD"
      }
    ],
    "requestId": "req_123456789",
    "documentation": "https://docs.watchflixx.com/errors/validation"
  },
  "timestamp": "2023-12-07T10:30:00Z"
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Input validation failed
- `AUTHENTICATION_REQUIRED` - User must be authenticated
- `AUTHORIZATION_FAILED` - User lacks required permissions
- `RESOURCE_NOT_FOUND` - Requested resource doesn't exist
- `SUBSCRIPTION_REQUIRED` - Active subscription required
- `CONTENT_NOT_AVAILABLE` - Content not available in user's region
- `PARTY_FULL` - Watch party has reached maximum capacity
- `PAYMENT_FAILED` - Payment processing failed
- `RATE_LIMIT_EXCEEDED` - Too many requests

---

## 🚦 Rate Limiting

### Rate Limits by Endpoint Type

- **Authentication**: 5 requests per minute per IP
- **Content Search**: 100 requests per minute per user
- **Streaming**: 10 requests per minute per session
- **Payment**: 10 requests per minute per user
- **Party Watch**: 50 requests per minute per party
- **General API**: 1000 requests per hour per user

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640781600
X-RateLimit-Window: 3600
```

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfter": 60
  },
  "timestamp": "2023-12-07T10:30:00Z"
}
```

---

## 📚 Additional Resources

- **Postman Collection**: [Download here](https://api.watchflixx.com/postman/collection.json)
- **OpenAPI Spec**: [Download here](https://api.watchflixx.com/openapi.json)
- **SDK Downloads**: [Available here](https://developers.watchflixx.com/sdks)
- **Webhook Documentation**: [See here](https://docs.watchflixx.com/webhooks)
- **Status Page**: [https://status.watchflixx.com](https://status.watchflixx.com)

For support, contact: [api-support@watchflixx.com](mailto:api-support@watchflixx.com)
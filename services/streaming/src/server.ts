import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.STREAMING_PORT || 3003;
const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Auth middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Token required' }
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid token' }
    });
  }
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'streaming-service', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Get streaming URLs
app.post('/v1/play/:contentId', authenticate, async (req: any, res) => {
  try {
    const { contentId } = req.params;
    const { profileId, quality = 'HD' } = req.body;

    // Check if content exists
    const content = await prisma.content.findUnique({
      where: { id: contentId },
      include: {
        videoFiles: {
          where: { quality }
        }
      }
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: { message: 'Content not found' }
      });
    }

    // Check subscription (simplified - in production, check actual subscription)
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' }
        }
      }
    });

    if (!user?.subscriptions.length) {
      return res.status(403).json({
        success: false,
        error: { message: 'Active subscription required' }
      });
    }

    // Create viewing session
    const session = await prisma.viewingSession.create({
      data: {
        userId: req.user.userId,
        contentId,
        profileId,
        quality,
        device: req.body.device?.type || 'web',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent') || ''
      }
    });

    // Return streaming URLs (in production, these would be real CDN URLs)
    res.json({
      success: true,
      data: {
        streamingUrls: {
          hls: `https://cdn.watchflixx.com/content/${contentId}/playlist.m3u8`,
          dash: `https://cdn.watchflixx.com/content/${contentId}/manifest.mpd`
        },
        sessionToken: session.id,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
      }
    });
  } catch (error) {
    console.error('Streaming error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to get streaming URLs' }
    });
  }
});

// Update watch progress
app.post('/v1/progress', authenticate, async (req: any, res) => {
  try {
    const { contentId, profileId, position, duration } = req.body;

    const progress = await prisma.watchHistory.upsert({
      where: {
        userId_contentId_profileId: {
          userId: req.user.userId,
          contentId,
          profileId
        }
      },
      update: {
        position,
        duration,
        updatedAt: new Date()
      },
      create: {
        userId: req.user.userId,
        contentId,
        profileId,
        position,
        duration
      }
    });

    res.json({
      success: true,
      data: { progress }
    });
  } catch (error) {
    console.error('Progress update error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update progress' }
    });
  }
});

// Get watch history
app.get('/v1/history', authenticate, async (req: any, res) => {
  try {
    const { profileId } = req.query;

    const history = await prisma.watchHistory.findMany({
      where: {
        userId: req.user.userId,
        ...(profileId && { profileId })
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            type: true,
            duration: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 50
    });

    res.json({
      success: true,
      data: { history }
    });
  } catch (error) {
    console.error('History fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch history' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`📺 Streaming Service running on port ${PORT}`);
});

export default app;
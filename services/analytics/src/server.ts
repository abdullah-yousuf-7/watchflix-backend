import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.ANALYTICS_PORT || 3006;
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
    service: 'analytics-service', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Track content view
app.post('/v1/track/view', authenticate, async (req: any, res) => {
  try {
    const { contentId, profileId, duration, completion } = req.body;

    // Update or create analytics entry
    const analytics = await prisma.contentAnalytics.upsert({
      where: {
        contentId_date: {
          contentId,
          date: new Date().toISOString().split('T')[0]
        }
      },
      update: {
        views: { increment: 1 },
        totalWatchTime: { increment: duration },
        averageCompletion: completion,
        updatedAt: new Date()
      },
      create: {
        contentId,
        date: new Date().toISOString().split('T')[0],
        views: 1,
        totalWatchTime: duration,
        uniqueUsers: 1,
        averageCompletion: completion
      }
    });

    res.json({
      success: true,
      data: { tracked: true }
    });
  } catch (error) {
    console.error('View tracking error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to track view' }
    });
  }
});

// Get content analytics
app.get('/v1/content/:contentId/analytics', authenticate, async (req: any, res) => {
  try {
    const { contentId } = req.params;
    const { days = 30 } = req.query;

    const analytics = await prisma.contentAnalytics.findMany({
      where: {
        contentId,
        date: {
          gte: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      },
      orderBy: { date: 'desc' }
    });

    // Calculate totals
    const totals = analytics.reduce((acc, curr) => ({
      totalViews: acc.totalViews + curr.views,
      totalWatchTime: acc.totalWatchTime + curr.totalWatchTime,
      totalUniqueUsers: acc.totalUniqueUsers + curr.uniqueUsers,
      avgCompletion: (acc.avgCompletion + curr.averageCompletion) / 2
    }), {
      totalViews: 0,
      totalWatchTime: 0,
      totalUniqueUsers: 0,
      avgCompletion: 0
    });

    res.json({
      success: true,
      data: {
        analytics,
        summary: totals
      }
    });
  } catch (error) {
    console.error('Analytics fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch analytics' }
    });
  }
});

// Get top content
app.get('/v1/top-content', authenticate, async (req: any, res) => {
  try {
    const { period = 7, limit = 10 } = req.query;

    const topContent = await prisma.contentAnalytics.groupBy({
      by: ['contentId'],
      where: {
        date: {
          gte: new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      },
      _sum: {
        views: true,
        totalWatchTime: true
      },
      _avg: {
        averageCompletion: true
      },
      orderBy: {
        _sum: {
          views: 'desc'
        }
      },
      take: Number(limit)
    });

    // Get content details
    const contentIds = topContent.map(item => item.contentId);
    const content = await prisma.content.findMany({
      where: {
        id: { in: contentIds }
      },
      select: {
        id: true,
        title: true,
        type: true,
        posterUrl: true
      }
    });

    // Combine data
    const result = topContent.map(item => ({
      content: content.find(c => c.id === item.contentId),
      analytics: {
        views: item._sum.views,
        totalWatchTime: item._sum.totalWatchTime,
        averageCompletion: item._avg.averageCompletion
      }
    }));

    res.json({
      success: true,
      data: { topContent: result }
    });
  } catch (error) {
    console.error('Top content fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch top content' }
    });
  }
});

// Get user analytics
app.get('/v1/user/analytics', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    // Get watch history stats
    const watchStats = await prisma.watchHistory.aggregate({
      where: { userId },
      _count: { id: true },
      _sum: { position: true }
    });

    // Get favorite genres (from watch history)
    const watchHistory = await prisma.watchHistory.findMany({
      where: { userId },
      include: {
        content: {
          select: { genre: true }
        }
      }
    });

    const genreCounts: Record<string, number> = {};
    watchHistory.forEach(item => {
      item.content.genre.forEach(genre => {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      });
    });

    const favoriteGenres = Object.entries(genreCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([genre, count]) => ({ genre, count }));

    res.json({
      success: true,
      data: {
        totalWatched: watchStats._count.id,
        totalWatchTime: watchStats._sum.position || 0,
        favoriteGenres
      }
    });
  } catch (error) {
    console.error('User analytics fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch user analytics' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`📊 Analytics Service running on port ${PORT}`);
});

export default app;
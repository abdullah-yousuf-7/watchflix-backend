import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';

const app = express();
const PORT = process.env.CONTENT_PORT || 3002;
const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'content-service', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Get content catalog
app.get('/v1/catalog', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, genre } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = { isAvailable: true };
    if (type) where.type = type;
    if (genre) where.genre = { hasSome: [genre as string] };

    const [content, total] = await Promise.all([
      prisma.content.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { releaseDate: 'desc' },
        include: {
          cast: {
            take: 5,
            select: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      }),
      prisma.content.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        content,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(total / Number(limit)),
          totalItems: total,
          hasNext: skip + content.length < total,
          hasPrev: Number(page) > 1
        }
      }
    });
  } catch (error) {
    console.error('Catalog error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch catalog' }
    });
  }
});

// Get content by ID
app.get('/v1/content/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const content = await prisma.content.findUnique({
      where: { id },
      include: {
        cast: true,
        crew: true,
        seasons: {
          include: {
            episodes: {
              orderBy: { episodeNumber: 'asc' }
            }
          },
          orderBy: { seasonNumber: 'asc' }
        },
        videoFiles: true,
        subtitleFiles: true
      }
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: { message: 'Content not found' }
      });
    }

    res.json({
      success: true,
      data: { content }
    });
  } catch (error) {
    console.error('Content fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch content' }
    });
  }
});

// Search content
app.get('/v1/search', async (req, res) => {
  try {
    const { q, page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    if (!q) {
      return res.status(400).json({
        success: false,
        error: { message: 'Search query required' }
      });
    }

    const content = await prisma.content.findMany({
      where: {
        AND: [
          { isAvailable: true },
          {
            OR: [
              { title: { contains: q as string, mode: 'insensitive' } },
              { description: { contains: q as string, mode: 'insensitive' } },
              { genre: { hasSome: [q as string] } }
            ]
          }
        ]
      },
      skip,
      take: Number(limit),
      orderBy: { releaseDate: 'desc' }
    });

    res.json({
      success: true,
      data: { content }
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Search failed' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`🎬 Content Service running on port ${PORT}`);
});

export default app;
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.SOCIAL_PORT || 3005;
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
    service: 'social-service', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Create watch party
app.post('/v1/party', authenticate, async (req: any, res) => {
  try {
    const { contentId, profileId } = req.body;

    // Check if content exists
    const content = await prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: { message: 'Content not found' }
      });
    }

    // Create party session
    const party = await prisma.partyWatchSession.create({
      data: {
        hostUserId: req.user.userId,
        contentId,
        profileId,
        status: 'ACTIVE',
        maxParticipants: 8,
        isPrivate: false,
        syncedPosition: 0
      }
    });

    // Add host as first member
    await prisma.partyWatchMember.create({
      data: {
        sessionId: party.id,
        userId: req.user.userId,
        profileId,
        role: 'HOST',
        status: 'ACTIVE'
      }
    });

    res.status(201).json({
      success: true,
      data: { party }
    });
  } catch (error) {
    console.error('Party creation error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create watch party' }
    });
  }
});

// Join watch party
app.post('/v1/party/:partyId/join', authenticate, async (req: any, res) => {
  try {
    const { partyId } = req.params;
    const { profileId } = req.body;

    // Check if party exists
    const party = await prisma.partyWatchSession.findUnique({
      where: { id: partyId },
      include: {
        members: true
      }
    });

    if (!party) {
      return res.status(404).json({
        success: false,
        error: { message: 'Watch party not found' }
      });
    }

    if (party.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: { message: 'Watch party is not active' }
      });
    }

    if (party.members.length >= party.maxParticipants) {
      return res.status(400).json({
        success: false,
        error: { message: 'Watch party is full' }
      });
    }

    // Check if user is already a member
    const existingMember = party.members.find(m => m.userId === req.user.userId);
    if (existingMember) {
      return res.status(409).json({
        success: false,
        error: { message: 'Already a member of this party' }
      });
    }

    // Add user as member
    const member = await prisma.partyWatchMember.create({
      data: {
        sessionId: party.id,
        userId: req.user.userId,
        profileId,
        role: 'MEMBER',
        status: 'ACTIVE'
      }
    });

    res.json({
      success: true,
      data: { member }
    });
  } catch (error) {
    console.error('Party join error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to join watch party' }
    });
  }
});

// Get active parties
app.get('/v1/party/active', authenticate, async (req: any, res) => {
  try {
    const parties = await prisma.partyWatchSession.findMany({
      where: {
        status: 'ACTIVE',
        isPrivate: false
      },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            posterUrl: true,
            type: true
          }
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    res.json({
      success: true,
      data: { parties }
    });
  } catch (error) {
    console.error('Active parties fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch active parties' }
    });
  }
});

// Update party sync position
app.post('/v1/party/:partyId/sync', authenticate, async (req: any, res) => {
  try {
    const { partyId } = req.params;
    const { position, isPlaying } = req.body;

    // Check if user is host
    const party = await prisma.partyWatchSession.findUnique({
      where: { id: partyId }
    });

    if (!party) {
      return res.status(404).json({
        success: false,
        error: { message: 'Watch party not found' }
      });
    }

    if (party.hostUserId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Only host can sync playback' }
      });
    }

    // Update sync position
    const updatedParty = await prisma.partyWatchSession.update({
      where: { id: partyId },
      data: {
        syncedPosition: position,
        isPlaying,
        lastSyncAt: new Date()
      }
    });

    res.json({
      success: true,
      data: { party: updatedParty }
    });
  } catch (error) {
    console.error('Party sync error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to sync party' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`👥 Social Service running on port ${PORT}`);
});

export default app;
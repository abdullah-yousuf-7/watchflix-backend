import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.NOTIFICATION_PORT || 3007;
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
    service: 'notification-service', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Get user notifications
app.get('/v1/notifications', authenticate, async (req: any, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      skip,
      take: Number(limit),
      orderBy: { createdAt: 'desc' }
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user.userId,
        isRead: false
      }
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount
      }
    });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch notifications' }
    });
  }
});

// Mark notification as read
app.patch('/v1/notifications/:id/read', authenticate, async (req: any, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: { message: 'Notification not found' }
      });
    }

    if (notification.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized' }
      });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: { 
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      data: { notification: updatedNotification }
    });
  } catch (error) {
    console.error('Notification update error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update notification' }
    });
  }
});

// Mark all notifications as read
app.patch('/v1/notifications/read-all', authenticate, async (req: any, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.userId,
        isRead: false
      },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    res.json({
      success: true,
      data: { message: 'All notifications marked as read' }
    });
  } catch (error) {
    console.error('Bulk notification update error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to update notifications' }
    });
  }
});

// Send notification (internal service endpoint)
app.post('/v1/send', async (req, res) => {
  try {
    const { userId, type, title, message, metadata } = req.body;

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        metadata: metadata || {},
        isRead: false
      }
    });

    // In production, this would trigger email/push notifications
    console.log(`Notification sent to user ${userId}: ${title}`);

    res.status(201).json({
      success: true,
      data: { notification }
    });
  } catch (error) {
    console.error('Notification send error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to send notification' }
    });
  }
});

// Create support ticket
app.post('/v1/support/tickets', authenticate, async (req: any, res) => {
  try {
    const { subject, message, category } = req.body;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: req.user.userId,
        subject,
        message,
        category,
        status: 'OPEN'
      }
    });

    // Send confirmation notification
    await prisma.notification.create({
      data: {
        userId: req.user.userId,
        type: 'SUPPORT',
        title: 'Support Ticket Created',
        message: `Your support ticket #${ticket.id} has been created. We'll get back to you soon.`,
        metadata: { ticketId: ticket.id }
      }
    });

    res.status(201).json({
      success: true,
      data: { ticket }
    });
  } catch (error) {
    console.error('Support ticket creation error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create support ticket' }
    });
  }
});

// Get user support tickets
app.get('/v1/support/tickets', authenticate, async (req: any, res) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      where: { userId: req.user.userId },
      include: {
        responses: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { tickets }
    });
  } catch (error) {
    console.error('Support tickets fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch support tickets' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`📬 Notification Service running on port ${PORT}`);
});

export default app;
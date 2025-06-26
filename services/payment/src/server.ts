import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PAYMENT_PORT || 3004;
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
    service: 'payment-service', 
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Get subscription plans
app.get('/v1/plans', (req, res) => {
  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 9.99,
      currency: 'USD',
      interval: 'month',
      features: ['HD Quality', '1 Device', 'Standard Library']
    },
    {
      id: 'standard',
      name: 'Standard',
      price: 14.99,
      currency: 'USD',
      interval: 'month',
      features: ['Full HD Quality', '2 Devices', 'Full Library', 'Download']
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 19.99,
      currency: 'USD',
      interval: 'month',
      features: ['4K Quality', '4 Devices', 'Full Library', 'Download', 'Early Access']
    }
  ];

  res.json({
    success: true,
    data: { plans }
  });
});

// Create subscription
app.post('/v1/subscriptions', authenticate, async (req: any, res) => {
  try {
    const { planType, billingCycle } = req.body;

    // Validate plan
    const validPlans = ['BASIC', 'STANDARD', 'PREMIUM'];
    if (!validPlans.includes(planType)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid plan type' }
      });
    }

    // Check existing subscription
    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.userId,
        status: 'ACTIVE'
      }
    });

    if (existingSubscription) {
      return res.status(409).json({
        success: false,
        error: { message: 'User already has active subscription' }
      });
    }

    // Calculate amount based on plan
    const amounts = {
      BASIC: billingCycle === 'ANNUAL' ? 99.99 : 9.99,
      STANDARD: billingCycle === 'ANNUAL' ? 149.99 : 14.99,
      PREMIUM: billingCycle === 'ANNUAL' ? 199.99 : 19.99
    };

    // Create subscription (simplified - in production, integrate with Stripe)
    const subscription = await prisma.subscription.create({
      data: {
        userId: req.user.userId,
        planType,
        billingCycle,
        status: 'ACTIVE',
        amount: amounts[planType as keyof typeof amounts],
        currency: 'USD',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + (billingCycle === 'ANNUAL' ? 365 : 30) * 24 * 60 * 60 * 1000)
      }
    });

    res.status(201).json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to create subscription' }
    });
  }
});

// Get user subscription
app.get('/v1/subscriptions/current', authenticate, async (req: any, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.userId,
        status: 'ACTIVE'
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: { message: 'No active subscription found' }
      });
    }

    res.json({
      success: true,
      data: { subscription }
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to fetch subscription' }
    });
  }
});

// Cancel subscription
app.delete('/v1/subscriptions/current', authenticate, async (req: any, res) => {
  try {
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: req.user.userId,
        status: 'ACTIVE'
      }
    });

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: { message: 'No active subscription found' }
      });
    }

    // Update subscription status
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: { 
        status: 'CANCELED',
        canceledAt: new Date()
      }
    });

    res.json({
      success: true,
      data: { subscription: updatedSubscription }
    });
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Failed to cancel subscription' }
    });
  }
});

app.listen(PORT, () => {
  console.log(`💳 Payment Service running on port ${PORT}`);
});

export default app;
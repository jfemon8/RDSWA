import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { env } from './config/env';
import { initSentry } from './config/sentry';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { apiLimiter } from './middlewares/rateLimiter.middleware';
import { errorHandler } from './middlewares/error.middleware';
import routes from './routes';
import { startAlumniTagger } from './jobs/alumniTagger';
import { startVoteCloser } from './jobs/voteCloser';
import { startReminderSender } from './jobs/reminderSender';
import { startPaymentReminder } from './jobs/paymentReminder';
import { startNoticePublisher } from './jobs/noticePublisher';
import { startEmailDigest } from './jobs/emailDigest';
import { initSocket } from './socket';
import { initWebPush } from './config/webpush';
import { initializeGroups } from './jobs/groupInitializer';

// Initialize Sentry before anything else (skip in test mode)
if (env.NODE_ENV !== 'test') {
  initSentry();
}

const app = express();
const httpServer = createServer(app);

// Security & parsing middleware
app.use(helmet());
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));
  app.use('/api', apiLimiter);
}

// API routes
app.use('/api', routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Start server
async function start() {
  await connectDB();
  await connectRedis();

  // Initialize Socket.IO & Web Push
  initSocket(httpServer);
  initWebPush();

  // Initialize central + department groups
  initializeGroups();

  // Start scheduled jobs
  startAlumniTagger();
  startVoteCloser();
  startReminderSender();
  startPaymentReminder();
  startNoticePublisher();
  startEmailDigest();

  httpServer.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    // Force-kill after 10 seconds if graceful shutdown stalls
    const forceTimeout = setTimeout(() => {
      console.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000);
    forceTimeout.unref();

    httpServer.close(async () => {
      console.log('HTTP server closed');
      try {
        await mongoose.disconnect();
        console.log('MongoDB disconnected');
      } catch (err) {
        console.error('Error disconnecting MongoDB:', err);
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Only start when not in test mode (tests manage their own DB connection)
if (process.env.NODE_ENV !== 'test') {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;

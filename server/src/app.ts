import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { connectDB } from './config/db';
import { connectRedis } from './config/redis';
import { apiLimiter } from './middlewares/rateLimiter.middleware';
import { errorHandler } from './middlewares/error.middleware';
import routes from './routes';
import { startAlumniTagger } from './jobs/alumniTagger';
import { startVoteCloser } from './jobs/voteCloser';
import { startReminderSender } from './jobs/reminderSender';
import { startPaymentReminder } from './jobs/paymentReminder';
import { initSocket } from './socket';

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
app.use(morgan(env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// Rate limiting
app.use('/api', apiLimiter);

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

  // Initialize Socket.IO
  initSocket(httpServer);

  // Start scheduled jobs
  startAlumniTagger();
  startVoteCloser();
  startReminderSender();
  startPaymentReminder();

  httpServer.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

export default app;

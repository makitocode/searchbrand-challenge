/**
 * Express API Server
 * Provides REST API endpoints for brand analysis
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import apiRouter from './routes/index.js';

export function createApp(): Application {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Request logging
  app.use(requestLogger);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.nodeEnv,
    });
  });

  // API routes
  app.use('/api/v1', apiRouter);

  // Error handling
  app.use(errorHandler);

  return app;
}

export function startServer(): void {
  const app = createApp();
  const port = config.port || 3000;

  app.listen(port, () => {
    logger.info(`🚀 Server running on port ${port}`);
    logger.info(`📝 Environment: ${config.nodeEnv}`);
    logger.info(`🔗 API: http://localhost:${port}/api/v1`);
    logger.info(`💚 Health: http://localhost:${port}/health`);
  });
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

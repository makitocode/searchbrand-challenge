/**
 * Express API Server
 * Provides REST API endpoints for brand analysis
 */

import express, { Application } from 'express';
// import cors from 'cors';
// import helmet from 'helmet';
import { config } from '../utils/config.js';
import { logger } from '../utils/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import apiRouter from './routes/index.js';

export function createApp(): Application {
  const app = express();

  // Trust Railway proxy (must be before other middleware)
  app.set('trust proxy', 1);

  // Disable strict routing
  app.disable('strict routing');

  // CORS and Helmet disabled - not needed for API-only service
  // If you add a frontend later, uncomment these:
  // app.use(helmet());
  // app.use(cors());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Debug middleware (logs actual method received)
  app.use((req, _res, next) => {
    logger.debug(`[${req.method}] ${req.path} - Headers: ${JSON.stringify(req.headers)}`);
    next();
  });

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

  // Debug route to list all registered routes
  if (config.nodeEnv !== 'production') {
    app.get('/debug/routes', (_req, res) => {
      const routes: any[] = [];
      app._router.stack.forEach((middleware: any) => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods),
          });
        } else if (middleware.name === 'router') {
          middleware.handle.stack.forEach((handler: any) => {
            if (handler.route) {
              routes.push({
                path: handler.route.path,
                methods: Object.keys(handler.route.methods),
              });
            }
          });
        }
      });
      res.json({ routes });
    });
  }

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

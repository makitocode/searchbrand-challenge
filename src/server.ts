/**
 * SearchBrand API Server Entry Point
 * Express REST API for brand competitor analysis
 */

import express from 'express';
import { logger } from './utils/logger';
import { config } from './utils/config';

const app = express();

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'SearchBrand API - Competitor Intelligence Tool',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api (coming soon in Phase 9)',
    },
  });
});

// Start server
const server = app.listen(config.port, () => {
  logger.info(`🚀 SearchBrand API server running on port ${config.port}`);
  logger.info(`📊 Environment: ${config.nodeEnv}`);
  logger.info(`🔗 Health check: http://localhost:${config.port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export default app;

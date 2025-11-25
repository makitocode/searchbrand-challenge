/**
 * Analysis Routes
 */

import { Router } from 'express';
import { analysisController } from '../controllers/analysis.controller.js';
import { authenticate } from '../middleware/auth.js';
import { analysisLimiter } from '../middleware/rate-limiter.js';

const router = Router();

// POST /api/v1/analysis - Create new analysis (protected, rate limited)
router.post(
  '/',
  authenticate,
  analysisLimiter,
  analysisController.create.bind(analysisController)
);

// GET /api/v1/analysis/history - Get user's analysis history (protected)
router.get(
  '/history',
  authenticate,
  analysisController.getHistory.bind(analysisController)
);

// POST /api/v1/analysis/quick - Quick optimized analysis (public for demo)
router.post(
  '/quick',
  analysisController.quickAnalysis.bind(analysisController)
);

// GET /api/v1/analysis/:id - Get analysis by ID (protected)
router.get(
  '/:id',
  authenticate,
  analysisController.getById.bind(analysisController)
);

export default router;

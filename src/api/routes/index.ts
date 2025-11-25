/**
 * API Routes Index
 * Combines all route modules
 */

import { Router } from 'express';
import { apiLimiter } from '../middleware/rate-limiter.js';
import authRoutes from './auth.routes.js';
import analysisRoutes from './analysis.routes.js';

const router = Router();

// Apply general rate limiter to all routes
router.use(apiLimiter);

// Mount route modules
router.use('/auth', authRoutes);
router.use('/analysis', analysisRoutes);

export default router;

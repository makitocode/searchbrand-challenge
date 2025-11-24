/**
 * Auth Routes
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authLimiter } from '../middleware/rate-limiter.js';

const router = Router();

// Apply rate limiter to all auth routes
router.use(authLimiter);

// POST /api/v1/auth/login
router.post('/login', authController.login.bind(authController));

export default router;

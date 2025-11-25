/**
 * Auth Routes
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
// import { authLimiter } from '../middleware/rate-limiter.js';

const router = Router();

// TEMPORARILY DISABLED: Rate limiter causing issues with Postman
// The rate limiter was causing 301 redirects that convert POST to GET
// router.use(authLimiter);

// POST /api/v1/auth/login
router.post('/login', authController.login.bind(authController));

export default router;

/**
 * Auth Controller
 * Handles authentication endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { authService } from '../../services/auth/auth.service.js';
import { AppError } from '../middleware/error-handler.js';

export class AuthController {
  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        throw new AppError('Email and password are required', 400);
      }

      const result = await authService.login(email, password);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();

/**
 * Authentication Service
 * Handles user registration, login, and JWT token generation
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../../utils/config.js';
import { logger } from '../../utils/logger.js';
import { getPgPool, getSupabaseClient, getDatabaseMode, isDatabaseAvailable } from '../database/client.js';
import { AppError } from '../../api/middleware/error-handler.js';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
  };
  token: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  async register(email: string, password: string): Promise<AuthResponse> {
    if (!(await isDatabaseAvailable())) {
      throw new AppError('Database not available', 503);
    }

    // Validate input
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters', 400);
    }

    // Check if user already exists
    const existing = await this.findByEmail(email);
    if (existing) {
      throw new AppError('User already exists', 409);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) throw new AppError('Database not available', 503);

        const result = await pool.query(
          `INSERT INTO users (email, password_hash)
           VALUES ($1, $2)
           RETURNING id, email, created_at`,
          [email, password_hash]
        );

        const user = result.rows[0];
        const token = this.generateToken(user.id, user.email);

        logger.info(`User registered: ${email}`);

        return {
          user: { id: user.id, email: user.email },
          token,
        };
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) throw new AppError('Database not available', 503);

        const { data, error } = await supabase
          .from('users')
          .insert({ email, password_hash })
          .select('id, email, created_at')
          .single();

        if (error) {
          logger.error('Supabase insert error:', error);
          throw new AppError('Failed to create user', 500);
        }

        const token = this.generateToken(data.id, data.email);

        logger.info(`User registered: ${email}`);

        return {
          user: { id: data.id, email: data.email },
          token,
        };
      }

      throw new AppError('Database not configured', 503);
    } catch (error) {
      if (error instanceof AppError) throw error;
      logger.error('Registration error:', error);
      throw new AppError('Failed to register user', 500);
    }
  }

  /**
   * Login user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    if (!(await isDatabaseAvailable())) {
      throw new AppError('Database not available', 503);
    }

    // Validate input
    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    // Find user
    const user = await this.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Generate token
    const token = this.generateToken(user.id, user.email);

    logger.info(`User logged in: ${email}`);

    return {
      user: { id: user.id, email: user.email },
      token,
    };
  }

  /**
   * Find user by email
   */
  private async findByEmail(email: string): Promise<User | null> {
    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return null;

        const result = await pool.query(
          `SELECT id, email, password_hash, created_at
           FROM users
           WHERE email = $1`,
          [email]
        );

        return result.rows[0] || null;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data, error } = await supabase
          .from('users')
          .select('id, email, password_hash, created_at')
          .eq('email', email)
          .single();

        if (error) return null;
        return data;
      }

      return null;
    } catch (error) {
      logger.error('Find user error:', error);
      return null;
    }
  }

  /**
   * Generate JWT token
   */
  private generateToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
      config.jwtSecret,
      { expiresIn: '30m' }
    );
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return null;

        const result = await pool.query(
          `SELECT id, email, password_hash, created_at
           FROM users
           WHERE id = $1`,
          [userId]
        );

        return result.rows[0] || null;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data, error } = await supabase
          .from('users')
          .select('id, email, password_hash, created_at')
          .eq('id', userId)
          .single();

        if (error) return null;
        return data;
      }

      return null;
    } catch (error) {
      logger.error('Get user by ID error:', error);
      return null;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();

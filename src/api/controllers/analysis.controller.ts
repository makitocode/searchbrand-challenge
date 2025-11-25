/**
 * Analysis Controller
 * Handles brand analysis endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { brandAnalysisRepository } from '../../services/database/repositories/brand-analysis.repository.js';
import { brandAnalysisService } from '../../services/analysis/brand-analysis.service.js';
import { optimizedBrandAnalysisService } from '../../services/analysis/optimized-brand-analysis.service.js';
import { simpleBrandAnalysisService } from '../../services/analysis/simple-brand-analysis.service.js';
import { AppError } from '../middleware/error-handler.js';

export class AnalysisController {
  /**
   * Create a new brand analysis
   * POST /api/v1/analysis
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { brand, category } = req.body;

      if (!brand) {
        throw new AppError('Brand is required', 400);
      }

      const userId = req.user?.userId;

      // Perform analysis using the shared service
      const result = await brandAnalysisService.analyze({
        brand,
        category,
        userId,
      });

      // Return appropriate status code based on result
      if (result.status === 'ambiguous') {
        res.status(200).json({
          success: true,
          data: result,
        });
      } else {
        res.status(200).json({
          success: true,
          data: result,
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get analysis by ID
   * GET /api/v1/analysis/:id
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const analysis = await brandAnalysisRepository.getById(id);

      if (!analysis) {
        throw new AppError('Analysis not found', 404);
      }

      // Check if user owns this analysis (if authenticated)
      if (req.user && analysis.user_id && analysis.user_id !== req.user.userId) {
        throw new AppError('Forbidden', 403);
      }

      res.json({
        success: true,
        data: {
          id: analysis.id,
          brand_name: analysis.brand_name,
          brand_url: analysis.brand_url,
          industry: analysis.industry,
          selected_category: analysis.selected_category,
          analysis_type: analysis.analysis_type,
          status: analysis.status,
          classification_result: analysis.classification_result,
          created_at: analysis.created_at,
          completed_at: analysis.completed_at,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's analysis history
   * GET /api/v1/analysis/history
   */
  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      const limit = Number.parseInt(req.query.limit as string) || 10;
      const offset = Number.parseInt(req.query.offset as string) || 0;

      const analyses = await brandAnalysisRepository.getByUserId(
        req.user.userId,
        limit,
        offset
      );

      res.json({
        success: true,
        data: {
          analyses: analyses.map(a => ({
            id: a.id,
            brand_name: a.brand_name,
            brand_url: a.brand_url,
            industry: a.industry,
            analysis_type: a.analysis_type,
            status: a.status,
            created_at: a.created_at,
            completed_at: a.completed_at,
          })),
          limit,
          offset,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Quick optimized analysis (for demo/testing)
   * POST /api/v1/analysis/quick
   */
  async quickAnalysis(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { brand } = req.body;

      if (!brand) {
        throw new AppError('Brand is required', 400);
      }

      // Use simple service (Claude-only) for fastest and most reliable results
      const result = await simpleBrandAnalysisService.analyze({
        brand,
        userId: req.user?.userId,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const analysisController = new AnalysisController();

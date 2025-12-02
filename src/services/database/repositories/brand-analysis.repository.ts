/**
 * Brand Analysis Repository
 * Manages user analysis history and results persistence
 */

import { getPgPool, getSupabaseClient, getDatabaseMode, isDatabaseAvailable } from '../client.js';
import { logger } from '../../../utils/logger.js';
import {
  BrandAnalysis,
  InputType,
  AnalysisType,
  AnalysisStatus,
  InputAnalysis,
  EnrichedBrandData
} from '../../../types/index.js';

export class BrandAnalysisRepository {
  /**
   * Create a new brand analysis record
   */
  async create(data: {
    user_id: string | null;
    input_brand: string;
    input_type: InputType;
    brand_name: string;
    brand_url?: string;
    industry: string;
    selected_category?: string;
    analysis_type: AnalysisType;
    input_analysis?: InputAnalysis;
  }): Promise<string | null> {
    if (!(await isDatabaseAvailable())) {
      logger.debug('Database not available, skipping analysis creation');
      return null;
    }

    const mode = getDatabaseMode();
    // Normalize brand name to avoid case-sensitivity duplicates
    const normalizedBrandName = data.brand_name.trim();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return null;

        const result = await pool.query(
          `INSERT INTO brand_analyses (user_id, input_brand, input_type, brand_name, brand_url, industry, selected_category, analysis_type, input_analysis, status, started_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
           RETURNING id`,
          [
            data.user_id,
            data.input_brand,
            data.input_type,
            normalizedBrandName,
            data.brand_url || null,
            data.industry,
            data.selected_category || null,
            data.analysis_type,
            data.input_analysis ? JSON.stringify(data.input_analysis) : null,
            'processing' as AnalysisStatus
          ]
        );

        const id = result.rows[0].id;
        logger.info(`Brand analysis created: ${id}`);
        return id;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data: result, error } = await supabase
          .from('brand_analyses')
          .insert({
            ...data,
            brand_name: normalizedBrandName,
            status: 'processing' as AnalysisStatus,
            started_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (error) {
          logger.error('Failed to create brand analysis:', error);
          return null;
        }

        logger.info(`Brand analysis created: ${result.id}`);
        return result.id;
      }

      return null;
    } catch (error) {
      logger.error('Failed to create brand analysis:', error);
      return null;
    }
  }

  /**
   * Update analysis status
   */
  async updateStatus(
    id: string,
    status: AnalysisStatus,
    errorMessage?: string
  ): Promise<void> {
    if (!(await isDatabaseAvailable())) {
      return;
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return;

        const errorMsg = errorMessage || null;

        if (status === 'completed') {
          await pool.query(
            `UPDATE brand_analyses
             SET status = $1,
                 completed_at = NOW(),
                 error_message = $2
             WHERE id = $3`,
            [status, errorMsg, id]
          );
        } else {
          await pool.query(
            `UPDATE brand_analyses
             SET status = $1,
                 error_message = $2
             WHERE id = $3`,
            [status, errorMsg, id]
          );
        }

        return;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const updateData: any = { status };

        if (status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        }

        if (errorMessage) {
          updateData.error_message = errorMessage;
        }

        const { error } = await supabase
          .from('brand_analyses')
          .update(updateData)
          .eq('id', id);

        if (error) {
          logger.warn('Failed to update analysis status:', error);
        }
      }
    } catch (error) {
      logger.warn('Failed to update analysis status:', error);
    }
  }

  /**
   * Update enriched data
   */
  async updateEnrichedData(
    id: string,
    enrichedData: EnrichedBrandData
  ): Promise<void> {
    if (!(await isDatabaseAvailable())) {
      return;
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return;

        await pool.query(
          `UPDATE brand_analyses
           SET classification_result = $1
           WHERE id = $2`,
          [JSON.stringify(enrichedData), id]
        );

        return;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const { error } = await supabase
          .from('brand_analyses')
          .update({ classification_result: enrichedData })
          .eq('id', id);

        if (error) {
          logger.warn('Failed to update enriched data:', error);
        }
      }
    } catch (error) {
      logger.warn('Failed to update enriched data:', error);
    }
  }

  /**
   * Get analysis by ID
   */
  async getById(id: string): Promise<BrandAnalysis | null> {
    if (!(await isDatabaseAvailable())) {
      return null;
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return null;

        const result = await pool.query(
          `SELECT * FROM brand_analyses
           WHERE id = $1`,
          [id]
        );

        if (result.rows.length === 0) {
          logger.warn('Failed to get analysis: Not found');
          return null;
        }

        return result.rows[0] as BrandAnalysis;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data, error } = await supabase
          .from('brand_analyses')
          .select('*')
          .eq('id', id)
          .single();

        if (error) {
          logger.warn('Failed to get analysis:', error);
          return null;
        }

        return data as BrandAnalysis;
      }

      return null;
    } catch (error) {
      logger.warn('Failed to get analysis:', error);
      return null;
    }
  }

  /**
   * Get recent analysis by normalized brand name or input_brand (to avoid duplicates)
   * Searches both brand_name (cleaned name from Claude) and input_brand (user input)
   */
  async getRecentByBrandName(brandName: string, maxAgeDays: number = 7): Promise<BrandAnalysis | null> {
    if (!(await isDatabaseAvailable())) {
      return null;
    }

    const mode = getDatabaseMode();
    const normalizedBrand = brandName.toLowerCase().trim();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return null;

        // Search by both brand_name AND input_brand to catch duplicates
        const result = await pool.query(
          `SELECT * FROM brand_analyses
           WHERE (LOWER(brand_name) = $1 OR LOWER(input_brand) = $1)
           AND status = 'completed'
           AND created_at > NOW() - INTERVAL '${maxAgeDays} days'
           ORDER BY created_at DESC
           LIMIT 1`,
          [normalizedBrand]
        );

        if (result.rows.length === 0) {
          return null;
        }

        return result.rows[0] as BrandAnalysis;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

        // Search by brand_name first
        let { data, error } = await supabase
          .from('brand_analyses')
          .select('*')
          .ilike('brand_name', normalizedBrand)
          .eq('status', 'completed')
          .gt('created_at', cutoffDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // If not found by brand_name, try input_brand
        if (error && error.code === 'PGRST116') {
          const result = await supabase
            .from('brand_analyses')
            .select('*')
            .ilike('input_brand', normalizedBrand)
            .eq('status', 'completed')
            .gt('created_at', cutoffDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          data = result.data;
          error = result.error;
        }

        if (error) {
          if (error.code === 'PGRST116') {
            return null;
          }
          logger.warn('Failed to get recent analysis:', error);
          return null;
        }

        return data as BrandAnalysis;
      }

      return null;
    } catch (error) {
      logger.warn('Failed to get recent analysis:', error);
      return null;
    }
  }

  /**
   * Get user's analysis history
   */
  async getByUserId(
    userId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<BrandAnalysis[]> {
    if (!(await isDatabaseAvailable())) {
      return [];
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return [];

        const result = await pool.query(
          `SELECT * FROM brand_analyses
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [userId, limit, offset]
        );

        return result.rows as BrandAnalysis[];
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return [];

        const { data, error } = await supabase
          .from('brand_analyses')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          logger.warn('Failed to get user analyses:', error);
          return [];
        }

        return (data || []) as BrandAnalysis[];
      }

      return [];
    } catch (error) {
      logger.warn('Failed to get user analyses:', error);
      return [];
    }
  }

  /**
   * Get recent analyses
   */
  async getRecent(limit: number = 10): Promise<BrandAnalysis[]> {
    if (!(await isDatabaseAvailable())) {
      return [];
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return [];

        const result = await pool.query(
          `SELECT * FROM brand_analyses
           ORDER BY created_at DESC
           LIMIT $1`,
          [limit]
        );

        return result.rows as BrandAnalysis[];
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return [];

        const { data, error } = await supabase
          .from('brand_analyses')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (error) {
          logger.warn('Failed to get recent analyses:', error);
          return [];
        }

        return (data || []) as BrandAnalysis[];
      }

      return [];
    } catch (error) {
      logger.warn('Failed to get recent analyses:', error);
      return [];
    }
  }

  /**
   * Delete analysis and its competitors
   */
  async delete(id: string): Promise<boolean> {
    if (!(await isDatabaseAvailable())) {
      return false;
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return false;

        const result = await pool.query(
          `DELETE FROM brand_analyses
           WHERE id = $1`,
          [id]
        );

        if ((result.rowCount || 0) === 0) {
          logger.warn('Failed to delete analysis: Not found');
          return false;
        }

        logger.info(`Analysis deleted: ${id}`);
        return true;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const { error } = await supabase
          .from('brand_analyses')
          .delete()
          .eq('id', id);

        if (error) {
          logger.warn('Failed to delete analysis:', error);
          return false;
        }

        logger.info(`Analysis deleted: ${id}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.warn('Failed to delete analysis:', error);
      return false;
    }
  }

  /**
   * Update brand_url for an existing analysis (used by async SerpAPI lookup)
   */
  async updateBrandUrl(id: string, brandUrl: string): Promise<boolean> {
    if (!(await isDatabaseAvailable())) {
      return false;
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return false;

        const result = await pool.query(
          `UPDATE brand_analyses
           SET brand_url = $1, updated_at = NOW()
           WHERE id = $2`,
          [brandUrl, id]
        );

        if ((result.rowCount || 0) === 0) {
          logger.warn(`Failed to update brand_url: Analysis ${id} not found`);
          return false;
        }

        return true;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const { error } = await supabase
          .from('brand_analyses')
          .update({ brand_url: brandUrl, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          logger.warn('Failed to update brand_url:', error);
          return false;
        }

        return true;
      }

      return false;
    } catch (error) {
      logger.warn('Failed to update brand_url:', error);
      return false;
    }
  }
}

// Export singleton instance
export const brandAnalysisRepository = new BrandAnalysisRepository();

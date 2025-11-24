/**
 * Competitor Repository
 * Manages competitor results for each analysis
 */

import { getPgPool, getSupabaseClient, getDatabaseMode, isDatabaseAvailable } from '../client.js';
import { logger } from '../../../utils/logger.js';
import { Competitor, SimilarityBreakdown } from '../../../types/index.js';

export class CompetitorRepository {
  /**
   * Save competitors for an analysis
   */
  async saveCompetitors(
    analysisId: string,
    competitors: Array<{
      competitor_name: string;
      competitor_url?: string;
      similarity_score: number;
      ranking: number;
      score_breakdown: SimilarityBreakdown;
      evidence: string[];
    }>
  ): Promise<boolean> {
    if (!(await isDatabaseAvailable())) {
      logger.debug('Database not available, skipping competitor save');
      return false;
    }

    if (competitors.length === 0) {
      logger.debug('No competitors to save');
      return true;
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return false;

        // Build bulk insert query
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        competitors.forEach((comp) => {
          placeholders.push(
            `($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`
          );
          values.push(
            analysisId,
            comp.competitor_name,
            comp.competitor_url || null,
            comp.similarity_score,
            comp.ranking,
            JSON.stringify(comp.score_breakdown),
            JSON.stringify(comp.evidence)
          );
        });

        await pool.query(
          `INSERT INTO competitors (analysis_id, competitor_name, competitor_url, similarity_score, ranking, score_breakdown, evidence)
           VALUES ${placeholders.join(', ')}`,
          values
        );

        logger.info(`Saved ${competitors.length} competitors for analysis ${analysisId}`);
        return true;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const records = competitors.map(comp => ({
          analysis_id: analysisId,
          ...comp
        }));

        const { error } = await supabase
          .from('competitors')
          .insert(records);

        if (error) {
          logger.error('Failed to save competitors:', error);
          return false;
        }

        logger.info(`Saved ${competitors.length} competitors for analysis ${analysisId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to save competitors:', error);
      return false;
    }
  }

  /**
   * Get competitors for an analysis
   */
  async getByAnalysisId(analysisId: string): Promise<Competitor[]> {
    if (!(await isDatabaseAvailable())) {
      return [];
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return [];

        const result = await pool.query(
          `SELECT * FROM competitors
           WHERE analysis_id = $1
           ORDER BY ranking ASC`,
          [analysisId]
        );

        return result.rows as Competitor[];
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return [];

        const { data, error } = await supabase
          .from('competitors')
          .select('*')
          .eq('analysis_id', analysisId)
          .order('ranking', { ascending: true });

        if (error) {
          logger.warn('Failed to get competitors:', error);
          return [];
        }

        return (data || []) as Competitor[];
      }

      return [];
    } catch (error) {
      logger.warn('Failed to get competitors:', error);
      return [];
    }
  }

  /**
   * Get top N competitors for an analysis
   */
  async getTopCompetitors(
    analysisId: string,
    limit: number = 5
  ): Promise<Competitor[]> {
    if (!(await isDatabaseAvailable())) {
      return [];
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return [];

        const result = await pool.query(
          `SELECT * FROM competitors
           WHERE analysis_id = $1
           ORDER BY ranking ASC
           LIMIT $2`,
          [analysisId, limit]
        );

        return result.rows as Competitor[];
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return [];

        const { data, error } = await supabase
          .from('competitors')
          .select('*')
          .eq('analysis_id', analysisId)
          .order('ranking', { ascending: true })
          .limit(limit);

        if (error) {
          logger.warn('Failed to get top competitors:', error);
          return [];
        }

        return (data || []) as Competitor[];
      }

      return [];
    } catch (error) {
      logger.warn('Failed to get top competitors:', error);
      return [];
    }
  }

  /**
   * Delete competitors for an analysis (cascades from brand_analyses)
   */
  async deleteByAnalysisId(analysisId: string): Promise<boolean> {
    if (!(await isDatabaseAvailable())) {
      return false;
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return false;

        await pool.query(
          `DELETE FROM competitors
           WHERE analysis_id = $1`,
          [analysisId]
        );

        logger.info(`Deleted competitors for analysis ${analysisId}`);
        return true;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return false;

        const { error } = await supabase
          .from('competitors')
          .delete()
          .eq('analysis_id', analysisId);

        if (error) {
          logger.warn('Failed to delete competitors:', error);
          return false;
        }

        logger.info(`Deleted competitors for analysis ${analysisId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.warn('Failed to delete competitors:', error);
      return false;
    }
  }

  /**
   * Get statistics about competitors
   */
  async getStats(analysisId: string): Promise<{
    total: number;
    averageScore: number;
    topScore: number;
  }> {
    if (!(await isDatabaseAvailable())) {
      return { total: 0, averageScore: 0, topScore: 0 };
    }

    try {
      const competitors = await this.getByAnalysisId(analysisId);

      if (competitors.length === 0) {
        return { total: 0, averageScore: 0, topScore: 0 };
      }

      const scores = competitors.map(c => c.similarity_score);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const topScore = Math.max(...scores);

      return {
        total: competitors.length,
        averageScore,
        topScore
      };
    } catch (error) {
      logger.warn('Failed to get competitor stats:', error);
      return { total: 0, averageScore: 0, topScore: 0 };
    }
  }
}

// Export singleton instance
export const competitorRepository = new CompetitorRepository();

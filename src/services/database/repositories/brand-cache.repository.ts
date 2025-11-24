/**
 * Brand Cache Repository
 * Manages caching of brand classification results
 */

import { getPgPool, getSupabaseClient, getDatabaseMode, isDatabaseAvailable } from '../client.js';
import { logger } from '../../../utils/logger.js';
import { BrandTypeAnalysis, BrandClassificationData } from '../../../types/index.js';

export interface BrandCacheEntry {
  id: string;
  brand_name: string;
  brand_url?: string;
  normalized_name: string;
  classification_data: {
    brandType: 'global' | 'niche';
    score: number;
    confidence: number;
    reasoning: string;
    breakdown: {
      wikipedia: number;
      llm_direct: number;
      google_search: number;
      google_trends: number;
      official_website: number;
    };
    sources: BrandClassificationData;
  };
  created_at: string;
  expires_at: string;
  hit_count: number;
  last_hit_at?: string;
}

export class BrandCacheRepository {
  /**
   * Normalize brand name for cache lookup
   */
  private normalizeBrandName(brandName: string): string {
    return brandName.toLowerCase().replace(/\s+/g, '');
  }

  /**
   * Get cached brand classification
   */
  async get(brandName: string): Promise<BrandCacheEntry | null> {
    // Check if DB is available
    if (!(await isDatabaseAvailable())) {
      logger.debug('Database not available, skipping cache lookup');
      return null;
    }

    const mode = getDatabaseMode();
    const normalized = this.normalizeBrandName(brandName);

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return null;

        const result = await pool.query(
          `SELECT * FROM brand_cache
           WHERE normalized_name = $1
           AND expires_at > NOW()
           LIMIT 1`,
          [normalized]
        );

        if (result.rows.length === 0) {
          logger.debug(`Brand cache miss: ${brandName}`);
          return null;
        }

        const data = result.rows[0];
        await this.incrementHitCount(data.id);
        logger.info(`Brand cache HIT: ${brandName}`);
        return data as BrandCacheEntry;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data, error } = await supabase
          .from('brand_cache')
          .select('*')
          .eq('normalized_name', normalized)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            logger.debug(`Brand cache miss: ${brandName}`);
            return null;
          }
          logger.warn('Brand cache lookup error:', error);
          return null;
        }

        if (data) {
          await this.incrementHitCount(data.id);
          logger.info(`Brand cache HIT: ${brandName}`);
          return data as BrandCacheEntry;
        }
      }

      return null;
    } catch (error) {
      logger.warn('Brand cache get failed:', error);
      return null;
    }
  }

  /**
   * Save brand classification to cache
   */
  async save(
    brandName: string,
    brandUrl: string | undefined,
    brandTypeAnalysis: BrandTypeAnalysis,
    classificationData: BrandClassificationData
  ): Promise<void> {
    if (!(await isDatabaseAvailable())) {
      logger.debug('Database not available, skipping cache save');
      return;
    }

    const mode = getDatabaseMode();
    const normalized = this.normalizeBrandName(brandName);

    const classificationJson = {
      brandType: brandTypeAnalysis.type,
      score: brandTypeAnalysis.score,
      confidence: brandTypeAnalysis.confidence,
      reasoning: brandTypeAnalysis.reasoning,
      breakdown: brandTypeAnalysis.breakdown,
      sources: classificationData
    };

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return;

        // Upsert using ON CONFLICT
        await pool.query(
          `INSERT INTO brand_cache (brand_name, brand_url, normalized_name, classification_data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (normalized_name)
           DO UPDATE SET
             brand_name = EXCLUDED.brand_name,
             brand_url = EXCLUDED.brand_url,
             classification_data = EXCLUDED.classification_data,
             created_at = NOW(),
             expires_at = NOW() + INTERVAL '7 days',
             hit_count = 0`,
          [brandName, brandUrl, normalized, JSON.stringify(classificationJson)]
        );

        logger.info(`Brand cache saved: ${brandName}`);
        return;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const cacheData = {
          brand_name: brandName,
          brand_url: brandUrl,
          normalized_name: normalized,
          classification_data: classificationJson
        };

        const { error } = await supabase
          .from('brand_cache')
          .upsert(cacheData, {
            onConflict: 'normalized_name'
          });

        if (error) {
          logger.warn('Brand cache save failed:', error);
          return;
        }

        logger.info(`Brand cache saved: ${brandName}`);
      }
    } catch (error) {
      logger.warn('Brand cache save failed:', error);
    }
  }

  /**
   * Increment hit count for analytics
   */
  private async incrementHitCount(id: string): Promise<void> {
    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return;

        await pool.query(
          `UPDATE brand_cache
           SET hit_count = hit_count + 1,
               last_hit_at = NOW()
           WHERE id = $1`,
          [id]
        );
        return;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // Fetch current hit_count
        const { data: current } = await supabase
          .from('brand_cache')
          .select('hit_count')
          .eq('id', id)
          .single();

        if (current) {
          // Update with incremented value
          await supabase
            .from('brand_cache')
            .update({
              hit_count: current.hit_count + 1,
              last_hit_at: new Date().toISOString()
            })
            .eq('id', id);
        }
      }
    } catch (error) {
      // Non-critical, just log
      logger.debug('Failed to increment cache hit count:', error);
    }
  }

  /**
   * Clear expired cache entries (manual cleanup)
   */
  async clearExpired(): Promise<number> {
    if (!(await isDatabaseAvailable())) {
      return 0;
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return 0;

        const result = await pool.query(
          `DELETE FROM brand_cache
           WHERE expires_at < NOW()
           RETURNING id`
        );

        const count = result.rowCount || 0;
        if (count > 0) {
          logger.info(`Cleared ${count} expired brand cache entries`);
        }
        return count;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return 0;

        const { data, error } = await supabase
          .from('brand_cache')
          .delete()
          .lt('expires_at', new Date().toISOString())
          .select('id');

        if (error) {
          logger.warn('Failed to clear expired cache:', error);
          return 0;
        }

        const count = data?.length || 0;
        if (count > 0) {
          logger.info(`Cleared ${count} expired brand cache entries`);
        }
        return count;
      }

      return 0;
    } catch (error) {
      logger.warn('Failed to clear expired cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{ total: number; expired: number; hitRate: number }> {
    if (!(await isDatabaseAvailable())) {
      return { total: 0, expired: 0, hitRate: 0 };
    }

    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return { total: 0, expired: 0, hitRate: 0 };

        const totalResult = await pool.query('SELECT COUNT(*) as count FROM brand_cache');
        const expiredResult = await pool.query(
          'SELECT COUNT(*) as count FROM brand_cache WHERE expires_at < NOW()'
        );
        const hitsResult = await pool.query('SELECT SUM(hit_count) as total_hits FROM brand_cache');

        const total = parseInt(totalResult.rows[0]?.count || '0');
        const expired = parseInt(expiredResult.rows[0]?.count || '0');
        const totalHits = parseInt(hitsResult.rows[0]?.total_hits || '0');
        const hitRate = total ? totalHits / total : 0;

        return { total, expired, hitRate };
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return { total: 0, expired: 0, hitRate: 0 };

        const { count: total } = await supabase
          .from('brand_cache')
          .select('*', { count: 'exact', head: true });

        const { count: expired } = await supabase
          .from('brand_cache')
          .select('*', { count: 'exact', head: true })
          .lt('expires_at', new Date().toISOString());

        const { data: hits } = await supabase
          .from('brand_cache')
          .select('hit_count');

        const totalHits = hits?.reduce((sum, row) => sum + (row.hit_count || 0), 0) || 0;
        const hitRate = total ? totalHits / total : 0;

        return {
          total: total || 0,
          expired: expired || 0,
          hitRate
        };
      }

      return { total: 0, expired: 0, hitRate: 0 };
    } catch (error) {
      logger.warn('Failed to get cache stats:', error);
      return { total: 0, expired: 0, hitRate: 0 };
    }
  }
}

// Export singleton instance
export const brandCacheRepository = new BrandCacheRepository();

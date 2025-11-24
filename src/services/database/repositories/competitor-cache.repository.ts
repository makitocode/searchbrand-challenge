/**
 * Competitor Cache Repository
 * Manages caching of competitor search results
 */

import { getPgPool, getSupabaseClient, getDatabaseMode, isDatabaseAvailable } from '../client.js';
import { logger } from '../../../utils/logger.js';

export interface CompetitorCacheEntry {
  id: string;
  brand_name: string;
  industry: string;
  brand_type: 'global' | 'niche';
  location?: string;
  competitors: Array<{
    name: string;
    url?: string;
    description: string;
  }>;
  competitor_count: number;
  created_at: string;
  expires_at: string;
  hit_count: number;
  last_hit_at?: string;
}

export class CompetitorCacheRepository {
  /**
   * Generate cache key from parameters
   */
  private getCacheKey(
    brandName: string,
    industry: string,
    brandType: 'global' | 'niche',
    location?: string
  ): string {
    return `${brandName}|${industry}|${brandType}|${location || ''}`;
  }

  /**
   * Get cached competitor list
   */
  async get(
    brandName: string,
    industry: string,
    brandType: 'global' | 'niche',
    location?: string
  ): Promise<CompetitorCacheEntry | null> {
    if (!(await isDatabaseAvailable())) {
      logger.debug('Database not available, skipping competitor cache lookup');
      return null;
    }

    const mode = getDatabaseMode();
    const normalizedLocation = location || ''; // Use empty string instead of null

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return null;

        const result = await pool.query(
          `SELECT * FROM competitor_cache
           WHERE brand_name = $1
           AND industry = $2
           AND brand_type = $3
           AND location = $4
           AND expires_at > NOW()
           LIMIT 1`,
          [brandName, industry, brandType, normalizedLocation]
        );

        if (result.rows.length === 0) {
          logger.debug(`Competitor cache miss: ${this.getCacheKey(brandName, industry, brandType, location)}`);
          return null;
        }

        const data = result.rows[0];
        await this.incrementHitCount(data.id);
        logger.info(`Competitor cache HIT: ${brandName} (${industry})`);
        return data as CompetitorCacheEntry;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return null;

        const { data, error } = await supabase
          .from('competitor_cache')
          .select('*')
          .eq('brand_name', brandName)
          .eq('industry', industry)
          .eq('brand_type', brandType)
          .eq('location', normalizedLocation)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (error) {
          if (error.code === 'PGRST116') {
            logger.debug(`Competitor cache miss: ${this.getCacheKey(brandName, industry, brandType, location)}`);
            return null;
          }
          logger.warn('Competitor cache lookup error:', error);
          return null;
        }

        if (data) {
          await this.incrementHitCount(data.id);
          logger.info(`Competitor cache HIT: ${brandName} (${industry})`);
          return data as CompetitorCacheEntry;
        }
      }

      return null;
    } catch (error) {
      logger.warn('Competitor cache get failed:', error);
      return null;
    }
  }

  /**
   * Save competitor list to cache
   */
  async save(
    brandName: string,
    industry: string,
    brandType: 'global' | 'niche',
    location: string | undefined,
    competitors: Array<{ name: string; url?: string; description: string }>
  ): Promise<void> {
    if (!(await isDatabaseAvailable())) {
      logger.debug('Database not available, skipping competitor cache save');
      return;
    }

    const mode = getDatabaseMode();
    const normalizedLocation = location || ''; // Use empty string instead of null

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return;

        // Upsert using ON CONFLICT
        await pool.query(
          `INSERT INTO competitor_cache (brand_name, industry, brand_type, location, competitors, competitor_count)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (brand_name, industry, brand_type, location)
           DO UPDATE SET
             competitors = EXCLUDED.competitors,
             competitor_count = EXCLUDED.competitor_count,
             created_at = NOW(),
             expires_at = NOW() + INTERVAL '3 days',
             hit_count = 0`,
          [brandName, industry, brandType, normalizedLocation, JSON.stringify(competitors), competitors.length]
        );

        logger.info(`Competitor cache saved: ${brandName} (${competitors.length} competitors)`);
        return;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return;

        const cacheData = {
          brand_name: brandName,
          industry,
          brand_type: brandType,
          location: normalizedLocation,
          competitors,
          competitor_count: competitors.length
        };

        const { error } = await supabase
          .from('competitor_cache')
          .upsert(cacheData, {
            onConflict: 'brand_name,industry,brand_type,location'
          });

        if (error) {
          logger.warn('Competitor cache save failed:', error);
          return;
        }

        logger.info(`Competitor cache saved: ${brandName} (${competitors.length} competitors)`);
      }
    } catch (error) {
      logger.warn('Competitor cache save failed:', error);
    }
  }

  /**
   * Increment hit count
   */
  private async incrementHitCount(id: string): Promise<void> {
    const mode = getDatabaseMode();

    try {
      if (mode === 'local') {
        const pool = getPgPool();
        if (!pool) return;

        await pool.query(
          `UPDATE competitor_cache
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
          .from('competitor_cache')
          .select('hit_count')
          .eq('id', id)
          .single();

        if (current) {
          // Update with incremented value
          await supabase
            .from('competitor_cache')
            .update({
              hit_count: current.hit_count + 1,
              last_hit_at: new Date().toISOString()
            })
            .eq('id', id);
        }
      }
    } catch (error) {
      logger.debug('Failed to increment cache hit count:', error);
    }
  }

  /**
   * Clear expired entries
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
          `DELETE FROM competitor_cache
           WHERE expires_at < NOW()
           RETURNING id`
        );

        const count = result.rowCount || 0;
        if (count > 0) {
          logger.info(`Cleared ${count} expired competitor cache entries`);
        }
        return count;
      }

      if (mode === 'supabase') {
        const supabase = getSupabaseClient();
        if (!supabase) return 0;

        const { data, error } = await supabase
          .from('competitor_cache')
          .delete()
          .lt('expires_at', new Date().toISOString())
          .select('id');

        if (error) {
          logger.warn('Failed to clear expired competitor cache:', error);
          return 0;
        }

        const count = data?.length || 0;
        if (count > 0) {
          logger.info(`Cleared ${count} expired competitor cache entries`);
        }

        return count;
      }

      return 0;
    } catch (error) {
      logger.warn('Failed to clear expired competitor cache:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const competitorCacheRepository = new CompetitorCacheRepository();

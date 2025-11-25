/**
 * Database Client
 * Provides unified access to database (Supabase or local PostgreSQL)
 * Automatically switches based on environment variables
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import { logger } from '../../utils/logger.js';

// For local PostgreSQL
let pgPool: Pool | null = null;

// For Supabase Cloud
let supabaseClient: SupabaseClient | null = null;

// Database mode
let databaseMode: 'local' | 'supabase' | 'none' = 'none';

/**
 * Get PostgreSQL Pool (for local development)
 */
export function getPgPool(): Pool | null {
  if (pgPool) {
    return pgPool;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl || !databaseUrl.startsWith('postgresql://')) {
    return null;
  }

  logger.info('Initializing local PostgreSQL connection');
  pgPool = new Pool({
    connectionString: databaseUrl,
    max: 10, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Test connection (silent - will log on first use)
  pgPool.query('SELECT NOW()')
    .then(() => logger.debug('Local PostgreSQL connected successfully'))
    .catch((err) => logger.debug('Local PostgreSQL connection failed:', err));

  databaseMode = 'local';
  return pgPool;
}

/**
 * Get Supabase client (for cloud)
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('http')) {
    return null;
  }

  logger.info('Initializing Supabase Cloud connection');
  supabaseClient = createClient(supabaseUrl, supabaseKey);
  databaseMode = 'supabase';

  return supabaseClient;
}

/**
 * Get database client (singleton)
 * Returns Supabase client for compatibility with existing code
 * Automatically switches based on NODE_ENV:
 * - development: Uses local PostgreSQL (DATABASE_URL)
 * - production: Uses Supabase Cloud (SUPABASE_URL + SUPABASE_KEY)
 */
export function getDatabaseClient(): SupabaseClient {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // In development: Use local PostgreSQL
  if (nodeEnv === 'development') {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl && databaseUrl.startsWith('postgresql://')) {
      // Initialize pg pool but still need to return something for compatibility
      getPgPool();

      // For local, we'll create a mock Supabase client
      // The actual queries will be handled by repositories using getPgPool()
      if (!supabaseClient) {
        logger.warn('Using local PostgreSQL - Supabase client methods will not work');
        supabaseClient = createClient(
          'http://localhost:54321',
          'dummy-key',
          {
            db: { schema: 'public' },
            auth: { persistSession: false }
          }
        );
      }
      return supabaseClient;
    }
  }

  // In production: Use Supabase Cloud
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    const client = getSupabaseClient();
    if (client) {
      return client;
    }
  }


  // No database configured - this is OK, features will be disabled
  logger.warn('No database configured. Cache and persistence features will be disabled.');
  databaseMode = 'none';

  if (!supabaseClient) {
    supabaseClient = createClient(
      'http://localhost:54321',
      'dummy-key',
      {
        db: { schema: 'public' },
        auth: { persistSession: false }
      }
    );
  }

  return supabaseClient;
}

/**
 * Get current database mode
 */
export function getDatabaseMode(): 'local' | 'supabase' | 'none' {
  return databaseMode;
}

/**
 * Check if database is configured and available
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const mode = getDatabaseMode();

    if (mode === 'local') {
      const pool = getPgPool();
      if (!pool) return false;

      const result = await pool.query('SELECT 1');
      return result.rowCount !== null && result.rowCount > 0;
    }

    if (mode === 'supabase') {
      const client = getSupabaseClient();
      if (!client) return false;

      const { error } = await client.from('users').select('id').limit(1);
      if (error) {
        logger.debug('Database not available:', error.message);
        return false;
      }
      return true;
    }

    return false;
  } catch (error) {
    logger.debug('Database not available:', error);
    return false;
  }
}

/**
 * Execute raw SQL query (for migrations and setup)
 * Only works with local PostgreSQL
 */
export async function executeSQL(sql: string): Promise<void> {
  const pool = getPgPool();

  if (!pool) {
    throw new Error('DATABASE_URL not configured. Cannot execute SQL directly.');
  }

  try {
    await pool.query(sql);
    logger.info('SQL executed successfully');
  } catch (error) {
    logger.error('SQL execution failed:', error);
    throw error;
  }
}

// Export client instance for convenience (kept for backward compatibility)
export const db = getDatabaseClient();

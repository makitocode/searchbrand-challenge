#!/usr/bin/env tsx
/**
 * Script to clean local database tables (except users)
 * Run with: npx tsx scripts/clean-db-local.ts
 */

import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL in .env file');
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
});

async function showTableCounts() {
  console.log('\n📊 Current table status:');
  console.log('------------------------');

  try {
    const result = await pool.query(`
      SELECT
        'users' as tabla, COUNT(*) as registros FROM users
      UNION ALL
      SELECT 'brand_analyses', COUNT(*) FROM brand_analyses
      UNION ALL
      SELECT 'competitors', COUNT(*) FROM competitors
      UNION ALL
      SELECT 'auth_tokens', COUNT(*) FROM auth_tokens
      ORDER BY tabla;
    `);

    for (const row of result.rows) {
      console.log(`   ${row.tabla}: ${row.registros} records`);
    }
  } catch (error) {
    console.error('Error getting table counts:', error);
  }
}

async function cleanDatabase() {
  console.log('\n🧹 Cleaning database (preserving users)...\n');

  // Show before state
  await showTableCounts();

  console.log('\n🗑️  Deleting data...');

  try {
    // Start transaction
    await pool.query('BEGIN');

    // Delete in correct order (respecting foreign keys)
    const competitorsResult = await pool.query('DELETE FROM competitors');
    console.log(`✅ Deleted ${competitorsResult.rowCount} competitors`);

    const analysesResult = await pool.query('DELETE FROM brand_analyses');
    console.log(`✅ Deleted ${analysesResult.rowCount} brand analyses`);

    const tokensResult = await pool.query('DELETE FROM auth_tokens');
    console.log(`✅ Deleted ${tokensResult.rowCount} auth tokens`);

    // Reset sequences
    await pool.query('ALTER SEQUENCE IF EXISTS competitors_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE IF EXISTS brand_analyses_id_seq RESTART WITH 1');
    await pool.query('ALTER SEQUENCE IF EXISTS auth_tokens_id_seq RESTART WITH 1');
    console.log('✅ Reset auto-increment sequences');

    // Commit transaction
    await pool.query('COMMIT');

  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('❌ Error during cleanup:', error);
    throw error;
  }

  // Show after state
  console.log('\n✨ Cleanup completed!');
  await showTableCounts();
}

// Main execution
console.log('⚠️  WARNING: This will delete all data except users!');
console.log('Database:', databaseUrl.split('@')[1]?.split('/')[0] || 'local');
console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(async () => {
  try {
    await cleanDatabase();
    console.log('\n✅ Database cleaned successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}, 3000);
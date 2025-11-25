#!/usr/bin/env tsx
/**
 * Script to clean database tables (except users)
 * Run with: npm run tsx scripts/clean-db.ts
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function showTableCounts() {
  console.log('\n📊 Current table status:');
  console.log('------------------------');

  const tables = ['users', 'brand_analyses', 'competitors', 'auth_tokens'];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`   ${table}: Error - ${error.message}`);
    } else {
      console.log(`   ${table}: ${count} records`);
    }
  }
}

async function cleanDatabase() {
  console.log('\n🧹 Cleaning database (preserving users)...\n');

  // Show before state
  await showTableCounts();

  console.log('\n🗑️  Deleting data...');

  // Delete competitors first (has foreign key to brand_analyses)
  const { error: competitorsError } = await supabase
    .from('competitors')
    .delete()
    .neq('id', 0); // Delete all (neq with impossible value)

  if (competitorsError) {
    console.error('❌ Error deleting competitors:', competitorsError.message);
  } else {
    console.log('✅ Competitors deleted');
  }

  // Delete brand_analyses
  const { error: analysesError } = await supabase
    .from('brand_analyses')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

  if (analysesError) {
    console.error('❌ Error deleting brand_analyses:', analysesError.message);
  } else {
    console.log('✅ Brand analyses deleted');
  }

  // Delete auth_tokens
  const { error: tokensError } = await supabase
    .from('auth_tokens')
    .delete()
    .neq('id', 0); // Delete all

  if (tokensError) {
    console.error('❌ Error deleting auth_tokens:', tokensError.message);
  } else {
    console.log('✅ Auth tokens deleted');
  }

  // Show after state
  console.log('\n✨ Cleanup completed!');
  await showTableCounts();
}

// Ask for confirmation
console.log('⚠️  WARNING: This will delete all data except users!');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(async () => {
  try {
    await cleanDatabase();
    console.log('\n✅ Database cleaned successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}, 3000);
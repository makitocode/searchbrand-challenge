-- SearchBrand Database Reset (Preserving Users)
-- WARNING: This drops ALL tables EXCEPT users
-- Use this to clean analysis data while keeping user accounts
-- Created: 2025-11-24

-- ============================================
-- STEP 1: Drop tables (except users)
-- ============================================
-- Drop in order respecting foreign key constraints

DROP TABLE IF EXISTS competitors CASCADE;
DROP TABLE IF EXISTS brand_analyses CASCADE;
DROP TABLE IF EXISTS competitor_cache CASCADE;
DROP TABLE IF EXISTS brand_cache CASCADE;
DROP TABLE IF EXISTS auth_tokens CASCADE;

-- Note: We're NOT dropping users table

-- ============================================
-- STEP 2: Drop functions (if they exist)
-- ============================================
DROP FUNCTION IF EXISTS cleanup_expired_brand_cache() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_competitor_cache() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_tokens() CASCADE;

-- ============================================
-- ALTERNATIVE: Delete data instead of dropping tables
-- ============================================
-- If you prefer to keep the table structure and only delete data,
-- comment out the DROP commands above and use these instead:

/*
-- Delete data in order (respecting foreign keys)
DELETE FROM competitors WHERE 1=1;
DELETE FROM brand_analyses WHERE 1=1;
DELETE FROM competitor_cache WHERE 1=1;
DELETE FROM brand_cache WHERE 1=1;
DELETE FROM auth_tokens WHERE 1=1;

-- Reset sequences (auto-increment counters)
ALTER SEQUENCE IF EXISTS competitors_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS brand_analyses_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS competitor_cache_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS brand_cache_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS auth_tokens_id_seq RESTART WITH 1;
*/

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these after the reset to verify the state:

/*
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL
SELECT 'brand_analyses', COUNT(*) FROM brand_analyses
UNION ALL
SELECT 'competitors', COUNT(*) FROM competitors
UNION ALL
SELECT 'auth_tokens', COUNT(*) FROM auth_tokens
UNION ALL
SELECT 'brand_cache', COUNT(*) FROM brand_cache WHERE 1=1
UNION ALL
SELECT 'competitor_cache', COUNT(*) FROM competitor_cache WHERE 1=1
ORDER BY table_name;
*/

-- ============================================
-- SAFE VERSION FOR PRODUCTION
-- ============================================
-- For production, use this wrapped in a transaction:

/*
BEGIN;

-- Show current state
SELECT 'BEFORE RESET:' as status;
SELECT
    'users' as table_name, COUNT(*) as records FROM users
UNION ALL
SELECT
    'brand_analyses', COUNT(*) FROM brand_analyses
UNION ALL
SELECT
    'competitors', COUNT(*) FROM competitors
UNION ALL
SELECT
    'auth_tokens', COUNT(*) FROM auth_tokens;

-- Perform cleanup (keeping users)
DELETE FROM competitors;
DELETE FROM brand_analyses;
DELETE FROM auth_tokens;

-- Reset sequences
ALTER SEQUENCE IF EXISTS competitors_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS brand_analyses_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS auth_tokens_id_seq RESTART WITH 1;

-- Show new state
SELECT 'AFTER RESET:' as status;
SELECT
    'users' as table_name, COUNT(*) as records FROM users
UNION ALL
SELECT
    'brand_analyses', COUNT(*) FROM brand_analyses
UNION ALL
SELECT
    'competitors', COUNT(*) FROM competitors
UNION ALL
SELECT
    'auth_tokens', COUNT(*) FROM auth_tokens;

-- IMPORTANT: Review results before committing!
-- If everything looks good, run: COMMIT;
-- If something went wrong, run: ROLLBACK;
END;
*/
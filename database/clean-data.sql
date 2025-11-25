-- SearchBrand Clean Data Script
-- Preserves users table, deletes everything else
-- Date: 2025-11-24

-- ============================================
-- SIMPLE VERSION - Just delete the data
-- ============================================

-- Delete in correct order (respecting foreign keys)
DELETE FROM competitors;
DELETE FROM brand_analyses;
DELETE FROM auth_tokens;

-- Reset auto-increment sequences to 1
ALTER SEQUENCE IF EXISTS competitors_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS brand_analyses_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS auth_tokens_id_seq RESTART WITH 1;

-- Show results
SELECT
    'Cleanup completed!' as message,
    (SELECT COUNT(*) FROM users) as users_preserved,
    (SELECT COUNT(*) FROM brand_analyses) as analyses_count,
    (SELECT COUNT(*) FROM competitors) as competitors_count,
    (SELECT COUNT(*) FROM auth_tokens) as tokens_count;
-- SearchBrand Database Reset
-- WARNING: This drops ALL tables and data
-- Use ONLY in development

DROP TABLE IF EXISTS competitors CASCADE;
DROP TABLE IF EXISTS brand_analyses CASCADE;
DROP TABLE IF EXISTS competitor_cache CASCADE;
DROP TABLE IF EXISTS brand_cache CASCADE;
DROP TABLE IF EXISTS auth_tokens CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_expired_brand_cache() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_competitor_cache() CASCADE;
DROP FUNCTION IF EXISTS cleanup_expired_tokens() CASCADE;

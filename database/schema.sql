-- SearchBrand Database Schema
-- PostgreSQL 15+
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Table: users
-- ============================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- Table: brand_cache
-- Purpose: Cache brand classification results
-- ============================================

CREATE TABLE IF NOT EXISTS brand_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Brand identification
  brand_name VARCHAR(255) NOT NULL,
  brand_url VARCHAR(500),
  normalized_name VARCHAR(255) NOT NULL, -- lowercase, no spaces

  -- Classification result (JSONB)
  classification_data JSONB NOT NULL,
  /* Structure:
  {
    "brandType": "global" | "niche",
    "score": 85,
    "confidence": 95,
    "reasoning": "...",
    "breakdown": {
      "wikipedia": 25,
      "llm_direct": 20,
      "google_search": 18,
      "google_trends": 15,
      "official_website": 7
    },
    "sources": {
      "wikipedia": { "exists": true, "categories": [...], ... },
      "llmDirect": { "knows_brand": true, ... },
      "googleSearch": { "languages_detected": [...], ... },
      "googleTrends": { "continents": [...], ... },
      "officialWebsite": { "languages_available": 3, ... }
    }
  }
  */

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_cache_normalized ON brand_cache(normalized_name);
CREATE INDEX IF NOT EXISTS idx_brand_cache_expires ON brand_cache(expires_at);

-- ============================================
-- Table: competitor_cache
-- Purpose: Cache competitor lists
-- ============================================

CREATE TABLE IF NOT EXISTS competitor_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Composite key
  brand_name VARCHAR(255) NOT NULL,
  industry VARCHAR(255) NOT NULL,
  brand_type VARCHAR(20) NOT NULL, -- 'global' | 'niche'
  location VARCHAR(255) NOT NULL DEFAULT '', -- Empty string for global brands

  -- Competitor list (JSONB)
  competitors JSONB NOT NULL,
  /* Structure:
  [
    {
      "name": "Apple Music",
      "url": "https://music.apple.com",
      "description": "Music streaming service..."
    },
    ...
  ]
  */

  -- Metadata
  competitor_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '3 days',
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_competitor_cache_key
  ON competitor_cache(brand_name, industry, brand_type, location);

CREATE INDEX IF NOT EXISTS idx_competitor_cache_expires
  ON competitor_cache(expires_at);

-- ============================================
-- Table: brand_analyses
-- Purpose: User analysis history
-- ============================================

CREATE TABLE IF NOT EXISTS brand_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Input
  input_brand VARCHAR(500) NOT NULL,
  input_type VARCHAR(20) NOT NULL, -- 'brand_name' | 'url'
  selected_category VARCHAR(255), -- If disambiguated

  -- Brand context
  brand_name VARCHAR(255) NOT NULL,
  brand_url VARCHAR(500),
  industry VARCHAR(255) NOT NULL,
  analysis_type VARCHAR(20) NOT NULL, -- 'global' | 'niche'
  location VARCHAR(255),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_message TEXT,

  -- Snapshots (JSONB)
  input_analysis JSONB,
  classification_result JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Metrics
  processing_time_ms INTEGER,
  competitor_count INTEGER DEFAULT 0,
  data_sources TEXT[],
  llm_models_used TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_analyses_user ON brand_analyses(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analyses_status ON brand_analyses(status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_analyses_brand ON brand_analyses(brand_name, created_at DESC);

-- Check constraints
ALTER TABLE brand_analyses DROP CONSTRAINT IF EXISTS check_status;
ALTER TABLE brand_analyses
  ADD CONSTRAINT check_status
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE brand_analyses DROP CONSTRAINT IF EXISTS check_analysis_type;
ALTER TABLE brand_analyses
  ADD CONSTRAINT check_analysis_type
  CHECK (analysis_type IN ('global', 'niche'));

ALTER TABLE brand_analyses DROP CONSTRAINT IF EXISTS check_input_type;
ALTER TABLE brand_analyses
  ADD CONSTRAINT check_input_type
  CHECK (input_type IN ('brand_name', 'url'));

-- ============================================
-- Table: competitors
-- Purpose: Scored competitors per analysis
-- ============================================

CREATE TABLE IF NOT EXISTS competitors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id UUID NOT NULL REFERENCES brand_analyses(id) ON DELETE CASCADE,

  -- Competitor info
  competitor_name VARCHAR(255) NOT NULL,
  competitor_url VARCHAR(500),

  -- Scoring
  similarity_score NUMERIC(5,2) NOT NULL,
  ranking INTEGER NOT NULL,

  -- Breakdown (JSONB)
  score_breakdown JSONB NOT NULL,
  /* Structure:
  {
    "industry": 15,
    "businessModel": 14,
    "productOffering": 14,
    "targetAudience": 10,
    "geography": 10,
    "marketSize": 9,
    "priceRange": 9,
    "digitalPresence": 5,
    "brandMaturity": 4,
    "keywords": 5
  }
  */

  -- Evidence (JSONB)
  evidence JSONB NOT NULL,
  /* Structure:
  [
    "Both operate in music streaming",
    "Similar subscription model ($9.99 vs $10.99)",
    "Catalog of 70M+ songs"
  ]
  */

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_competitors_analysis ON competitors(analysis_id, ranking);
CREATE INDEX IF NOT EXISTS idx_competitors_score ON competitors(analysis_id, similarity_score DESC);

-- Check constraints
ALTER TABLE competitors DROP CONSTRAINT IF EXISTS check_similarity_score;
ALTER TABLE competitors
  ADD CONSTRAINT check_similarity_score
  CHECK (similarity_score >= 0 AND similarity_score <= 100);

ALTER TABLE competitors DROP CONSTRAINT IF EXISTS check_ranking;
ALTER TABLE competitors
  ADD CONSTRAINT check_ranking
  CHECK (ranking >= 1 AND ranking <= 10);

-- ============================================
-- Table: auth_tokens
-- Purpose: JWT token management
-- ============================================

CREATE TABLE IF NOT EXISTS auth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA256
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_hash ON auth_tokens(token_hash) WHERE revoked = FALSE;
CREATE INDEX IF NOT EXISTS idx_tokens_user_active ON auth_tokens(user_id, expires_at)
  WHERE revoked = FALSE;

-- ============================================
-- Triggers and Functions
-- ============================================

-- Auto-cleanup expired brand cache
CREATE OR REPLACE FUNCTION cleanup_expired_brand_cache()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM brand_cache WHERE expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_brand_cache ON brand_cache;
CREATE TRIGGER trigger_cleanup_brand_cache
  AFTER INSERT ON brand_cache
  EXECUTE FUNCTION cleanup_expired_brand_cache();

-- Auto-cleanup expired competitor cache
CREATE OR REPLACE FUNCTION cleanup_expired_competitor_cache()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM competitor_cache WHERE expires_at < NOW();
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_competitor_cache ON competitor_cache;
CREATE TRIGGER trigger_cleanup_competitor_cache
  AFTER INSERT ON competitor_cache
  EXECUTE FUNCTION cleanup_expired_competitor_cache();

-- Auto-cleanup expired auth tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM auth_tokens WHERE expires_at < NOW() AND revoked = TRUE;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_cleanup_tokens ON auth_tokens;
CREATE TRIGGER trigger_cleanup_tokens
  AFTER INSERT ON auth_tokens
  EXECUTE FUNCTION cleanup_expired_tokens();

-- SearchBrand Seed Data
-- Creates demo user and sample data for testing

-- ============================================
-- Demo User
-- ============================================

-- Email: demo@searchbrand.com
-- Password: demo123
-- Hashed with bcrypt (10 rounds)
INSERT INTO users (email, password_hash)
VALUES ('demo@searchbrand.com', '$2b$10$flLVcITwQbuUMrjzBUes6OwzURpdznra9glxDAW/enUKSssWeVfsK')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Note: Cache tables and analyses remain empty
-- They will be populated as users interact with the system
-- ============================================

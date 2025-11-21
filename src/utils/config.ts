import dotenv from 'dotenv';
import { AppConfig } from '../types';

// Load environment variables
dotenv.config();

/**
 * Validates and returns application configuration
 * Throws error if required environment variables are missing
 */
function loadConfig(): AppConfig {
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'ANTHROPIC_API_KEY',
    'OPENAI_API_KEY',
    'JWT_SECRET',
  ];

  const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file against .env.example'
    );
  }

  return {
    // Database
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseKey: process.env.SUPABASE_KEY!,

    // LLMs
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    openaiApiKey: process.env.OPENAI_API_KEY!,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4',

    // Auth
    jwtSecret: process.env.JWT_SECRET!,

    // App
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',

    // Optional
    serpApiKey: process.env.SERP_API_KEY,
  };
}

export const config = loadConfig();

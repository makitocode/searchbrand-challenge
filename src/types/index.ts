/**
 * Core Types for SearchBrand Challenge
 */

// ============================================
// Input Types
// ============================================

export interface BrandInput {
  brand: string;
  category?: string;
}

export type InputType = 'brand_name' | 'url';
export type AnalysisType = 'global' | 'niche';
export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ============================================
// LLM Analysis Types
// ============================================

export interface InputAnalysis {
  inputType: InputType;
  brandName: string;
  brandUrl?: string;
  inferredIndustries: string[];
  isAmbiguous: boolean;
  suggestedCategories?: string[];
  confidence: number;
}

export interface EnrichedBrandData {
  industry: {
    primary: string;
    secondary: string[];
  };
  businessModel: string;
  targetAudience: string;
  priceRange?: {
    min: number;
    max: number;
    currency: string;
  };
  valueProposition: string;
  keywords: string[];
  location?: string;
}

// ============================================
// Scoring Types
// ============================================

export interface SimilarityBreakdown {
  industry: number; // max 15
  businessModel: number; // max 15
  productOffering: number; // max 15
  targetAudience: number; // max 10
  geography: number; // max 10
  marketSize: number; // max 10
  priceRange: number; // max 10
  digitalPresence: number; // max 5
  brandMaturity: number; // max 5
  keywords: number; // max 5
}

export interface CompetitorResult {
  rank: number;
  name: string;
  url?: string;
  similarity_score: number; // 0-100
  breakdown: SimilarityBreakdown;
  evidence: string[];
  enriched_data?: EnrichedBrandData;
}

// ============================================
// Analysis Result Types
// ============================================

export interface AnalysisResult {
  analysis: {
    id: string;
    brand: {
      name: string;
      url?: string;
      industry: string;
      category: string;
      location?: string;
    };
    analysisType: AnalysisType;
    timestamp: string;
    processingTime?: string;
  };
  competitors: CompetitorResult[];
  metadata: {
    totalCandidatesAnalyzed: number;
    dataSources: string[];
    llmModelsUsed: string[];
  };
}

// ============================================
// Scraping Types
// ============================================

export interface ScrapedMetadata {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  url: string;
}

export interface WikipediaData {
  exists: boolean;
  title?: string;
  categories?: string[];
  summary?: string;
  competitors?: string[];
  infobox?: Record<string, string>;
}

export interface GoogleSearchResult {
  title: string;
  url: string;
  snippet: string;
}

// ============================================
// Database Types
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface BrandAnalysis {
  id: string;
  user_id: string;
  input_brand: string;
  input_type: InputType;
  brand_name: string;
  brand_url?: string;
  industry: string;
  category: string;
  analysis_type: AnalysisType;
  status: AnalysisStatus;
  error_message?: string;
  llm_input_analysis?: InputAnalysis;
  llm_enriched_data?: EnrichedBrandData;
  created_at: Date;
  started_at?: Date;
  completed_at?: Date;
}

export interface Competitor {
  id: string;
  analysis_id: string;
  competitor_name: string;
  competitor_url?: string;
  similarity_score: number;
  ranking: number;
  score_breakdown: SimilarityBreakdown;
  evidence: string[];
  enriched_data?: EnrichedBrandData;
  created_at: Date;
}

export interface AuthToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

// ============================================
// Strategy Interface
// ============================================

export interface BrandAnalysisStrategy {
  analyze(brandInput: string, category?: string): Promise<CompetitorResult[]>;
}

// ============================================
// Configuration Types
// ============================================

export interface AppConfig {
  // Database
  supabaseUrl: string;
  supabaseKey: string;

  // LLMs
  anthropicApiKey: string;
  anthropicModel: string;
  openaiApiKey: string;
  openaiModel: string;

  // Auth
  jwtSecret: string;

  // App
  port: number;
  nodeEnv: string;

  // Optional
  serpApiKey?: string;
}

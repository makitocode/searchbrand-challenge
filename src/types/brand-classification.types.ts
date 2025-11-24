/**
 * Brand Classification Types
 * Types for multi-source brand classification system
 */

/**
 * LLM Direct Knowledge about a brand
 */
export interface LLMBrandKnowledge {
  knows_brand: boolean;
  classification: 'global' | 'local' | 'unknown';
  confidence: number; // 0-100
  known_countries: string[];
  continental_presence: string[];
  primary_country?: string | null; // ISO 2-letter code
  reasoning: string;
}

/**
 * Google Search data for classification
 */
export interface GoogleSearchData {
  languages_detected: string[];
  domains: string[];
  international_media: boolean;
  detected_location?: {
    country: string;
    city?: string;
    region?: string;
    address?: string;
  };
}

/**
 * Google Trends data
 */
export interface TrendsData {
  top_countries: string[];
  continents: string[];
  top_country_concentration: number; // percentage
}

/**
 * Official Website analysis data
 */
export interface WebsiteData {
  languages_available: number;
  has_country_selector: boolean;
  multi_domain: boolean;
}

/**
 * All data sources for brand classification
 */
export interface BrandClassificationData {
  wikipedia?: {
    exists: boolean;
    title?: string;
    summary?: string;
    categories?: string[];
    infobox?: Record<string, string>;
    competitors?: string[];
  };
  llmDirect?: LLMBrandKnowledge;
  googleSearch?: GoogleSearchData;
  googleTrends?: TrendsData;
  officialWebsite?: WebsiteData;
}

/**
 * Score breakdown by source
 */
export interface ScoreBreakdown {
  wikipedia: number;
  llm_direct: number;
  google_search: number;
  google_trends: number;
  official_website: number;
}

/**
 * Brand type analysis result (updated with multi-source)
 */
export interface BrandTypeAnalysis {
  type: 'global' | 'niche';
  score: number; // 0-100
  confidence: number; // 0-100
  reasoning: string;
  breakdown: ScoreBreakdown;
  signals: {
    globalIndicators: number;
    nicheIndicators: number;
  };
}

/**
 * Simple Brand Analysis Service
 * Ultra-simplified version using ONLY Claude (no external APIs)
 * Perfect for technical test demo
 */

import { logger } from '../../utils/logger.js';
import { callClaude } from '../llm/clients/claude-client.js';

export interface SimpleAnalysisRequest {
  brand: string;
  userId?: string;
}

export interface SimpleAnalysisResponse {
  status: 'completed' | 'error';
  brand_name: string;
  brand_type: 'global' | 'niche';
  industry: string;
  location?: string;
  competitors: Array<{
    name: string;
    similarityScore: number;
    evidence: string[];
  }>;
  processing_time_ms: number;
}

export class SimpleBrandAnalysisService {
  /**
   * Main analysis method - using ONLY Claude
   */
  async analyze(request: SimpleAnalysisRequest): Promise<SimpleAnalysisResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Starting simple analysis for: ${request.brand}`);

      // Single Claude call to do EVERYTHING
      const analysis = await this.analyzeWithClaude(request.brand);

      const processingTime = Date.now() - startTime;
      logger.info(`Simple analysis completed in ${processingTime}ms`);

      return {
        status: 'completed',
        ...analysis,
        processing_time_ms: processingTime,
      };
    } catch (error) {
      logger.error('Simple analysis failed:', error);
      return {
        status: 'error',
        brand_name: request.brand,
        brand_type: 'niche',
        industry: 'unknown',
        competitors: [],
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Single Claude call to analyze everything
   */
  private async analyzeWithClaude(brandInput: string): Promise<Omit<SimpleAnalysisResponse, 'status' | 'processing_time_ms'>> {
    const prompt = `Analyze the brand "${brandInput}" and provide comprehensive competitive intelligence.

Your task:
1. Identify the exact brand name (cleaned)
2. Classify as "global" (Nike, Spotify, Coca-Cola) or "niche" (local restaurant, boutique shop)
3. Identify the industry/category
4. If niche, identify the location (city, country)
5. List 3-5 direct competitors with similarity scores

IMPORTANT INSTRUCTIONS:
- For GLOBAL brands: List well-known international competitors
- For NICHE brands: List realistic local/regional competitors that would actually exist in that market
- Be realistic - don't make up fake competitors
- Provide evidence for why each is a competitor

Respond ONLY with valid JSON in this exact format:
{
  "brand_name": "exact name",
  "brand_type": "global" or "niche",
  "industry": "category",
  "location": "city, country" or null,
  "competitors": [
    {
      "name": "Competitor Name",
      "similarityScore": 85,
      "evidence": [
        "Same target market",
        "Similar product offering"
      ]
    }
  ]
}

Examples:
- Spotify → competitors: Apple Music, YouTube Music, Amazon Music, Pandora
- Local coffee shop in Bogotá → competitors: Juan Valdez Café, Starbucks Colombia, Café Quindío
- Nike → competitors: Adidas, Puma, Under Armour, New Balance`;

    try {
      const response = await callClaude(prompt, 'You are a competitive intelligence analyst. Respond only with valid JSON.');

      // Clean and parse response
      let jsonStr = response.trim();
      jsonStr = jsonStr.replaceAll('```json', '').replaceAll('```', '').trim();

      const result = JSON.parse(jsonStr);

      // Ensure competitors array exists and is valid
      if (!result.competitors || !Array.isArray(result.competitors)) {
        result.competitors = [];
      }

      // Sort competitors by similarity score
      result.competitors.sort((a: any, b: any) => (b.similarityScore || 0) - (a.similarityScore || 0));

      return result;
    } catch (error) {
      logger.error('Claude analysis failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const simpleBrandAnalysisService = new SimpleBrandAnalysisService();
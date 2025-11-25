/**
 * Simple Brand Analysis Service
 * Ultra-simplified version using ONLY Claude (no external APIs)
 * Perfect for technical test demo - WITH DATABASE STORAGE
 */

import { logger } from '../../utils/logger.js';
import { callClaude } from '../llm/clients/claude-client.js';
import { brandAnalysisRepository } from '../database/repositories/brand-analysis.repository.js';
import { competitorRepository } from '../database/repositories/competitor.repository.js';

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
   * Main analysis method - using ONLY Claude WITH DB STORAGE
   */
  async analyze(request: SimpleAnalysisRequest): Promise<SimpleAnalysisResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Starting simple analysis for: ${request.brand}`);

      // Step 1: Check if we have a recent analysis in DB
      const recentAnalysis = await brandAnalysisRepository.getRecentByBrandName(request.brand, 7);

      if (recentAnalysis?.classification_result) {
        logger.info(`Found recent analysis for ${request.brand} in database`);
        const cached = recentAnalysis.classification_result as {
          brand_name?: string;
          brand_type?: 'global' | 'niche';
          industry?: string;
          location?: string;
          competitors?: Array<{
            name: string;
            similarityScore: number;
            evidence: string[];
          }>;
        };

        return {
          status: 'completed',
          brand_name: cached.brand_name || request.brand,
          brand_type: cached.brand_type || 'niche',
          industry: cached.industry || 'unknown',
          location: cached.location,
          competitors: cached.competitors || [],
          processing_time_ms: Date.now() - startTime,
        };
      }

      // Step 2: Perform new analysis with Claude
      const analysis = await this.analyzeWithClaude(request.brand);

      // Step 3: Save to database
      const analysisId = await brandAnalysisRepository.create({
        user_id: request.userId || null,
        input_brand: request.brand,
        input_type: 'brand_name',
        brand_name: analysis.brand_name,
        brand_url: undefined,
        industry: analysis.industry,
        selected_category: analysis.industry,
        analysis_type: analysis.brand_type,
        input_analysis: {
          brandName: analysis.brand_name,
          inputType: 'brand_name',
          isAmbiguous: false,
          inferredIndustries: [analysis.industry],
          confidence: 85,
        },
      });

      // Update with classification result
      if (analysisId) {
        // Save the analysis result as enriched data
        const enrichedData = {
          brandTypeAnalysis: {
            type: analysis.brand_type,
            score: 85,
            confidence: 85,
            reasoning: `Analyzed using Claude AI`,
            signals: { globalIndicators: 0, nicheIndicators: 0 },
            breakdown: {},
          },
          competitors: analysis.competitors,
          industry: { primary: analysis.industry, secondary: [] },
          businessModel: 'Unknown',
          targetAudience: 'Unknown',
          valueProposition: 'Unknown',
          keywords: [],
        };

        await brandAnalysisRepository.updateEnrichedData(analysisId, enrichedData);
        await brandAnalysisRepository.updateStatus(analysisId, 'completed');

        // Save competitors
        if (analysis.competitors && analysis.competitors.length > 0) {
          await competitorRepository.saveCompetitors(
            analysisId,
            analysis.competitors.map((c, index) => ({
              competitor_name: c.name,
              competitor_url: undefined,
              similarity_score: c.similarityScore,
              ranking: index + 1,
              score_breakdown: {
                industry: 15,
                businessModel: 15,
                productOffering: 15,
                targetAudience: 10,
                geography: 10,
                marketSize: 10,
                priceRange: 10,
                digitalPresence: 5,
                brandMaturity: 5,
                keywords: 5,
              },
              evidence: c.evidence,
            }))
          );
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info(`Simple analysis completed and saved in ${processingTime}ms`);

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
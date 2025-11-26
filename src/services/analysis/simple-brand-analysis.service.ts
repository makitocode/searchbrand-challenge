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
  forceRefresh?: boolean;
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
  fromCache?: boolean;
}

export class SimpleBrandAnalysisService {
  /**
   * Main analysis method - using ONLY Claude WITH DB STORAGE
   */
  async analyze(request: SimpleAnalysisRequest): Promise<SimpleAnalysisResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Starting simple analysis for: ${request.brand}`);

      // Step 1: Check cache or delete existing record if forceRefresh
      const existingAnalysis = await brandAnalysisRepository.getRecentByBrandName(request.brand, 7);

      if (request.forceRefresh && existingAnalysis) {
        // Delete existing record before creating new one
        logger.info(`Force refresh: deleting existing analysis for ${request.brand}`);
        await brandAnalysisRepository.delete(existingAnalysis.id);
      } else if (existingAnalysis?.classification_result) {
        // Return cached result
        logger.info(`Found recent analysis for ${request.brand} in database`);
        const cached = existingAnalysis.classification_result as Record<string, any>;

        // Extract industry - handle both object and string formats
        let industry: string;
        if (cached.industry_simple) {
          // Use the simple string version if available (new format)
          industry = cached.industry_simple;
        } else if (typeof cached.industry === 'object' && cached.industry?.primary) {
          // Extract from object format
          industry = cached.industry.primary;
        } else if (typeof cached.industry === 'string') {
          // Direct string format (old format)
          industry = cached.industry;
        } else {
          // Fallback to the main table column
          industry = existingAnalysis.industry || 'unknown';
        }

        // Extract brand type
        const brandType = cached.brand_type ||
                         cached.brandTypeAnalysis?.type ||
                         existingAnalysis.analysis_type ||
                         'niche';

        return {
          status: 'completed',
          brand_name: cached.brand_name || existingAnalysis.brand_name || request.brand,
          brand_type: brandType as 'global' | 'niche',
          industry: industry,
          location: cached.location || null,
          competitors: cached.competitors || [],
          processing_time_ms: Date.now() - startTime,
          fromCache: true,
        };
      }

      // Step 2: Perform new analysis with Claude
      const analysis = await this.analyzeWithClaude(request.brand);

      // Normalize brand_name to lowercase for DB storage (UI will capitalize for display)
      const normalizedBrandName = analysis.brand_name.toLowerCase().trim();

      // Step 3: Save to database
      const analysisId = await brandAnalysisRepository.create({
        user_id: request.userId || null,
        input_brand: request.brand.toLowerCase().trim(),
        input_type: 'brand_name',
        brand_name: normalizedBrandName,
        brand_url: undefined,
        industry: analysis.industry,
        selected_category: analysis.industry,
        analysis_type: analysis.brand_type,
        input_analysis: {
          brandName: normalizedBrandName,
          inputType: 'brand_name',
          isAmbiguous: false,
          inferredIndustries: [analysis.industry],
          confidence: 85,
        },
      });

      // Update with classification result
      if (analysisId) {
        // Save as enriched data with the correct format expected by EnrichedBrandData type
        // The data also includes the simple string versions for easy retrieval
        const enrichedData = {
          // Store normalized (lowercase) values
          brand_name: normalizedBrandName,
          brand_type: analysis.brand_type,
          industry: { primary: analysis.industry, secondary: [] },  // Convert to expected format
          industry_simple: analysis.industry,  // Also store as simple string for easy access
          location: analysis.location || undefined,
          competitors: analysis.competitors,
          // Add required fields for EnrichedBrandData type
          businessModel: 'Unknown',
          targetAudience: 'Unknown',
          valueProposition: 'Unknown',
          keywords: [],
        };

        // This method updates the classification_result field in the database
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
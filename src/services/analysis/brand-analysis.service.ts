/**
 * Brand Analysis Service
 * Core business logic for analyzing brands (used by both CLI and API)
 */

import { inputAnalyzer } from '../llm/input-analyzer.js';
import { wikipediaService } from '../scraping/wikipedia.service.js';
import { brandTypeDetector } from './brand-type-detector.js';
import { brandClassifier } from '../llm/brand-classifier.js';
import { googleSearchService } from '../scraping/google-search.service.js';
import { websiteAnalyzerService } from '../scraping/website-analyzer.service.js';
import { competitorAnalyzer } from '../llm/competitor-analyzer.js';
import { brandAnalysisRepository } from '../database/repositories/brand-analysis.repository.js';
import { competitorRepository } from '../database/repositories/competitor.repository.js';
import { brandCacheRepository } from '../database/repositories/brand-cache.repository.js';
import { logger } from '../../utils/logger.js';
import {
  InputAnalysis,
  BrandClassificationData,
  BrandTypeAnalysis,
  CompetitorScore,
} from '../../types/index.js';

export interface AnalysisRequest {
  brand: string;
  category?: string; // Optional: user-selected category for disambiguation
  userId?: string; // Optional: for authenticated users
}

export interface AnalysisResponse {
  id?: string;
  status: 'ambiguous' | 'processing' | 'completed';
  brand_name?: string;
  categories?: string[]; // If ambiguous
  message?: string;

  // If completed
  analysis_type?: 'global' | 'niche';
  score?: number;
  confidence?: number;
  reasoning?: string;
  competitors?: Array<{
    name: string;
    similarityScore: number;
    evidence: string[];
  }>;
  processing_time_ms?: number;
  cached?: boolean;
}

export class BrandAnalysisService {
  /**
   * Analyze a brand (main entry point)
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = Date.now();

    // Step 1: Analyze input to extract brand name
    logger.info(`Analyzing brand input: ${request.brand}`);
    const analysis: InputAnalysis = await inputAnalyzer.analyzeInput(request.brand);

    // Step 2: Check for ambiguity
    if (analysis.isAmbiguous && analysis.suggestedCategories && !request.category) {
      logger.info(`Brand is ambiguous: ${analysis.brandName}`);
      return {
        status: 'ambiguous',
        brand_name: analysis.brandName,
        categories: analysis.suggestedCategories,
        message: 'Multiple categories detected. Please select one and resubmit with category parameter.',
      };
    }

    // Step 3: Check if we have a recent analysis for this brand
    const recentAnalysis = await brandAnalysisRepository.getRecentByBrandName(analysis.brandName, 7);

    if (recentAnalysis && recentAnalysis.classification_result) {
      logger.info(`Found recent analysis for ${analysis.brandName}`);

      const enrichedData = recentAnalysis.classification_result as any;
      const processingTime = Date.now() - startTime;

      return {
        id: recentAnalysis.id,
        status: 'completed',
        brand_name: analysis.brandName,
        analysis_type: recentAnalysis.analysis_type,
        score: enrichedData.brandTypeAnalysis?.score,
        confidence: enrichedData.brandTypeAnalysis?.confidence,
        reasoning: enrichedData.brandTypeAnalysis?.reasoning,
        competitors: enrichedData.competitors?.slice(0, 5).map((c: any) => ({
          name: c.name,
          similarityScore: c.similarityScore,
          evidence: c.evidence,
        })),
        processing_time_ms: processingTime,
        cached: true,
      };
    }

    // Step 4: Perform full analysis
    const selectedCategory = request.category || (analysis.inferredIndustries[0] || 'Unknown');
    const primaryIndustry = analysis.inferredIndustries[0] || 'Unknown';

    // Create analysis record
    const analysisId = await brandAnalysisRepository.create({
      user_id: request.userId || null,
      input_brand: request.brand,
      input_type: analysis.inputType,
      brand_name: analysis.brandName,
      brand_url: analysis.brandUrl,
      industry: primaryIndustry,
      selected_category: selectedCategory,
      analysis_type: 'niche', // Will be updated after classification
      input_analysis: analysis,
    });

    try {
      // Check brand classification cache
      const cachedClassification = await brandCacheRepository.get(analysis.brandName);

      let brandTypeAnalysis: BrandTypeAnalysis;
      let classificationData: BrandClassificationData;

      if (cachedClassification) {
        logger.info(`Brand cache HIT: ${analysis.brandName}`);

        brandTypeAnalysis = {
          type: cachedClassification.classification_data.brandType,
          score: cachedClassification.classification_data.score,
          confidence: cachedClassification.classification_data.confidence,
          reasoning: cachedClassification.classification_data.reasoning,
          breakdown: cachedClassification.classification_data.breakdown,
          signals: { globalIndicators: 0, nicheIndicators: 0 },
        };
        classificationData = cachedClassification.classification_data.sources;
      } else {
        // Collect data from all sources
        const dataResults = await Promise.allSettled([
          wikipediaService.searchBrand(analysis.brandName),
          brandClassifier.classifyBrand(analysis.brandName),
          googleSearchService.searchBrand(analysis.brandName),
          websiteAnalyzerService.analyzeWebsite(analysis.brandUrl, analysis.brandName),
        ]);

        const wikipediaData =
          dataResults[0].status === 'fulfilled' ? dataResults[0].value : { exists: false };
        const llmKnowledge =
          dataResults[1].status === 'fulfilled'
            ? dataResults[1].value
            : {
                knows_brand: false,
                classification: 'unknown' as const,
                confidence: 0,
                known_countries: [],
                continental_presence: [],
                primary_country: null,
                reasoning: 'LLM classification failed',
              };
        const serpApiData =
          dataResults[2].status === 'fulfilled'
            ? dataResults[2].value
            : { languages_detected: [], international_media: false, domains: [] };
        const websiteData = dataResults[3].status === 'fulfilled' ? dataResults[3].value : undefined;

        classificationData = {
          wikipedia: wikipediaData,
          llmDirect: llmKnowledge,
          googleSearch: serpApiData,
          googleTrends: undefined,
          officialWebsite: websiteData,
        };

        brandTypeAnalysis = await brandTypeDetector.detectBrandType(
          analysis.brandName,
          classificationData,
          analysis,
          analysis.brandUrl
        );
      }

      // Update analysis type
      if (analysisId) {
        await brandAnalysisRepository.updateStatus(analysisId, 'processing');
      }

      // Find competitors
      const location = analysis.brandUrl
        ? undefined
        : selectedCategory?.includes('Santiago')
          ? 'Santiago, Chile'
          : selectedCategory?.includes('Bogotá') || selectedCategory?.includes('Colombia')
            ? 'Bogotá, Colombia'
            : undefined;

      const competitors = await googleSearchService.searchCompetitors(
        analysis.brandName,
        primaryIndustry,
        brandTypeAnalysis.type,
        location,
        classificationData
      );

      // Analyze competitors with Claude
      let competitorScores: CompetitorScore[] = [];

      if (competitors.length > 0) {
        competitorScores = await competitorAnalyzer.analyzeCompetitors(
          {
            name: analysis.brandName,
            url: analysis.brandUrl,
            industry: primaryIndustry,
            brandType: brandTypeAnalysis.type,
          },
          competitors
        );
      }

      // Save enriched data
      const enrichedData: any = {
        brandTypeAnalysis,
        competitors: competitorScores,
      };

      if (analysisId) {
        await brandAnalysisRepository.updateEnrichedData(analysisId, enrichedData);
        await brandAnalysisRepository.updateStatus(analysisId, 'completed');

        // Save competitors
        if (competitorScores.length > 0) {
          await competitorRepository.saveCompetitors(
            analysisId,
            competitorScores.map((c, index) => ({
              competitor_name: c.name,
              competitor_url: c.url,
              similarity_score: c.similarityScore,
              ranking: index + 1,
              score_breakdown: c.breakdown,
              evidence: c.evidence,
            }))
          );
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        id: analysisId || undefined,
        status: 'completed',
        brand_name: analysis.brandName,
        analysis_type: brandTypeAnalysis.type,
        score: brandTypeAnalysis.score,
        confidence: brandTypeAnalysis.confidence,
        reasoning: brandTypeAnalysis.reasoning,
        competitors: competitorScores.slice(0, 5).map(c => ({
          name: c.name,
          similarityScore: c.similarityScore,
          evidence: c.evidence,
        })),
        processing_time_ms: processingTime,
        cached: false,
      };
    } catch (error) {
      logger.error('Analysis failed:', error);

      if (analysisId) {
        await brandAnalysisRepository.updateStatus(
          analysisId,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      throw error;
    }
  }
}

// Export singleton instance
export const brandAnalysisService = new BrandAnalysisService();

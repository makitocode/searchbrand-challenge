/**
 * Brand Type Detector (Multi-Source)
 * Determines if a brand is Global or Niche using 5 data sources
 */

import {
  BrandClassificationData,
  BrandTypeAnalysis,
  InputAnalysis,
  LLMBrandKnowledge,
} from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { callClaude } from '../llm/clients/claude-client.js';

export class BrandTypeDetector {
  /**
   * Detect brand type using multi-source approach
   */
  async detectBrandType(
    brandName: string,
    data: BrandClassificationData,
    _claudeAnalysis?: InputAnalysis
  ): Promise<BrandTypeAnalysis> {
    logger.info(`Detecting brand type for: ${brandName} (multi-source)`);

    // Calculate scores from each source
    const wikipediaScore = this.scoreWikipedia(data.wikipedia);
    const llmScore = this.scoreLLMDirect(data.llmDirect);
    const searchScore = this.scoreGoogleSearch(data.googleSearch);
    const trendsScore = this.scoreGoogleTrends(data.googleTrends);
    const websiteScore = this.scoreWebsite(data.officialWebsite);

    const totalScore = wikipediaScore + llmScore + searchScore + trendsScore + websiteScore;

    logger.info(`Score breakdown: Wikipedia=${wikipediaScore}, LLM=${llmScore}, Search=${searchScore}, Trends=${trendsScore}, Website=${websiteScore}, Total=${totalScore}`);

    // Base classification
    let classification: 'global' | 'niche' = totalScore >= 50 ? 'global' : 'niche';

    // For ambiguous cases (45-55), let LLM decide
    if (totalScore >= 45 && totalScore <= 55 && data.llmDirect) {
      logger.info('Ambiguous score (45-55), using LLM as tie-breaker');
      classification = data.llmDirect.classification === 'global' ? 'global' : 'niche';
    }

    // Generate reasoning with LLM
    const reasoning = await this.generateReasoning(brandName, data, classification, totalScore);

    // Calculate confidence based on data availability and consistency
    const confidence = this.calculateConfidence(data, totalScore);

    // Count global vs niche indicators
    const globalIndicators = this.countGlobalIndicators(data);
    const nicheIndicators = this.countNicheIndicators(data);

    return {
      type: classification,
      score: totalScore,
      confidence,
      reasoning,
      breakdown: {
        wikipedia: wikipediaScore,
        llm_direct: llmScore,
        google_search: searchScore,
        google_trends: trendsScore,
        official_website: websiteScore,
      },
      signals: {
        globalIndicators,
        nicheIndicators,
      },
    };
  }

  /**
   * Score Wikipedia data (0-25 points)
   */
  private scoreWikipedia(wikipedia?: BrandClassificationData['wikipedia']): number {
    if (!wikipedia || !wikipedia.exists) {
      return 0;
    }

    let score = 0;

    // TODO: Check number of languages (requires API call to get langlinks)
    // For now, we use existence and categories as proxy

    // Exists in Wikipedia: +8 points (conservative)
    score += 8;

    // Check categories for global indicators
    const globalCategoryKeywords = [
      'multinational',
      'international',
      'global',
      'fortune',
      'publicly traded',
      'nasdaq',
      'nyse',
      'stock exchange',
    ];

    const categories = wikipedia.categories || [];
    let hasGlobalCategory = false;

    for (const category of categories) {
      const categoryLower = category.toLowerCase();
      if (globalCategoryKeywords.some(keyword => categoryLower.includes(keyword))) {
        hasGlobalCategory = true;
        break;
      }
    }

    if (hasGlobalCategory) {
      score += 17; // Total 25 points if global categories found
    }

    logger.debug(`Wikipedia score: ${score}/25`);
    return Math.min(score, 25);
  }

  /**
   * Score LLM direct knowledge (0-25 points)
   */
  private scoreLLMDirect(llmDirect?: LLMBrandKnowledge): number {
    if (!llmDirect) {
      return 0;
    }

    let score = 0;

    // Signal 1: LLM knows brand with high confidence (15 points)
    if (llmDirect.knows_brand && llmDirect.confidence > 70) {
      score += 15;
    }

    // Signal 2: Presence in 3+ continents (10 points)
    if (llmDirect.continental_presence.length >= 3) {
      score += 10;
    }

    logger.debug(`LLM Direct score: ${score}/25`);
    return Math.min(score, 25);
  }

  /**
   * Score Google Search data (0-20 points)
   */
  private scoreGoogleSearch(googleSearch?: BrandClassificationData['googleSearch']): number {
    if (!googleSearch) {
      return 0;
    }

    let score = 0;

    // Signal 1: Results in 3+ languages (12 points)
    if (googleSearch.languages_detected.length >= 3) {
      score += 12;
    }

    // Signal 2: International media present (8 points)
    if (googleSearch.international_media) {
      score += 8;
    }

    logger.debug(`Google Search score: ${score}/20`);
    return Math.min(score, 20);
  }

  /**
   * Score Google Trends data (0-20 points)
   */
  private scoreGoogleTrends(googleTrends?: BrandClassificationData['googleTrends']): number {
    if (!googleTrends) {
      return 0;
    }

    let score = 0;

    // Signal 1: Interest in 3+ continents (15 points)
    if (googleTrends.continents.length >= 3) {
      score += 15;
    }

    // Signal 2: Top 10 includes multiple regions (5 points)
    // Distributed presence (not concentrated in one country)
    if (googleTrends.top_country_concentration < 70) {
      score += 5;
    }

    logger.debug(`Google Trends score: ${score}/20`);
    return Math.min(score, 20);
  }

  /**
   * Score official website data (0-15 points)
   */
  private scoreWebsite(website?: BrandClassificationData['officialWebsite']): number {
    if (!website) {
      return 0;
    }

    let score = 0;

    // Signal 1: 3+ languages available (10 points)
    if (website.languages_available >= 3) {
      score += 10;
    }

    // Signal 2: Has country selector (5 points)
    if (website.has_country_selector) {
      score += 5;
    }

    logger.debug(`Website score: ${score}/15`);
    return Math.min(score, 15);
  }

  /**
   * Generate reasoning using LLM
   */
  private async generateReasoning(
    brandName: string,
    data: BrandClassificationData,
    classification: 'global' | 'niche',
    score: number
  ): Promise<string> {
    const systemPrompt = 'You are a brand analysis expert. Generate a brief, clear justification for brand classification based on evidence.';

    const evidenceSummary = this.buildEvidenceSummary(data);

    const prompt = `Brand: ${brandName}
Classification: ${classification.toUpperCase()}
Score: ${score}/100

Evidence:
${evidenceSummary}

Generate a 1-2 sentence justification explaining why this brand is classified as ${classification.toUpperCase()}.
Focus on the strongest evidence. Be concise and factual.`;

    try {
      const response = await callClaude(prompt, systemPrompt);
      return response.trim();
    } catch (error) {
      logger.error('Failed to generate reasoning:', error);
      // Fallback reasoning
      return classification === 'global'
        ? `Marca clasificada como GLOBAL con score de ${score}/100 basado en evidencia de múltiples fuentes.`
        : `Marca clasificada como NICHO con score de ${score}/100. Evidencia insuficiente de presencia global.`;
    }
  }

  /**
   * Build evidence summary for LLM
   */
  private buildEvidenceSummary(data: BrandClassificationData): string {
    const evidence: string[] = [];

    if (data.wikipedia?.exists) {
      evidence.push(`- Wikipedia: Existe (${data.wikipedia.categories?.length || 0} categorías)`);
    } else {
      evidence.push('- Wikipedia: No encontrada');
    }

    if (data.llmDirect) {
      evidence.push(
        `- LLM: ${data.llmDirect.knows_brand ? 'Conoce la marca' : 'No conoce la marca'} (${data.llmDirect.confidence}% confianza, ${data.llmDirect.continental_presence.length} continentes)`
      );
    }

    if (data.googleSearch) {
      evidence.push(
        `- Google Search: ${data.googleSearch.languages_detected.length} idiomas, ${data.googleSearch.international_media ? 'medios internacionales' : 'sin medios internacionales'}`
      );
    }

    if (data.googleTrends) {
      evidence.push(
        `- Google Trends: ${data.googleTrends.continents.length} continentes, ${data.googleTrends.top_country_concentration}% concentración`
      );
    }

    if (data.officialWebsite) {
      evidence.push(
        `- Sitio Web: ${data.officialWebsite.languages_available} idiomas, ${data.officialWebsite.has_country_selector ? 'con' : 'sin'} selector de país`
      );
    }

    return evidence.join('\n');
  }

  /**
   * Calculate confidence based on data availability and score
   */
  private calculateConfidence(data: BrandClassificationData, score: number): number {
    // Base confidence on how many sources we have
    const sourcesAvailable = [
      data.wikipedia?.exists,
      data.llmDirect !== undefined,
      data.googleSearch !== undefined,
      data.googleTrends !== undefined,
      data.officialWebsite !== undefined,
    ].filter(Boolean).length;

    // More sources = higher confidence
    const sourceConfidence = (sourcesAvailable / 5) * 100;

    // Score confidence (extreme scores = higher confidence)
    let scoreConfidence = 50;
    if (score >= 70 || score <= 30) {
      scoreConfidence = 90;
    } else if (score >= 60 || score <= 40) {
      scoreConfidence = 70;
    }

    // Average of both
    const confidence = Math.round((sourceConfidence + scoreConfidence) / 2);

    logger.debug(`Confidence: ${confidence}% (sources: ${sourcesAvailable}/5, score: ${score})`);
    return Math.min(confidence, 95);
  }

  /**
   * Count global indicators across all sources
   */
  private countGlobalIndicators(data: BrandClassificationData): number {
    let count = 0;

    if (data.wikipedia?.exists) count++;
    if (data.llmDirect?.knows_brand && data.llmDirect.confidence > 70) count++;
    if (data.googleSearch?.languages_detected && data.googleSearch.languages_detected.length >= 3) count++;
    if (data.googleTrends?.continents && data.googleTrends.continents.length >= 3) count++;
    if (data.officialWebsite?.languages_available && data.officialWebsite.languages_available >= 3) count++;

    return count;
  }

  /**
   * Count niche indicators across all sources
   */
  private countNicheIndicators(data: BrandClassificationData): number {
    let count = 0;

    if (!data.wikipedia?.exists) count++;
    if (data.llmDirect && (!data.llmDirect.knows_brand || data.llmDirect.classification === 'local')) count++;
    if (data.googleSearch?.languages_detected && data.googleSearch.languages_detected.length <= 1) count++;
    if (data.googleTrends?.continents && data.googleTrends.continents.length <= 1) count++;
    if (data.officialWebsite?.languages_available && data.officialWebsite.languages_available <= 1) count++;

    return count;
  }

  /**
   * Get a human-readable explanation of the brand type
   */
  getTypeExplanation(analysis: BrandTypeAnalysis): string {
    return analysis.reasoning;
  }
}

// Export singleton instance
export const brandTypeDetector = new BrandTypeDetector();

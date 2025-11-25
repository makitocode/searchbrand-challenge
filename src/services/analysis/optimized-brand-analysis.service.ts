/**
 * Optimized Brand Analysis Service
 * Simplified version with minimal API calls for better performance
 */

import { logger } from '../../utils/logger.js';
import { getJson } from 'serpapi';
import { callClaude } from '../llm/clients/claude-client.js';

export interface OptimizedAnalysisRequest {
  brand: string;
  userId?: string;
}

export interface OptimizedAnalysisResponse {
  status: 'completed' | 'error';
  brand_name: string;
  brand_type: 'global' | 'niche';
  industry: string;
  location?: string;
  confidence: number;
  competitors: Array<{
    name: string;
    similarityScore: number;
    evidence: string[];
  }>;
  processing_time_ms: number;
}

export class OptimizedBrandAnalysisService {
  private serpApiKey: string;

  constructor() {
    this.serpApiKey = process.env.SERP_API_KEY || '';
    if (!this.serpApiKey) {
      logger.error('SERP_API_KEY not configured');
    } else {
      logger.debug(`SERP_API_KEY configured: ${this.serpApiKey.substring(0, 8)}...`);
    }
  }

  /**
   * Main analysis method - drastically simplified
   */
  async analyze(request: OptimizedAnalysisRequest): Promise<OptimizedAnalysisResponse> {
    const startTime = Date.now();

    try {
      logger.info(`Starting optimized analysis for: ${request.brand}`);

      // Step 1: Single SerpAPI call to understand the brand
      const brandData = await this.searchBrand(request.brand);

      // Step 2: Single Claude call to analyze everything at once
      const analysis = await this.analyzeWithClaude(request.brand, brandData);

      // Step 3: Single SerpAPI call to find competitors (targeted query)
      const competitors = await this.findCompetitors(
        analysis.brand_name,
        analysis.industry,
        analysis.brand_type,
        analysis.location
      );

      // Step 4: Quick Claude scoring of competitors (if needed)
      const scoredCompetitors = await this.scoreCompetitors(
        analysis.brand_name,
        analysis.industry,
        competitors
      );

      const processingTime = Date.now() - startTime;
      logger.info(`Analysis completed in ${processingTime}ms`);

      return {
        status: 'completed',
        brand_name: analysis.brand_name,
        brand_type: analysis.brand_type,
        industry: analysis.industry,
        location: analysis.location,
        confidence: analysis.confidence,
        competitors: scoredCompetitors.slice(0, 5),
        processing_time_ms: processingTime,
      };
    } catch (error) {
      logger.error('Optimized analysis failed:', error);
      return {
        status: 'error',
        brand_name: request.brand,
        brand_type: 'niche',
        industry: 'unknown',
        confidence: 0,
        competitors: [],
        processing_time_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Single SerpAPI call to get brand information
   */
  private async searchBrand(brand: string): Promise<any> {
    logger.info(`SerpAPI: Searching for "${brand}"`);

    try {
      const response = await getJson({
        engine: 'google',
        q: brand,
        api_key: this.serpApiKey,
        num: 10, // Reduced from 20
        gl: 'us',
        hl: 'en',
      });

      return {
        organic_results: response.organic_results || [],
        knowledge_graph: response.knowledge_graph,
        local_results: response.local_results || [],
        ai_overview: response.ai_overview,
      };
    } catch (error) {
      logger.error('SerpAPI search failed:', error instanceof Error ? error.message : String(error));
      return { organic_results: [], knowledge_graph: null, local_results: [] };
    }
  }

  /**
   * Single Claude call to analyze everything at once
   */
  private async analyzeWithClaude(brandInput: string, serpData: any): Promise<{
    brand_name: string;
    brand_type: 'global' | 'niche';
    industry: string;
    location?: string;
    confidence: number;
  }> {
    const prompt = `Analyze this brand and its search results. Extract ALL information in a SINGLE response.

Brand Input: "${brandInput}"

Search Results:
${JSON.stringify({
  knowledge_graph: serpData.knowledge_graph ? {
    title: serpData.knowledge_graph.title,
    type: serpData.knowledge_graph.type,
    description: serpData.knowledge_graph.description,
  } : null,
  local_results: serpData.local_results?.slice(0, 3),
  organic_results: serpData.organic_results?.slice(0, 5).map((r: any) => ({
    title: r.title,
    snippet: r.snippet,
    link: r.link,
  })),
  ai_overview: serpData.ai_overview?.snippet,
}, null, 2)}

Determine:
1. Exact brand name (cleaned)
2. Brand type: "global" (Nike, Spotify, etc.) or "niche" (local restaurant, boutique, etc.)
3. Industry/category
4. Location (if niche/local brand)
5. Confidence score (0-100)

Respond ONLY with JSON:
{
  "brand_name": "exact name",
  "brand_type": "global" or "niche",
  "industry": "category",
  "location": "city, country" or null,
  "confidence": 85
}`;

    try {
      const response = await callClaude(prompt, 'You are a brand analyst. Respond only with valid JSON.');
      const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (error) {
      logger.error('Claude analysis failed:', error);
      return {
        brand_name: brandInput,
        brand_type: 'niche',
        industry: 'unknown',
        confidence: 0,
      };
    }
  }

  /**
   * Single targeted SerpAPI call for competitors
   */
  private async findCompetitors(
    brandName: string,
    industry: string,
    brandType: 'global' | 'niche',
    location?: string
  ): Promise<Array<{ name: string; url?: string; description: string }>> {
    let query: string;
    let gl = 'us';
    let hl = 'en';

    if (brandType === 'global') {
      // For global brands, search for direct competitors
      query = `"${brandName}" competitors alternatives similar`;
    } else {
      // For niche brands, search in the category + location
      if (location?.toLowerCase().includes('colombia')) {
        gl = 'co';
        hl = 'es';
        query = `${industry} en ${location} mejores`;
      } else if (location?.toLowerCase().includes('chile')) {
        gl = 'cl';
        hl = 'es';
        query = `${industry} en ${location} mejores`;
      } else {
        query = `best ${industry} ${location || ''}`.trim();
      }
    }

    logger.info(`SerpAPI: Searching competitors with query: "${query}" (gl: ${gl}, hl: ${hl})`);

    try {
      const response = await getJson({
        engine: 'google',
        q: query,
        api_key: this.serpApiKey,
        num: 10,
        gl,
        hl,
      });

      const competitors: Array<{ name: string; url?: string; description: string }> = [];
      const seenNames = new Set<string>();

      // Extract from AI Overview (best source)
      if (response.ai_overview?.snippet) {
        const snippet = response.ai_overview.snippet;
        // Simple extraction of brand names from lists
        const lines = snippet.split('\n');
        for (const line of lines) {
          const match = line.match(/^\s*\d+\.\s*([^:,\-]+)/);
          if (match) {
            const name = match[1].trim();
            if (name && !seenNames.has(name.toLowerCase()) && name.toLowerCase() !== brandName.toLowerCase()) {
              seenNames.add(name.toLowerCase());
              competitors.push({
                name,
                description: 'Competitor from Google AI',
              });
            }
          }
        }
      }

      // Extract from organic results
      for (const result of (response.organic_results || []).slice(0, 5)) {
        if (competitors.length >= 10) break;

        const title = result.title || '';
        const url = result.link || '';

        // Skip aggregators and directories
        if (url.includes('tripadvisor') || url.includes('yelp') || url.includes('booking')) {
          continue;
        }

        // Extract brand name from title
        const titleMatch = title.match(/^([^-|•·]+)/);
        if (titleMatch) {
          const name = titleMatch[1].trim();
          if (
            name &&
            !seenNames.has(name.toLowerCase()) &&
            name.toLowerCase() !== brandName.toLowerCase() &&
            name.length < 50
          ) {
            seenNames.add(name.toLowerCase());
            competitors.push({
              name,
              url,
              description: result.snippet?.substring(0, 100) || '',
            });
          }
        }
      }

      logger.info(`Found ${competitors.length} potential competitors`);
      return competitors;
    } catch (error) {
      logger.error('Competitor search failed:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  /**
   * Quick scoring of competitors with Claude
   */
  private async scoreCompetitors(
    brandName: string,
    industry: string,
    competitors: Array<{ name: string; url?: string; description: string }>
  ): Promise<Array<{ name: string; similarityScore: number; evidence: string[] }>> {
    if (competitors.length === 0) {
      return [];
    }

    const prompt = `Score these potential competitors for "${brandName}" in the ${industry} industry.

Competitors:
${competitors.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n')}

For each competitor, provide:
1. Similarity score (0-100)
2. 1-2 evidence points

Respond ONLY with JSON:
{
  "competitors": [
    {
      "name": "exact name from list",
      "similarityScore": 85,
      "evidence": ["Same industry", "Similar target market"]
    }
  ]
}

Include ALL competitors, even with low scores. Filter out only if clearly not a competitor (score < 20).`;

    try {
      const response = await callClaude(prompt, 'You are a competitive analyst. Respond only with valid JSON.');
      const jsonStr = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(jsonStr);

      return result.competitors
        .filter((c: any) => c.similarityScore >= 30)
        .sort((a: any, b: any) => b.similarityScore - a.similarityScore);
    } catch (error) {
      logger.error('Competitor scoring failed:', error);
      // Return unsorted competitors as fallback
      return competitors.map(c => ({
        name: c.name,
        similarityScore: 50,
        evidence: ['Potential competitor in same category'],
      }));
    }
  }
}

// Export singleton instance
export const optimizedBrandAnalysisService = new OptimizedBrandAnalysisService();
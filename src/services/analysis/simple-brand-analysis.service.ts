/**
 * Simple Brand Analysis Service
 * Ultra-simplified version using ONLY Claude (no external APIs)
 * Perfect for technical test demo - WITH DATABASE STORAGE
 */

import { logger } from '../../utils/logger.js';
import { callClaude } from '../llm/clients/claude-client.js';
import { brandAnalysisRepository } from '../database/repositories/brand-analysis.repository.js';
import { competitorRepository } from '../database/repositories/competitor.repository.js';
import { looksLikeUrl, extractDomainInfo, normalizeUrl } from '../../utils/validators.js';
import { webMetadataService } from '../scraping/web-metadata.service.js';
import { googleSearchService } from '../scraping/google-search.service.js';

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
  brand_url?: string;
  competitors: Array<{
    name: string;
    similarityScore: number;
    evidence: string[];
  }>;
  processing_time_ms: number;
  fromCache?: boolean;
}

interface ParsedInput {
  isUrl: boolean;
  originalInput: string;
  normalizedUrl?: string;
  domain?: string;
  brandHint?: string;
  tld?: string;
}

interface WebsiteContext {
  title?: string;
  description?: string;
  keywords?: string[];
  fetchSuccess: boolean;
}

export class SimpleBrandAnalysisService {
  /**
   * Fetch website metadata for URL inputs
   * Returns context to help Claude understand what the website is about
   */
  private async fetchWebsiteContext(url: string): Promise<WebsiteContext> {
    try {
      logger.info(`Fetching website metadata from: ${url}`);
      const metadata = await webMetadataService.extractMetadata(url);

      const hasUsefulData = !!(metadata.title || metadata.description || (metadata.keywords && metadata.keywords.length > 0));

      if (hasUsefulData) {
        logger.info(`Website metadata fetch SUCCESS: title="${metadata.title}", keywords=${metadata.keywords?.length || 0}`);
      } else {
        logger.warn(`Website metadata fetch returned no useful data for: ${url}`);
      }

      return {
        title: metadata.title,
        description: metadata.description,
        keywords: metadata.keywords,
        fetchSuccess: hasUsefulData,
      };
    } catch (error) {
      logger.error(`Website metadata fetch FAILED for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
      return {
        fetchSuccess: false,
      };
    }
  }

  /**
   * Try to get official website URL via SerpAPI and update DB (fire-and-forget)
   * This runs asynchronously AFTER Claude analysis completes
   * Uses Claude's analysis context for smarter search queries
   */
  private async tryGetOfficialWebsiteAndUpdateDB(
    analysisId: string,
    brandName: string,
    context: {
      industry?: string;
      location?: string;
      brandType?: 'global' | 'niche';
    }
  ): Promise<void> {
    try {
      logger.info(`SerpAPI (async): Looking up official website for "${brandName}" with context: ${JSON.stringify(context)}`);
      const result = await googleSearchService.getOfficialWebsite(brandName, context);

      if (result) {
        logger.info(`SerpAPI SUCCESS: Found official website ${result.url} (confidence: ${result.confidence}, source: ${result.source})`);

        // Update the database with the found URL
        await brandAnalysisRepository.updateBrandUrl(analysisId, result.url);
        logger.info(`SerpAPI: Updated brand_url in DB for analysis ${analysisId}`);
      } else {
        logger.info(`SerpAPI: No official website found for "${brandName}"`);
      }
    } catch (error) {
      // This should NEVER break anything - it's fire-and-forget
      logger.warn(`SerpAPI (async) FAILED for "${brandName}":`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Parse and detect input type (URL vs brand name)
   */
  private parseInput(input: string): ParsedInput {
    const trimmed = input.trim();

    if (looksLikeUrl(trimmed)) {
      const domainInfo = extractDomainInfo(trimmed);
      if (domainInfo) {
        return {
          isUrl: true,
          originalInput: trimmed,
          normalizedUrl: normalizeUrl(trimmed),
          domain: domainInfo.domain,
          brandHint: domainInfo.brandHint,
          tld: domainInfo.tld,
        };
      }
    }

    return {
      isUrl: false,
      originalInput: trimmed,
    };
  }

  /**
   * Main analysis method - using ONLY Claude WITH DB STORAGE
   */
  async analyze(request: SimpleAnalysisRequest): Promise<SimpleAnalysisResponse> {
    const startTime = Date.now();

    try {
      // Parse input to detect if it's a URL
      const parsedInput = this.parseInput(request.brand);

      if (parsedInput.isUrl) {
        logger.info(`Detected URL input: ${parsedInput.domain} (brand hint: ${parsedInput.brandHint})`);
      } else {
        logger.info(`Starting simple analysis for brand: ${request.brand}`);
      }

      // Step 1: Check cache or delete existing record if forceRefresh
      // For URLs, search by domain to catch variations (bendita.cl, www.bendita.cl, etc.)
      const cacheKey = parsedInput.isUrl ? parsedInput.domain! : request.brand;
      const existingAnalysis = await brandAnalysisRepository.getRecentByBrandName(cacheKey, 7);

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
          brand_url: cached.brand_url || existingAnalysis.brand_url || undefined,
          competitors: cached.competitors || [],
          processing_time_ms: Date.now() - startTime,
          fromCache: true,
        };
      }

      // Step 2: For URLs, fetch website metadata to provide context to Claude
      let websiteContext: WebsiteContext | undefined;
      if (parsedInput.isUrl && parsedInput.normalizedUrl) {
        websiteContext = await this.fetchWebsiteContext(parsedInput.normalizedUrl);
      }

      // Step 3: Perform analysis with Claude (always first - user gets fast response)
      const analysis = await this.analyzeWithClaude(request.brand, parsedInput, websiteContext);

      // Normalize brand_name to lowercase for DB storage (UI will capitalize for display)
      const normalizedBrandName = analysis.brand_name.toLowerCase().trim();

      // Determine the brand URL to store (user-provided URL only for now)
      // For brand name inputs, SerpAPI will update this asynchronously after DB save
      const brandUrl = parsedInput.isUrl ? parsedInput.normalizedUrl : undefined;

      // Step 3: Save to database
      const analysisId = await brandAnalysisRepository.create({
        user_id: request.userId || null,
        input_brand: request.brand.toLowerCase().trim(),
        input_type: parsedInput.isUrl ? 'url' : 'brand_name',
        brand_name: normalizedBrandName,
        brand_url: brandUrl,
        industry: analysis.industry,
        selected_category: analysis.industry,
        analysis_type: analysis.brand_type,
        input_analysis: {
          brandName: normalizedBrandName,
          inputType: parsedInput.isUrl ? 'url' : 'brand_name',
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
          brand_url: brandUrl,
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

        // Step 4: For brand name inputs (not URLs), trigger async SerpAPI lookup
        // This runs in background - user doesn't wait for it
        if (!parsedInput.isUrl) {
          // Fire-and-forget: don't await, just trigger the async update
          this.tryGetOfficialWebsiteAndUpdateDB(analysisId, analysis.brand_name, {
            industry: analysis.industry,
            location: analysis.location || undefined,
            brandType: analysis.brand_type,
          }).catch(err => {
            // Log but don't throw - this is truly fire-and-forget
            logger.debug('Async SerpAPI lookup error (non-blocking):', err);
          });
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info(`Simple analysis completed and saved in ${processingTime}ms`);

      return {
        status: 'completed',
        ...analysis,
        brand_url: brandUrl,
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
   * Build the appropriate prompt based on input type
   */
  private buildPrompt(brandInput: string, parsedInput: ParsedInput, websiteContext?: WebsiteContext): string {
    if (parsedInput.isUrl) {
      // Build website context section if we have real data from the website
      let websiteDataSection = '';
      if (websiteContext?.fetchSuccess) {
        websiteDataSection = `
REAL DATA FROM THE WEBSITE (USE THIS AS PRIMARY SOURCE):
- Website Title: "${websiteContext.title || 'N/A'}"
- Website Description: "${websiteContext.description || 'N/A'}"
- Keywords found: ${websiteContext.keywords?.slice(0, 10).join(', ') || 'N/A'}

THIS IS THE ACTUAL DATA FROM THE WEBSITE. Use it to determine the real industry and business type.
`;
      }

      // URL-specific prompt - emphasizes the website as the primary reference
      return `Analyze the brand with website "${parsedInput.domain}" and provide comprehensive competitive intelligence.

CRITICAL CONTEXT:
- The user provided the URL/domain: ${parsedInput.domain}
- This is the OFFICIAL website of the brand we're analyzing
- The brand name is likely "${parsedInput.brandHint}" but verify based on the domain
- Country hint from TLD: .${parsedInput.tld} (e.g., .cl = Chile, .co = Colombia, .com = International)
${websiteDataSection}
Your task:
1. Identify the exact brand name from this website/domain
2. Classify as "global" (Nike, Spotify, Coca-Cola) or "niche" (local restaurant, boutique shop)
3. Identify the industry/category based on what this website offers
4. If niche, identify the location (use TLD hint: .${parsedInput.tld})
5. List 3-5 direct competitors with similarity scores

IMPORTANT - DISAMBIGUATION:
- There may be multiple brands with similar names (e.g., "bendita.cl" vs "bendita.co" are DIFFERENT brands)
- Focus ONLY on the brand at ${parsedInput.domain}
- Find competitors that compete with THIS specific brand in THIS specific market
- USE THE WEBSITE DATA ABOVE to determine the correct industry (don't guess based on the name alone)

Respond ONLY with valid JSON in this exact format:
{
  "brand_name": "exact brand name from the website",
  "brand_type": "global" or "niche",
  "industry": "specific category (e.g., 'Beauty & Skincare' not just 'Retail')",
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
- bendita.cl (Chilean beauty brand) → competitors: The Body Shop Chile, L'Occitane Chile, local Chilean beauty brands
- bendita.co (Colombian fashion brand) → competitors: Colombian fashion retailers, Zara Colombia, local boutiques
- nike.com → competitors: Adidas, Puma, Under Armour, New Balance`;
    }

    // Standard brand name prompt
    return `Analyze the brand "${brandInput}" and provide comprehensive competitive intelligence.

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
  }

  /**
   * Single Claude call to analyze everything
   */
  private async analyzeWithClaude(brandInput: string, parsedInput: ParsedInput, websiteContext?: WebsiteContext): Promise<Omit<SimpleAnalysisResponse, 'status' | 'processing_time_ms'>> {
    const prompt = this.buildPrompt(brandInput, parsedInput, websiteContext);

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
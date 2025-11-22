/**
 * Google Trends Service
 * Analyzes geographic interest distribution using LLM inference
 * Direct Google Trends scraping is blocked, so we use LLM knowledge
 */

import { TrendsData, LLMBrandKnowledge } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { callClaude } from '../llm/clients/claude-client.js';

export class GoogleTrendsService {
  // Map countries to continents
  private readonly countryToContinentMap: Record<string, string> = {
    // North America
    US: 'North America',
    CA: 'North America',
    MX: 'North America',
    // South America
    BR: 'South America',
    AR: 'South America',
    CL: 'South America',
    CO: 'South America',
    PE: 'South America',
    VE: 'South America',
    // Europe
    GB: 'Europe',
    DE: 'Europe',
    FR: 'Europe',
    ES: 'Europe',
    IT: 'Europe',
    NL: 'Europe',
    SE: 'Europe',
    NO: 'Europe',
    DK: 'Europe',
    FI: 'Europe',
    PL: 'Europe',
    RU: 'Europe',
    // Asia
    CN: 'Asia',
    JP: 'Asia',
    IN: 'Asia',
    KR: 'Asia',
    ID: 'Asia',
    TH: 'Asia',
    SG: 'Asia',
    MY: 'Asia',
    PH: 'Asia',
    VN: 'Asia',
    // Africa
    ZA: 'Africa',
    NG: 'Africa',
    EG: 'Africa',
    KE: 'Africa',
    // Oceania
    AU: 'Oceania',
    NZ: 'Oceania',
  };

  /**
   * Get geographic interest distribution for a brand
   * Uses LLM to infer geographic distribution based on brand knowledge
   */
  async analyzeTrends(
    brandName: string,
    llmKnowledge?: LLMBrandKnowledge
  ): Promise<TrendsData> {
    logger.info(`Google Trends analysis for: ${brandName}`);

    try {
      // If we already have LLM knowledge, use it to infer trends
      if (llmKnowledge && llmKnowledge.knows_brand) {
        return this.inferFromLLMKnowledge(llmKnowledge);
      }

      // Otherwise, ask LLM about geographic distribution
      const systemPrompt =
        'Eres un analista de mercados geográficos. Analiza la distribución geográfica de marcas basándote en tu conocimiento.';

      const prompt = `Analiza la distribución geográfica de interés para "${brandName}".

Responde en formato JSON:
{
  "top_countries": ["US", "UK", "BR", "DE", ...],
  "continents": ["North America", "Europe", "Asia", ...],
  "top_country_concentration": 0-100
}

Guías:
- top_countries: Top 10 países por interés de búsqueda (códigos ISO de 2 letras)
- continents: Continentes donde la marca tiene presencia significativa
- top_country_concentration: Porcentaje de interés concentrado en el país principal (0-100)
  - Marcas globales: 10-30%
  - Marcas regionales: 40-60%
  - Marcas locales: 70-100%

Si no conoces la marca, retorna arrays vacíos y 100.`;

      const response = await callClaude(prompt, systemPrompt);

      // Extract JSON from response
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replaceAll(/```\n?/g, '');
      }

      const result: TrendsData = JSON.parse(jsonStr);

      logger.debug(
        `Google Trends result: ${result.continents.length} continents, top concentration: ${result.top_country_concentration}%`
      );

      return result;
    } catch (error) {
      logger.error(
        'Google Trends failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Return empty data on failure
      return {
        top_countries: [],
        continents: [],
        top_country_concentration: 100, // Assume concentrated if no data
      };
    }
  }

  /**
   * Infer trends from existing LLM knowledge
   */
  private inferFromLLMKnowledge(llmKnowledge: LLMBrandKnowledge): TrendsData {
    const topCountries = llmKnowledge.known_countries.slice(0, 10);

    // Calculate continents from countries
    const continents = new Set<string>();
    for (const country of topCountries) {
      const continent = this.countryToContinentMap[country.toUpperCase()];
      if (continent) {
        continents.add(continent);
      }
    }

    // Infer concentration based on classification
    let concentration = 100;
    if (llmKnowledge.classification === 'global') {
      // Global brands have distributed interest
      concentration = llmKnowledge.continental_presence.length >= 5 ? 15 : 25;
    } else if (llmKnowledge.classification === 'local') {
      // Local brands are highly concentrated
      concentration = 85;
    } else {
      // Unknown - assume local
      concentration = 100;
    }

    return {
      top_countries: topCountries,
      continents: Array.from(continents),
      top_country_concentration: concentration,
    };
  }

  /**
   * Calculate score based on Google Trends data
   * Returns 0-20 points according to strategy
   */
  calculateScore(trendsData: TrendsData): number {
    let score = 0;

    // Signal 1: Interest in 3+ continents (15 points)
    if (trendsData.continents.length >= 3) {
      score += 15;
    }

    // Signal 2: Distributed presence - top country < 70% (5 points)
    if (trendsData.top_country_concentration < 70) {
      score += 5;
    }

    logger.debug(`Google Trends score: ${score}/20 points`);
    return score;
  }
}

// Export singleton instance
export const googleTrendsService = new GoogleTrendsService();

/**
 * Brand Classifier Service
 * Uses LLM direct knowledge to classify brands as global or local
 */

import { LLMBrandKnowledge } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { callClaude } from './clients/claude-client.js';

export class BrandClassifier {
  /**
   * Ask the LLM directly if it knows the brand
   * This leverages the LLM's pre-trained knowledge
   */
  async classifyBrand(brandName: string): Promise<LLMBrandKnowledge> {
    const systemPrompt = `You are a brand classification expert. Your task is to determine if a brand is globally known based on your knowledge.

Be HONEST about what you know:
- If you clearly know the brand and it operates globally → classification: "global"
- If you know it's a local/regional brand → classification: "local"
- If you're uncertain or don't know → classification: "unknown"

For GLOBAL brands, you should know:
- They operate in 10+ countries
- Presence in 3+ continents
- International recognition

Respond ONLY with valid JSON, no markdown.`;

    const prompt = `Do you know the brand "${brandName}"?

Respond in JSON format:
{
  "knows_brand": true/false,
  "classification": "global" | "local" | "unknown",
  "confidence": 0-100,
  "known_countries": ["country1", "country2", ...],
  "continental_presence": ["continent1", "continent2", ...],
  "reasoning": "brief explanation"
}

Examples:
- Spotify: knows_brand=true, classification="global", confidence=95, known_countries=["US","UK","BR","MX","DE",...], continental_presence=["North America","South America","Europe","Asia","Africa","Oceania"]
- Herbívoro (Colombian restaurant): knows_brand=false, classification="unknown", confidence=20
- Atlético Nacional (Colombian soccer team): knows_brand=true, classification="local", confidence=80, known_countries=["Colombia"], continental_presence=["South America"]`;

    try {
      logger.info(`LLM Direct classification for: ${brandName}`);

      const response = await callClaude(prompt, systemPrompt);

      // Extract JSON from response
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replaceAll(/```\n?/g, '');
      }

      const classification: LLMBrandKnowledge = JSON.parse(jsonStr);

      logger.debug(`LLM classification result: ${classification.classification} (confidence: ${classification.confidence}%)`);

      return classification;
    } catch (error) {
      logger.error('LLM brand classification failed:', error instanceof Error ? error.message : 'Unknown error');

      // Return unknown classification on error
      return {
        knows_brand: false,
        classification: 'unknown',
        confidence: 0,
        known_countries: [],
        continental_presence: [],
        reasoning: 'Classification failed due to LLM error'
      };
    }
  }

  /**
   * Calculate score based on LLM knowledge
   * Returns 0-25 points according to strategy
   */
  calculateScore(knowledge: LLMBrandKnowledge): number {
    let score = 0;

    // Signal 1: LLM knows brand with high confidence (15 points)
    if (knowledge.knows_brand && knowledge.confidence > 70) {
      score += 15;
    }

    // Signal 2: Presence in 3+ continents (10 points)
    if (knowledge.continental_presence.length >= 3) {
      score += 10;
    }

    logger.debug(`LLM score: ${score}/25 points`);
    return score;
  }
}

// Export singleton instance
export const brandClassifier = new BrandClassifier();

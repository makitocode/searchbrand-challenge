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
    const systemPrompt = `Eres un experto en clasificación de marcas. Tu tarea es determinar si una marca es conocida globalmente basándote en tu conocimiento.

Sé HONESTO sobre lo que sabes:
- Si conoces claramente la marca y opera globalmente → classification: "global"
- Si sabes que es una marca local/regional → classification: "local"
- Si no estás seguro o no la conoces → classification: "unknown"

Para marcas GLOBALES, deberías saber:
- Operan en 10+ países
- Presencia en 3+ continentes
- Reconocimiento internacional

Responde SOLO con JSON válido, sin markdown.`;

    const prompt = `¿Conoces la marca "${brandName}"?

Responde en formato JSON:
{
  "knows_brand": true/false,
  "classification": "global" | "local" | "unknown",
  "confidence": 0-100,
  "known_countries": ["país1", "país2", ...],
  "continental_presence": ["continente1", "continente2", ...],
  "primary_country": "país principal de operación (código ISO de 2 letras)" o null,
  "reasoning": "breve explicación"
}

Ejemplos:
- Spotify: knows_brand=true, classification="global", confidence=95, known_countries=["US","UK","BR","MX","DE",...], continental_presence=["North America","South America","Europe","Asia","Africa","Oceania"], primary_country="SE"
- Herbívoro (restaurante colombiano): knows_brand=false, classification="unknown", confidence=20, known_countries=[], continental_presence=[], primary_country=null
- Atlético Nacional (equipo de fútbol colombiano): knows_brand=true, classification="local", confidence=80, known_countries=["CO"], continental_presence=["South America"], primary_country="CO"
- Cafe Soca (café colombiano): knows_brand=true, classification="local", confidence=75, known_countries=["CO"], continental_presence=["South America"], primary_country="CO"`;

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
        primary_country: null,
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

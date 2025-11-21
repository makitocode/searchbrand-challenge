/**
 * Input Analyzer Service
 * Uses Claude to analyze and understand brand input from the user
 */

import { callClaude } from './clients/claude-client';
import { InputAnalysis } from '../../types';
import { logger } from '../../utils/logger';
import { isValidUrl } from '../../utils/validators';

export class InputAnalyzer {
  /**
   * Analyzes brand input using Claude to determine:
   * - Input type (brand name vs URL)
   * - Inferred industries
   * - Whether it's ambiguous
   * - Suggested categories if ambiguous
   */
  async analyzeInput(brandInput: string): Promise<InputAnalysis> {
    logger.info(`Analyzing input: "${brandInput}"`);

    // Detect if input is a URL
    const inputType = isValidUrl(brandInput) ? 'url' : 'brand_name';

    const systemPrompt = `You are an expert brand analyst. Your task is to analyze brand names or URLs and provide structured insights about them.`;

    const prompt = `
Analyze this brand input: "${brandInput}"

Determine:
1. What is the brand name? (extract from URL if needed)
2. What industry/industries does this brand likely operate in?
3. Is this input ambiguous? (Could it refer to multiple different types of businesses?)
4. If ambiguous, suggest 2-4 specific business categories to help disambiguate

Important context:
- The user wants to find competitors for this brand
- We need to understand exactly what type of business this is
- Be specific with industries (e.g., "Streaming Music Service" not just "Technology")
- Ambiguous means the brand name alone doesn't clearly indicate ONE specific business type

Respond in valid JSON format with this structure:
{
  "brandName": "extracted or cleaned brand name",
  "brandUrl": "URL if provided, otherwise null",
  "inferredIndustries": ["industry 1", "industry 2"],
  "isAmbiguous": true or false,
  "suggestedCategories": ["category 1", "category 2"] or null if not ambiguous,
  "confidence": 0-100 (how confident you are in this analysis),
  "reasoning": "brief explanation of your analysis"
}

Example for ambiguous input:
Input: "Herbívoro"
{
  "brandName": "Herbívoro",
  "brandUrl": null,
  "inferredIndustries": ["Gastronomía vegana", "Productos de consumo plant-based", "Restaurante"],
  "isAmbiguous": true,
  "suggestedCategories": ["Restaurante/Gastronomía", "Productos retail (alimentos)", "Cosmética natural/productos de cuidado"],
  "confidence": 65,
  "reasoning": "El nombre sugiere relación con comida vegana/plant-based, pero podría ser restaurante, marca de productos, o incluso cosmética. Necesita desambiguación."
}

Example for clear input:
Input: "Spotify"
{
  "brandName": "Spotify",
  "brandUrl": null,
  "inferredIndustries": ["Streaming musical", "Tecnología de entretenimiento", "Servicios digitales"],
  "isAmbiguous": false,
  "suggestedCategories": null,
  "confidence": 98,
  "reasoning": "Spotify es una marca globalmente reconocida de streaming musical. No hay ambigüedad."
}

Now analyze: "${brandInput}"
`;

    try {
      const response = await callClaude(prompt, systemPrompt);

      // Extract JSON from response (Claude might wrap it in markdown)
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replaceAll(/```\n?/g, '');
      }

      const analysis = JSON.parse(jsonStr);

      const result: InputAnalysis = {
        inputType,
        brandName: analysis.brandName,
        brandUrl: analysis.brandUrl || (inputType === 'url' ? brandInput : undefined),
        inferredIndustries: analysis.inferredIndustries,
        isAmbiguous: analysis.isAmbiguous,
        suggestedCategories: analysis.suggestedCategories,
        confidence: analysis.confidence,
      };

      logger.info(
        `Analysis complete: ${result.brandName} - Ambiguous: ${result.isAmbiguous} - Confidence: ${result.confidence}%`
      );

      return result;
    } catch (error) {
      logger.error('Failed to analyze input with Claude:', error);
      throw new Error(`Input analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const inputAnalyzer = new InputAnalyzer();

/**
 * Input Analyzer Service
 * Uses Claude to analyze and understand brand input from the user
 */

import { callClaude } from './clients/claude-client.js';
import { InputAnalysis } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { isValidUrl } from '../../utils/validators.js';

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

    const systemPrompt = `Eres un analista experto de marcas. Tu tarea es analizar nombres de marcas o URLs y proporcionar información estructurada sobre ellas.`;

    const prompt = `
Analiza esta marca: "${brandInput}"

Determina:
1. ¿Cuál es el nombre de la marca? (extráelo de la URL si es necesario)
2. ¿En qué industria(s) opera probablemente esta marca?
3. ¿Esta entrada es ambigua? (¿Podría referirse a múltiples tipos de negocios diferentes?)
4. Si es ambigua, sugiere 2-4 categorías específicas de negocio para ayudar a desambiguar

Contexto importante:
- El usuario quiere encontrar competidores para esta marca
- Necesitamos entender exactamente qué tipo de negocio es
- Sé específico con las industrias (ej., "Servicio de Streaming Musical" no solo "Tecnología")
- Ambiguo significa que el nombre de la marca solo no indica claramente UN tipo específico de negocio

Responde en formato JSON válido con esta estructura:
{
  "brandName": "nombre de marca extraído o limpio",
  "brandUrl": "URL si se proporcionó, de lo contrario null",
  "inferredIndustries": ["industria 1", "industria 2"],
  "isAmbiguous": true o false,
  "suggestedCategories": ["categoría 1", "categoría 2"] o null si no es ambiguo,
  "confidence": 0-100 (qué tan seguro estás de este análisis),
  "reasoning": "breve explicación de tu análisis"
}

Ejemplo para entrada ambigua:
Entrada: "Herbívoro"
{
  "brandName": "Herbívoro",
  "brandUrl": null,
  "inferredIndustries": ["Gastronomía vegana", "Productos de consumo plant-based", "Restaurante"],
  "isAmbiguous": true,
  "suggestedCategories": ["Restaurante/Gastronomía", "Productos retail (alimentos)", "Cosmética natural/productos de cuidado"],
  "confidence": 65,
  "reasoning": "El nombre sugiere relación con comida vegana/plant-based, pero podría ser restaurante, marca de productos, o incluso cosmética. Necesita desambiguación."
}

Ejemplo para entrada clara:
Entrada: "Spotify"
{
  "brandName": "Spotify",
  "brandUrl": null,
  "inferredIndustries": ["Streaming musical", "Tecnología de entretenimiento", "Servicios digitales"],
  "isAmbiguous": false,
  "suggestedCategories": null,
  "confidence": 98,
  "reasoning": "Spotify es una marca globalmente reconocida de streaming musical. No hay ambigüedad."
}

Ahora analiza: "${brandInput}"
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

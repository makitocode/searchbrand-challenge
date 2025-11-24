/**
 * Competitor Analyzer Service
 * Uses GPT-4 to analyze competitors and calculate similarity scores
 */

import { callClaude } from './clients/claude-client.js';
import { logger } from '../../utils/logger.js';
import { CompetitorScoreBreakdown, CompetitorScore, calculateTotalScore, validateBreakdown } from '../../core/scorer.js';

export interface BrandProfile {
  name: string;
  url?: string;
  industry: string;
  brandType: 'global' | 'niche';
  location?: string;
  description?: string;
}

export class CompetitorAnalyzer {
  /**
   * Analyze a list of competitors and calculate similarity scores
   */
  async analyzeCompetitors(
    brand: BrandProfile,
    competitors: Array<{ name: string; url?: string; description: string }>
  ): Promise<CompetitorScore[]> {
    if (competitors.length === 0) {
      return [];
    }

    logger.info(`Analyzing ${competitors.length} competitors for ${brand.name} with GPT-4`);

    const systemPrompt = `Eres un experto analista de inteligencia competitiva especializado en evaluar similitud entre marcas.

Tu tarea es analizar competidores y asignar puntuaciones en 10 criterios específicos.

CRITERIOS Y PUNTUACIONES MÁXIMAS:
1. Industry (15 pts): ¿Operan en la misma industria/sector?
2. Business Model (15 pts): ¿Modelo de negocio similar? (B2B, B2C, suscripción, freemium, etc.)
3. Product Offering (15 pts): ¿Ofrecen productos/servicios comparables?
4. Target Audience (10 pts): ¿Mismo público objetivo? (demografía, intereses, nivel socioeconómico)
5. Geography (10 pts): ¿Misma cobertura geográfica? (local, nacional, regional, global)
6. Market Size (10 pts): ¿Tamaño de mercado/empresa similar?
7. Price Range (10 pts): ¿Rango de precios comparable? (premium, medio, económico)
8. Digital Presence (5 pts): ¿Presencia digital similar? (web, redes sociales, e-commerce)
9. Brand Maturity (5 pts): ¿Madurez de marca similar? (startup, establecida, corporativa)
10. Keywords (5 pts): ¿Comparten palabras clave/términos SEO?

TOTAL: 100 puntos máximo

REGLAS CRÍTICAS:
- Asigna puntuaciones HONESTAS basadas en similitud real
- Un competidor directo perfecto = 95-100 puntos
- Un competidor cercano = 80-94 puntos
- Un competidor relacionado = 60-79 puntos
- Un competidor débil = 40-59 puntos
- No es competidor = <40 puntos
- Proporciona 2-4 evidencias específicas por competidor
- Sé preciso con los números, no redondees hacia arriba por defecto

Responde SOLO con JSON válido, sin markdown.`;

    const competitorList = competitors
      .map(
        (c, i) => `${i + 1}. ${c.name}
   URL: ${c.url || 'N/A'}
   Descripción: ${c.description}`
      )
      .join('\n\n');

    const prompt = `Analiza estos competidores para la marca "${brand.name}":

MARCA BASE:
Nombre: ${brand.name}
Tipo: ${brand.brandType === 'global' ? 'Global' : 'Local/Regional'}
Industria: ${brand.industry}
${brand.location ? `Ubicación: ${brand.location}` : ''}
${brand.description ? `Descripción: ${brand.description}` : ''}

COMPETIDORES A ANALIZAR:
${competitorList}

Para CADA competidor, evalúa los 10 criterios y proporciona:
1. Puntuación en cada criterio (respeta los máximos)
2. 2-4 evidencias específicas que justifiquen la similitud

Responde en formato JSON:
{
  "competitors": [
    {
      "name": "Nombre exacto del competidor",
      "breakdown": {
        "industry": 0-15,
        "businessModel": 0-15,
        "productOffering": 0-15,
        "targetAudience": 0-10,
        "geography": 0-10,
        "marketSize": 0-10,
        "priceRange": 0-10,
        "digitalPresence": 0-5,
        "brandMaturity": 0-5,
        "keywords": 0-5
      },
      "evidence": [
        "Evidencia específica 1",
        "Evidencia específica 2",
        "Evidencia específica 3"
      ]
    }
  ]
}

EJEMPLOS DE PUNTUACIÓN:

Ejemplo 1 - Competidor Directo (Spotify vs Apple Music):
{
  "name": "Apple Music",
  "breakdown": {
    "industry": 15,          // Misma industria: streaming musical
    "businessModel": 15,     // Mismo modelo: suscripción mensual
    "productOffering": 14,   // Catálogo similar de 70M+ canciones
    "targetAudience": 10,    // Mismo público: consumidores de música digital
    "geography": 10,         // Ambos globales, 180+ países
    "marketSize": 10,        // Ambos tienen 100M+ suscriptores
    "priceRange": 9,         // Precios casi idénticos ($9.99 vs $10.99)
    "digitalPresence": 5,    // Ambos con app nativa, web, redes sociales
    "brandMaturity": 5,      // Ambos son marcas corporativas establecidas
    "keywords": 4            // Comparten "streaming", "música", "playlist"
  },
  "evidence": [
    "Ambos son servicios de streaming musical por suscripción",
    "Catálogos similares de más de 70 millones de canciones",
    "Precio mensual casi idéntico: $9.99 vs $10.99",
    "Presencia global en más de 180 países"
  ]
}
// Score total: 97/100

Ejemplo 2 - Competidor Local (Herbívoro vs El Huerto):
{
  "name": "El Huerto",
  "breakdown": {
    "industry": 15,          // Misma industria: restaurantes
    "businessModel": 13,     // Ambos son restaurantes, pero El Huerto tiene más sucursales
    "productOffering": 14,   // Ambos ofrecen comida vegana/vegetariana
    "targetAudience": 9,     // Público similar: consciente de salud, 25-45 años
    "geography": 10,         // Ambos operan en Santiago, Chile
    "marketSize": 7,         // El Huerto es más grande (múltiples sucursales)
    "priceRange": 8,         // El Huerto es ligeramente más caro
    "digitalPresence": 4,    // Ambos tienen web y redes sociales
    "brandMaturity": 4,      // El Huerto es más establecido (desde 1981)
    "keywords": 4            // Comparten "vegano", "vegetariano", "santiago", "saludable"
  },
  "evidence": [
    "Ambos son restaurantes veganos/vegetarianos en Santiago",
    "Público objetivo similar: personas conscientes de salud y alimentación",
    "Rango de precios comparable: $8K-$15K vs $10K-$18K",
    "Compiten por keywords: 'restaurante vegano santiago'"
  ]
}
// Score total: 88/100

IMPORTANTE:
- No inventes información sobre los competidores
- Si no tienes suficiente información para un criterio, asigna puntuación conservadora
- Las evidencias deben ser específicas y verificables
- Retorna SOLO JSON válido`;

    try {
      const response = await callClaude(prompt, systemPrompt);

      // Extract JSON from response
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replaceAll(/```json\n?/g, '').replaceAll(/```\n?/g, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replaceAll(/```\n?/g, '');
      }

      const result: {
        competitors: Array<{
          name: string;
          breakdown: CompetitorScoreBreakdown;
          evidence: string[];
        }>;
      } = JSON.parse(jsonStr);

      // Map to CompetitorScore and validate
      const scores: CompetitorScore[] = [];

      for (const comp of result.competitors || []) {
        // Validate breakdown
        if (!validateBreakdown(comp.breakdown)) {
          logger.warn(`Invalid breakdown for ${comp.name}, skipping`);
          continue;
        }

        // Find original competitor to get URL
        const original = competitors.find(c => c.name.toLowerCase() === comp.name.toLowerCase());

        const score: CompetitorScore = {
          name: comp.name,
          url: original?.url,
          similarityScore: calculateTotalScore(comp.breakdown),
          breakdown: comp.breakdown,
          evidence: comp.evidence || [],
        };

        scores.push(score);
      }

      // Sort by similarity score (highest first)
      scores.sort((a, b) => b.similarityScore - a.similarityScore);

      logger.info(`Analyzed ${scores.length} competitors successfully`);
      return scores;
    } catch (error) {
      logger.error('Competitor analysis with GPT-4 failed:', error instanceof Error ? error.message : 'Unknown error');

      // Return simple scores as fallback
      return competitors.map(c => ({
        name: c.name,
        url: c.url,
        similarityScore: 75, // Default moderate score
        breakdown: {
          industry: 12,
          businessModel: 10,
          productOffering: 10,
          targetAudience: 8,
          geography: 8,
          marketSize: 7,
          priceRange: 7,
          digitalPresence: 4,
          brandMaturity: 4,
          keywords: 5,
        },
        evidence: [c.description],
      }));
    }
  }
}

// Export singleton instance
export const competitorAnalyzer = new CompetitorAnalyzer();

/**
 * Google Search Service
 * Analyzes brand web presence using SerpAPI (real Google Search results)
 */

import { GoogleSearchData, TrendsData } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { callClaude } from '../llm/clients/claude-client.js';
import { getJson } from 'serpapi';

export class GoogleSearchService {
  /**
   * Analyze brand web presence for classification signals using SerpAPI
   */
  async searchBrand(brandName: string): Promise<GoogleSearchData & { trendsData: TrendsData }> {
    logger.info(`SerpAPI Search analysis for: ${brandName}`);

    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
      logger.error('SERP_API_KEY not found in environment variables');
      return {
        languages_detected: [],
        domains: [],
        international_media: false,
        trendsData: { top_countries: [], continents: [], top_country_concentration: 100 },
      };
    }

    try {
      // Search for the brand
      const response = await getJson({
        engine: 'google',
        q: `"${brandName}"`,
        api_key: apiKey,
        num: 20,
        gl: 'us',
        hl: 'en',
      });

      const organicResults = response.organic_results || [];
      const knowledgeGraph = response.knowledge_graph;

      // Detect languages from results
      const languages = new Set<string>();
      const domains = new Set<string>();
      let internationalMedia = false;

      // International media domains
      const mediaDomains = [
        'forbes.com',
        'bbc.com',
        'reuters.com',
        'bloomberg.com',
        'wsj.com',
        'ft.com',
        'economist.com',
        'nytimes.com',
        'theguardian.com',
        'cnn.com',
      ];

      for (const result of organicResults) {
        const url = result.link || '';

        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace('www.', '');

          // Check for international media
          if (mediaDomains.some(media => domain.includes(media))) {
            internationalMedia = true;
          }

          // Collect brand domains (filter out media/social/etc)
          if (
            !mediaDomains.some(media => domain.includes(media)) &&
            !domain.includes('wikipedia') &&
            !domain.includes('facebook') &&
            !domain.includes('instagram') &&
            !domain.includes('twitter') &&
            !domain.includes('linkedin')
          ) {
            // Check if domain contains brand name
            const cleanBrand = brandName.toLowerCase().replace(/\s+/g, '');
            if (domain.includes(cleanBrand) || domain.includes(cleanBrand.substring(0, 5))) {
              domains.add(domain);
            }
          }

          // Detect language from TLD
          const tldMatch = domain.match(/\.([a-z]{2})$/);
          if (tldMatch) {
            const tld = tldMatch[1];
            const langMap: Record<string, string> = {
              es: 'es',
              fr: 'fr',
              de: 'de',
              it: 'it',
              pt: 'pt',
              br: 'pt',
              jp: 'ja',
              cn: 'zh',
              kr: 'ko',
              ru: 'ru',
              uk: 'en',
              au: 'en',
              ca: 'en',
            };
            if (langMap[tld]) {
              languages.add(langMap[tld]);
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }

      // Always add English if we have results
      if (organicResults.length > 0) {
        languages.add('en');
      }

      // Check knowledge graph for additional signals
      if (knowledgeGraph) {
        // If brand has a knowledge graph, it's likely well-known
        if (knowledgeGraph.type?.includes('Corporation') || knowledgeGraph.type?.includes('Company')) {
          internationalMedia = true;
        }
      }

      // Get geographic trends data using SerpAPI related searches
      const trendsData = await this.getGeographicTrends(brandName, apiKey);

      const result = {
        languages_detected: Array.from(languages),
        domains: Array.from(domains),
        international_media: internationalMedia,
        trendsData,
      };

      logger.debug(
        `SerpAPI result: ${result.languages_detected.length} languages, ${result.domains.length} domains, international media: ${result.international_media}, ${result.trendsData.continents.length} continents`
      );

      return result;
    } catch (error) {
      logger.error(
        'SerpAPI Search failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      return {
        languages_detected: [],
        domains: [],
        international_media: false,
        trendsData: { top_countries: [], continents: [], top_country_concentration: 100 },
      };
    }
  }

  /**
   * Get geographic trends using SerpAPI searches from different locations
   */
  private async getGeographicTrends(brandName: string, apiKey: string): Promise<TrendsData> {
    try {
      // Search from multiple countries to detect geographic distribution
      const countries = ['us', 'gb', 'de', 'fr', 'es', 'br', 'jp', 'au'];
      const countryResults = await Promise.allSettled(
        countries.map(country =>
          getJson({
            engine: 'google',
            q: brandName,
            api_key: apiKey,
            num: 5,
            gl: country,
          })
        )
      );

      const countriesWithResults: string[] = [];
      countryResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.organic_results?.length > 0) {
          countriesWithResults.push(countries[index].toUpperCase());
        }
      });

      // Map countries to continents
      const continentMap: Record<string, string> = {
        US: 'North America',
        GB: 'Europe',
        DE: 'Europe',
        FR: 'Europe',
        ES: 'Europe',
        BR: 'South America',
        JP: 'Asia',
        AU: 'Oceania',
      };

      const continents = new Set<string>();
      countriesWithResults.forEach(country => {
        const continent = continentMap[country];
        if (continent) continents.add(continent);
      });

      // Calculate concentration (simple heuristic)
      const concentration = countriesWithResults.length > 0 ? 100 / countriesWithResults.length : 100;

      return {
        top_countries: countriesWithResults,
        continents: Array.from(continents),
        top_country_concentration: Math.min(100, concentration * 2),
      };
    } catch (error) {
      logger.warn('Geographic trends detection failed:', error);
      return {
        top_countries: [],
        continents: [],
        top_country_concentration: 100,
      };
    }
  }


  /**
   * Search for brand competitors using hybrid approach (LLM + SerpAPI)
   * Strategy: Ask LLM for competitor suggestions, then validate with real Google Search
   */
  async searchCompetitors(
    brandName: string,
    industry: string,
    brandType: 'global' | 'niche',
    location?: string,
    classificationData?: any
  ): Promise<Array<{ name: string; url?: string; description: string }>> {
    logger.info(`Searching competitors for ${brandName} (${brandType})`);

    const apiKey = process.env.SERP_API_KEY;
    if (!apiKey) {
      logger.error('SERP_API_KEY not found in environment variables');
      return [];
    }

    try {
      // Infer location and language from classification data
      let inferredLocation = location;
      let countryCode = 'us';
      let language = 'en';

      // For GLOBAL brands, skip location filtering entirely
      if (brandType === 'global') {
        logger.info('Global brand detected - skipping location filtering');
        inferredLocation = undefined;
        countryCode = 'us'; // Use US as default for global search
        language = 'en'; // Use English for global search
      } else {
        // PRIORITY 1: Check LLM's primary_country (most reliable) - ONLY for niche brands
        if (!inferredLocation && classificationData?.llmDirect?.primary_country) {
        const primaryCountry = classificationData.llmDirect.primary_country.toUpperCase();
        const countryMap: Record<string, { name: string; code: string; lang: string }> = {
          CO: { name: 'Colombia', code: 'co', lang: 'es' },
          CL: { name: 'Chile', code: 'cl', lang: 'es' },
          AR: { name: 'Argentina', code: 'ar', lang: 'es' },
          MX: { name: 'Mexico', code: 'mx', lang: 'es' },
          BR: { name: 'Brasil', code: 'br', lang: 'pt' },
          US: { name: 'United States', code: 'us', lang: 'en' },
          GB: { name: 'United Kingdom', code: 'gb', lang: 'en' },
          ES: { name: 'España', code: 'es', lang: 'es' },
        };

        if (countryMap[primaryCountry]) {
          const country = countryMap[primaryCountry];
          inferredLocation = country.name;
          countryCode = country.code;
          language = country.lang;
          logger.info(`Using LLM primary country: ${country.name}`);
        }
      }

      // PRIORITY 2: Check domains
      if (!inferredLocation && classificationData?.googleSearch?.domains) {
        const domains = classificationData.googleSearch.domains;
        for (const domain of domains) {
          if (domain.endsWith('.co') || domain.includes('colombia')) {
            inferredLocation = 'Colombia';
            countryCode = 'co';
            language = 'es';
            break;
          } else if (domain.endsWith('.cl') || domain.includes('chile')) {
            inferredLocation = 'Chile';
            countryCode = 'cl';
            language = 'es';
            break;
          } else if (domain.endsWith('.ar') || domain.includes('argentina')) {
            inferredLocation = 'Argentina';
            countryCode = 'ar';
            language = 'es';
            break;
          } else if (domain.endsWith('.mx') || domain.includes('mexico')) {
            inferredLocation = 'Mexico';
            countryCode = 'mx';
            language = 'es';
            break;
          }
        }
      }

      // Check if Spanish language was detected in search results
      if (!inferredLocation && classificationData?.googleSearch?.languages_detected) {
        const langs = classificationData.googleSearch.languages_detected;
        if (langs.includes('es')) {
          language = 'es';
          // Default to Colombia for Spanish if no other country detected
          if (!inferredLocation) {
            inferredLocation = 'Colombia';
            countryCode = 'co';
          }
        }
      }

      // Override if location explicitly provided
      if (location) {
        const locationLower = location.toLowerCase();
        if (locationLower.includes('chile')) {
          countryCode = 'cl';
          language = 'es';
          inferredLocation = 'Chile';
        } else if (locationLower.includes('colombia')) {
          countryCode = 'co';
          language = 'es';
          inferredLocation = 'Colombia';
        } else if (locationLower.includes('argentina')) {
          countryCode = 'ar';
          language = 'es';
          inferredLocation = 'Argentina';
        } else if (locationLower.includes('mexico')) {
          countryCode = 'mx';
          language = 'es';
          inferredLocation = 'Mexico';
        }
      }

      // FALLBACK: If still no location detected for niche brand, use LLM to infer from brand name + industry
      if (!inferredLocation && !location) {
        logger.info('No location detected - using LLM to infer from brand name and industry');
        const fallbackLocation = await this.inferLocationFromBrandContext(brandName, industry);
        if (fallbackLocation) {
          inferredLocation = fallbackLocation.name;
          countryCode = fallbackLocation.code;
          language = fallbackLocation.lang;
          logger.info(`Fallback location detected: ${fallbackLocation.name}`);
        }
      }
      } // Close the else block for niche brand location detection

      const finalLocation = location || inferredLocation;
      logger.debug(`Location: ${finalLocation || 'Not detected'}, Country: ${countryCode}, Language: ${language}`);

      // Step 1: Ask LLM for competitor suggestions based on classification data
      const llmSuggestions = await this.getLLMCompetitorSuggestions(
        brandName,
        industry,
        brandType,
        finalLocation,
        classificationData
      );

      logger.debug(`LLM suggested ${llmSuggestions.length} potential competitors`);

      // Step 2: Use SerpAPI to get real search results
      // Strategy: Always prioritize "competitors of X" queries for best results
      let query = '';
      const cleanIndustry = industry.replace(/\(.*?\)/g, '').trim().toLowerCase();

      if (language === 'es') {
        // Spanish queries
        if (brandType === 'global') {
          query = `competidores de ${brandName}`;
        } else {
          // For niche: Search for similar businesses in the same category
          const industryES = this.translateIndustryToSpanish(cleanIndustry);
          const locationQuery = finalLocation ? ` en ${finalLocation.split(',')[0]}` : ' en colombia';
          query = `${industryES}${locationQuery} competidores`;
        }
      } else {
        // English queries
        if (brandType === 'global') {
          query = `${brandName} competitors alternative`;
        } else {
          const locationQuery = location ? ` in ${location}` : '';
          query = `${cleanIndustry}${locationQuery} competitors`;
        }
      }

      logger.debug(`SerpAPI query: ${query} (lang: ${language}, country: ${countryCode})`);

      const response = await getJson({
        engine: 'google',
        q: query,
        api_key: apiKey,
        num: 15,
        gl: countryCode,
        hl: language,
      });

      const organicResults = response.organic_results || [];
      const aiOverview = response.ai_overview;
      const competitors: Array<{ name: string; url?: string; description: string }> = [];
      const seenNames = new Set<string>();

      // Step 3: Extract competitors from AI Overview first (best source for brand names)
      if (aiOverview?.snippet) {
        logger.debug('Found AI Overview with competitor suggestions');
        const snippet = aiOverview.snippet;
        const lines = snippet.split('\n');

        for (const line of lines) {
          // Match patterns like:
          // "1. Café León" or "2. Herbívoro Cocina Vegana"
          // "• Elektra" or "- Mestizo Vegano"
          const patterns = [
            /^\s*\d+\.\s*([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]+?)(?:\s*[-:]|\s*\(|$)/, // "1. Brand Name"
            /^[\s•\-\*]+\s*([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]+?)(?:\s*[-:]|\s*\(|$)/, // "• Brand Name"
            /([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ]+){0,3})(?:\s*:|\s*-|\s*\(|$)/, // General capitalized names
          ];

          for (const pattern of patterns) {
            const match = line.match(pattern);
            if (match) {
              let name = match[1].trim();

              // Clean up
              name = name
                .replace(/\s*\(.*?\)\s*$/, '') // Remove parentheses
                .replace(/\s+(S\.?A\.?S?|Ltda|Ltd)\.?$/i, '') // Remove company suffixes
                .trim();

              // Validate it looks like a brand name
              const normalizedName = name.toLowerCase().replace(/\s+/g, '');
              const normalizedBrand = brandName.toLowerCase().replace(/\s+/g, '');

              // Check if this is NOT the brand itself (exact or variation)
              const isBrandItself =
                name.toLowerCase() === brandName.toLowerCase() ||
                normalizedName === normalizedBrand ||
                normalizedName.includes(normalizedBrand) ||
                normalizedBrand.includes(normalizedName);

              if (
                name.length > 2 &&
                name.length < 50 &&
                !seenNames.has(normalizedName) &&
                !isBrandItself && // Exclude the brand itself and variations
                // Must start with capital letter
                /^[A-ZÁÉÍÓÚÑ]/.test(name) &&
                // Should not contain common non-brand words at the start
                !/^(the|los|las|el|la|un|una|otros|other|más|best|top)/i.test(name) &&
                // Exclude geographic locations (departments, cities, regions)
                !/^(antioquia|cundinamarca|valle|santander|bogotá|medellín|cali|barranquilla|cartagena|bogota|medellin)$/i.test(normalizedName)
              ) {
                seenNames.add(normalizedName);
                competitors.push({
                  name: name,
                  url: undefined,
                  description: `Competitor suggested by Google AI`,
                });

                if (competitors.length >= 8) {
                  break;
                }
                break; // Found a match for this line, move to next
              }
            }
          }

          if (competitors.length >= 8) {
            break;
          }
        }
      }

      // Step 4: Add competitors from organic results
      // Only extract from actual business websites, not directories
      for (const result of organicResults) {
        if (competitors.length >= 8) {
          break;
        }

        const url = result.link || '';
        const title = result.title || '';
        const snippet = result.snippet || '';

        // Skip directories, listing sites, and non-competitive content
        const skipPatterns = [
          'dnb.com', // Dun & Bradstreet directory
          'business-directory',
          'company-information',
          'competitors', // Articles about competitors
          'top 100',
          'ranking',
          'directory',
          'tripadvisor',
          'yelp',
          'facebook',
          'instagram',
          'twitter',
          'linkedin',
          'wikipedia',
          'ftc.gov', // Government sites
          'pdf', // PDF documents
          '.pdf',
        ];

        if (skipPatterns.some(pattern => url.toLowerCase().includes(pattern) || title.toLowerCase().includes(pattern))) {
          continue;
        }

        // FIRST: Try to extract competitor names from snippet if it contains lists
        // Patterns like "1. Café León · 2. Herbívoro · 3. Elektra" or "Casa Lėlytė, De Raíz, y Casa Lelyté"
        if (snippet) {
          const listPatterns = [
            /\d+\.\s*([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s]+?)(?:\s*[·•\-,]|$)/g, // "1. Brand Name ·"
            /([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ]+){0,3})(?:\s*[,;]|\s+y\s+|\s+and\s+)/g, // "Brand1, Brand2, y Brand3"
          ];

          for (const pattern of listPatterns) {
            const matches = snippet.matchAll(pattern);
            for (const match of matches) {
              let name = match[1].trim();

              // Clean up
              name = name
                .replace(/\s*\(.*?\)\s*$/, '') // Remove parentheses
                .replace(/\s+(S\.?A\.?S?|Ltda|Ltd|Cocina|Vegana?|Restaurant)\.?$/i, '') // Remove suffixes
                .trim();

              const normalizedName = name.toLowerCase();
              if (
                name.length > 2 &&
                name.length < 50 &&
                !seenNames.has(normalizedName) &&
                name !== brandName && // Don't include exact brand name
                /^[A-ZÁÉÍÓÚÑ]/.test(name) && // Must start with capital
                !/^(the|los|las|el|la|un|una|otros|por|ejemplo|restaurantes|como)/i.test(name) // No common words
              ) {
                seenNames.add(normalizedName);
                competitors.push({
                  name: name,
                  url: url,
                  description: `Found in list of similar businesses`,
                });

                if (competitors.length >= 8) {
                  break;
                }
              }
            }

            if (competitors.length >= 8) {
              break;
            }
          }

          // If we found competitors in this snippet, continue to next result
          if (competitors.length >= 8) {
            break;
          }
        }

        // Try to extract brand name from domain
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace('www.', '');

          // Extract potential brand name from domain
          // e.g., "coratiendas.com" -> "Coratiendas"
          const domainParts = domain.split('.');
          if (domainParts.length >= 2) {
            const brandPart = domainParts[0];

            // Skip if domain is too generic
            const genericDomains = ['blog', 'news', 'tienda', 'shop', 'store', 'mail', 'web'];
            if (!genericDomains.includes(brandPart.toLowerCase())) {
              // Capitalize first letter
              const brandCandidate = brandPart.charAt(0).toUpperCase() + brandPart.slice(1);

              const normalizedName = brandCandidate.toLowerCase();
              if (
                !seenNames.has(normalizedName) &&
                brandCandidate.length > 2 &&
                brandCandidate.length < 30 &&
                brandCandidate !== brandName // Don't include exact brand name
              ) {
                seenNames.add(normalizedName);
                competitors.push({
                  name: brandCandidate,
                  url: url,
                  description: snippet.substring(0, 150),
                });
                continue;
              }
            }
          }
        } catch {
          // Invalid URL, try title extraction
        }

        // Fallback: Extract from title if it looks like a brand name
        // Titles like "Coratiendas - Supermercado" or "Sumafrut"
        const titleParts = title.split(/[-|•·]/);
        if (titleParts.length > 0) {
          let brandCandidate = titleParts[0].trim();

          // Remove common suffixes
          brandCandidate = brandCandidate
            .replace(/\s+(S\.?A\.?S?|Ltda|Ltd|Inc|Corp|Company|Empresa)\.?$/i, '')
            .trim();

          const normalizedName = brandCandidate.toLowerCase();
          if (
            !seenNames.has(normalizedName) &&
            brandCandidate.length > 2 &&
            brandCandidate.length < 40 &&
            brandCandidate !== brandName && // Don't include exact brand name
            !normalizedName.includes('find') &&
            !normalizedName.includes('top') &&
            !normalizedName.includes('list') &&
            !normalizedName.includes('best')
          ) {
            seenNames.add(normalizedName);
            competitors.push({
              name: brandCandidate,
              url: url,
              description: snippet.substring(0, 150),
            });
          }
        }
      }

      // If we don't have enough from Google, add LLM suggestions
      if (competitors.length < 5 && llmSuggestions.length > 0) {
        for (const suggestion of llmSuggestions) {
          const normalizedName = suggestion.name.toLowerCase();
          if (!seenNames.has(normalizedName)) {
            seenNames.add(normalizedName);
            competitors.push(suggestion);

            if (competitors.length >= 8) {
              break;
            }
          }
        }
      }

      logger.info(`Found ${competitors.length} raw competitors for ${brandName}`);

      // Step 5: Filter and validate competitors using LLM
      // This ensures we only return truly relevant competitors
      if (competitors.length > 0) {
        const filteredCompetitors = await this.filterCompetitorsWithLLM(
          brandName,
          industry,
          brandType,
          finalLocation,
          competitors,
          classificationData
        );

        logger.info(`After filtering: ${filteredCompetitors.length} relevant competitors`);
        return filteredCompetitors;
      }

      return competitors;
    } catch (error) {
      logger.error(
        'Competitor search failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
      return [];
    }
  }

  /**
   * Translate industry category to Spanish for better local search results
   * Returns singular form for use in "competidores {category}" queries
   */
  private translateIndustryToSpanish(industry: string): string {
    const translations: Record<string, string> = {
      // Food & Beverage
      'coffee shop': 'cafés',
      'cafetería': 'cafés',
      'café': 'cafés',
      'coffee': 'cafés',
      'restaurant': 'restaurantes',
      'restaurante': 'restaurantes',
      'bakery': 'panaderías',
      'bar': 'bares',
      'nightclub': 'discotecas',

      // Retail
      'supermarket': 'supermercados',
      'supermercado': 'supermercados',
      'grocery store': 'tiendas',
      'store': 'tiendas',
      'shop': 'tiendas',
      'tienda': 'tiendas',
      'clothing store': 'tiendas de ropa',
      'bookstore': 'librerías',
      'pharmacy': 'farmacias',

      // Services
      'hotel': 'hoteles',
      'gym': 'gimnasios',
      'salon': 'salones',
      'spa': 'spas',
      'clinic': 'clínicas',
      'school': 'escuelas',
      'university': 'universidades',

      // Tech
      'tech company': 'empresas de tecnología',
      'software company': 'empresas de software',
      'company': 'empresas',
    };

    // Try exact match first
    const lowerIndustry = industry.toLowerCase();
    if (translations[lowerIndustry]) {
      return translations[lowerIndustry];
    }

    // Try partial matches
    for (const [eng, esp] of Object.entries(translations)) {
      if (lowerIndustry.includes(eng)) {
        return esp;
      }
    }

    // Return the industry itself in Spanish or as-is
    return industry;
  }

  /**
   * Filter competitors using LLM to ensure they are truly relevant
   * This is the critical step that validates each competitor against brand characteristics
   */
  private async filterCompetitorsWithLLM(
    brandName: string,
    industry: string,
    brandType: 'global' | 'niche',
    location: string | undefined,
    candidates: Array<{ name: string; url?: string; description: string }>,
    classificationData?: any
  ): Promise<Array<{ name: string; url?: string; description: string }>> {
    try {
      const systemPrompt = `Eres un analista de inteligencia competitiva. Debes responder SOLO con JSON válido, sin texto explicativo.`;

      const brandContext = `
Marca: "${brandName}"
Tipo: ${brandType === 'global' ? 'global' : 'local/regional'}
Industria: ${industry}
Ubicación: ${location || 'Desconocida'}
${classificationData ? `
Clasificación:
- Wikipedia: ${classificationData.wikipedia ? 'Sí' : 'No'}
- Medios internacionales: ${classificationData.googleSearch?.international_media ? 'Sí' : 'No'}
- Continentes: ${classificationData.googleTrends?.continents?.join(', ') || 'Desconocido'}
` : ''}`;

      const candidatesList = candidates.map((c, i) => `${i + 1}. ${c.name}`).join('\n');

      logger.debug(`Filtering ${candidates.length} candidates for ${brandName}`);

      const prompt = `Valida esta lista de competidores potenciales para "${brandName}":

${brandContext}

Candidatos:
${candidatesList}

SOLO EXCLUYE si el candidato es CLARAMENTE:
- La misma marca "${brandName}" (o variaciones como "${brandName.replace(/^(restaurante|café|hotel|supermercado)\s+/i, '')}")
- Una plataforma (Expedia, Booking, Uber Eats, Rappi, TripAdvisor)
- Una palabra genérica sin nombre propio ("Restaurant", "Café", "Hotel")
${brandType === 'niche' && location ? `- Una marca de OTRO PAÍS (debe ser de ${location})` : ''}

Para cada competidor VÁLIDO, retorna:
{
  "competitors": [
    {"name": "Nombre", "description": "Qué hace"}
  ]
}

Sé PERMISIVO - incluye todos los que parezcan competidores reales de ${location || 'la región'}. Solo excluye lo obviamente inválido.`;

      const response = await callClaude(prompt, systemPrompt);

      // Extract JSON
      let jsonStr = response.trim();
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }

      const result: { competitors: Array<{ name: string; description: string }> } =
        JSON.parse(jsonStr);

      // Match filtered names back to original candidates to preserve URLs
      const filtered: Array<{ name: string; url?: string; description: string }> = [];

      // List of generic words to exclude
      const genericWords = [
        'restaurante', 'restaurant', 'cafetería', 'cafeteria', 'café', 'coffee',
        'hotel', 'supermercado', 'supermarket', 'tienda', 'store', 'shop',
        'negocio', 'business', 'empresa', 'company', 'bar', 'club',
        'panadería', 'bakery', 'cocina', 'kitchen'
      ];

      // Extract the core brand name (remove common prefixes)
      const coreBrandName = brandName.replace(/^(restaurante|café|hotel|supermercado|tienda)\s+/i, '').toLowerCase().trim();

      for (const llmComp of result.competitors || []) {
        // Skip if it's a generic word without a proper name
        const nameLower = llmComp.name.toLowerCase().trim();
        if (genericWords.includes(nameLower)) {
          logger.debug(`Skipping generic word: ${llmComp.name}`);
          continue;
        }

        // Skip if it matches the brand name (exact or core name)
        const compNameCore = nameLower.replace(/^(restaurante|café|hotel|supermercado|tienda)\s+/i, '').trim();
        if (nameLower === brandName.toLowerCase() || compNameCore === coreBrandName) {
          logger.debug(`Skipping same brand: ${llmComp.name}`);
          continue;
        }

        const original = candidates.find(
          c => c.name.toLowerCase() === llmComp.name.toLowerCase()
        );
        if (original) {
          filtered.push({
            name: original.name,
            url: original.url,
            description: llmComp.description,
          });
        }
      }

      logger.debug(`LLM filtered ${candidates.length} → ${filtered.length} competitors (after removing generic words)`);
      return filtered;
    } catch (error) {
      logger.warn('LLM filtering failed, returning original list:', error);
      // If filtering fails, return original list
      return candidates;
    }
  }

  /**
   * Infer location from brand name and industry context using LLM
   * Used as a fallback when other location detection methods fail
   */
  private async inferLocationFromBrandContext(
    brandName: string,
    industry: string
  ): Promise<{ name: string; code: string; lang: string } | null> {
    try {
      const systemPrompt = `Eres un analista geográfico. Debes inferir el país de origen de una marca basándote en su nombre e industria. Responde SOLO con JSON válido.`;

      const prompt = `Analiza la marca "${brandName}" en la industria de ${industry}.

¿De qué país es esta marca? Considera:
- Nombres con referencias geográficas
- Palabras en idiomas específicos
- Convenciones de nombres locales
- Contexto de la industria

Responde en formato JSON:
{
  "country_code": "código ISO de 2 letras" o null,
  "country_name": "nombre del país en español" o null,
  "confidence": 0-100,
  "reasoning": "por qué crees que es de este país"
}

Ejemplos:
- "Restaurante Herbívoro" → {"country_code": "CO", "country_name": "Colombia", "confidence": 75, "reasoning": "Herbívoro es un restaurante vegano conocido en Bogotá"}
- "Café Quindío" → {"country_code": "CO", "country_name": "Colombia", "confidence": 90, "reasoning": "Quindío es un departamento colombiano famoso por el café"}
- "Supermercado Olímpica" → {"country_code": "CO", "country_name": "Colombia", "confidence": 85, "reasoning": "Olímpica es una cadena de supermercados colombiana"}
- "Panadería San Juan" → {"country_code": null, "country_name": null, "confidence": 20, "reasoning": "Nombre genérico que podría ser de cualquier país de habla hispana"}

IMPORTANTE: Solo retorna un país si tienes confianza >= 60. Si no estás seguro, retorna null.`;

      const response = await callClaude(prompt, systemPrompt);

      // Extract JSON
      let jsonStr = response.trim();
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }

      const result: {
        country_code: string | null;
        country_name: string | null;
        confidence: number;
        reasoning: string;
      } = JSON.parse(jsonStr);

      logger.debug(`Location inference: ${result.country_name} (${result.confidence}% confidence) - ${result.reasoning}`);

      // Only use if confidence is high enough
      if (result.country_code && result.confidence >= 60) {
        const countryMap: Record<string, { name: string; code: string; lang: string }> = {
          CO: { name: 'Colombia', code: 'co', lang: 'es' },
          CL: { name: 'Chile', code: 'cl', lang: 'es' },
          AR: { name: 'Argentina', code: 'ar', lang: 'es' },
          MX: { name: 'Mexico', code: 'mx', lang: 'es' },
          BR: { name: 'Brasil', code: 'br', lang: 'pt' },
          US: { name: 'United States', code: 'us', lang: 'en' },
          GB: { name: 'United Kingdom', code: 'gb', lang: 'en' },
          ES: { name: 'España', code: 'es', lang: 'es' },
        };

        const country = countryMap[result.country_code.toUpperCase()];
        if (country) {
          return country;
        }
      }

      return null;
    } catch (error) {
      logger.warn('Location inference failed:', error);
      return null;
    }
  }

  /**
   * Get competitor suggestions from LLM based on classification data
   */
  private async getLLMCompetitorSuggestions(
    brandName: string,
    industry: string,
    brandType: 'global' | 'niche',
    location?: string,
    classificationData?: any
  ): Promise<Array<{ name: string; url?: string; description: string }>> {
    try {
      const systemPrompt = `Eres un analista de inteligencia competitiva. Debes responder SOLO con JSON válido, sin texto antes o después.`;

      let strategyPrompt = '';
      if (brandType === 'global') {
        strategyPrompt = `Sugiere 5-8 competidores GLOBALES principales para "${brandName}" en la industria de ${industry}.`;
      } else {
        const locationStr = location || 'la región';
        strategyPrompt = `Sugiere 5-8 competidores que operan ESPECÍFICAMENTE en ${locationStr} para "${brandName}" en la industria de ${industry}.

CRÍTICO: Los competidores DEBEN ser negocios que operan en ${locationStr}. NO sugieras marcas de otros países o regiones.`;
      }

      const dataContext = classificationData
        ? `
Contexto de la marca:
- Wikipedia: ${classificationData.wikipedia ? 'Sí' : 'No'}
- LLM conoce: ${classificationData.llmDirect?.knows_brand ? 'Sí' : 'No'}
- Idiomas: ${classificationData.googleSearch?.languages_detected?.join(', ') || 'Ninguno'}
- Cobertura de medios: ${classificationData.googleSearch?.international_media ? 'Internacional' : 'Local'}
- Continentes: ${classificationData.googleTrends?.continents?.join(', ') || 'Desconocido'}
`
        : '';

      const prompt = `${strategyPrompt}

${dataContext}

Retorna SOLO esta estructura JSON sin texto adicional:
{
  "competitors": [
    {"name": "Nombre del Competidor", "description": "Una oración sobre lo que hacen"}
  ]
}

REGLAS CRÍTICAS:
- SOLO incluye negocios REALES que ofrezcan productos/servicios directamente
- NUNCA incluyas plataformas de reservas/booking (Expedia, Booking.com, Hotels.com, Trivago, Kayak, Despegar, etc.)
- NUNCA incluyas marketplaces o agregadores (TripAdvisor, OpenTable, Uber Eats, etc.)
- NUNCA incluyas directorios o listados (Google Maps, Yelp, etc.)
- Para hoteles: solo incluye hoteles reales, NO plataformas de búsqueda
- Para restaurantes: solo incluye restaurantes reales, NO apps de delivery
- Para cafés: solo incluye cafés reales, NO distribuidores
- Mantén el mismo nivel de calidad/prestigio que "${brandName}"

IMPORTANTE:
- Retorna SOLO JSON válido
- Incluye solo competidores REALES que sepas que existen
- Si no estás seguro, retorna array vacío: {"competitors": []}`;

      const response = await callClaude(prompt, systemPrompt);

      // More aggressive JSON extraction
      let jsonStr = response.trim();

      // Remove markdown code blocks
      jsonStr = jsonStr.replace(/```json\s*/g, '').replace(/```\s*/g, '');

      // Find JSON object boundaries
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }

      const result: { competitors: Array<{ name: string; description: string }> } =
        JSON.parse(jsonStr);

      logger.debug(`LLM parsed ${result.competitors?.length || 0} competitor suggestions`);
      return (result.competitors || []).map(c => ({ ...c, url: undefined }));
    } catch (error) {
      logger.warn('LLM competitor suggestions failed:', error);
      return [];
    }
  }

  /**
   * Calculate score based on Google Search data
   * Returns 0-20 points according to strategy
   */
  calculateScore(searchData: GoogleSearchData): number {
    let score = 0;

    // Signal 1: Results in 3+ languages (12 points)
    if (searchData.languages_detected.length >= 3) {
      score += 12;
    }

    // Signal 2: International media present (8 points)
    if (searchData.international_media) {
      score += 8;
    }

    logger.debug(`Google Search score: ${score}/20 points`);
    return score;
  }
}

// Export singleton instance
export const googleSearchService = new GoogleSearchService();

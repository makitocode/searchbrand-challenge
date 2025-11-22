/**
 * Wikipedia Service
 * Searches and extracts data from Wikipedia for brand analysis
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { WikipediaData } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class WikipediaService {
  private readonly enBaseUrl = 'https://en.wikipedia.org';
  private readonly enApiUrl = 'https://en.wikipedia.org/w/api.php';
  private readonly esBaseUrl = 'https://es.wikipedia.org';
  private readonly esApiUrl = 'https://es.wikipedia.org/w/api.php';

  /**
   * Search for a brand on Wikipedia (tries English first, then Spanish)
   */
  async searchBrand(brandName: string): Promise<WikipediaData> {
    try {
      logger.info(`Searching Wikipedia for: ${brandName}`);

      // Normalize the brand name (remove accents for better search results)
      const normalizedName = this.normalizeSearchTerm(brandName);

      // Step 1: Try English Wikipedia first
      let searchResults = await this.searchPage(normalizedName, this.enApiUrl);
      let baseUrl = this.enBaseUrl;
      let language = 'en';

      // Step 2: If no results in English, try Spanish
      if (searchResults.length === 0) {
        logger.debug('No results in English Wikipedia, trying Spanish...');
        searchResults = await this.searchPage(normalizedName, this.esApiUrl);
        baseUrl = this.esBaseUrl;
        language = 'es';
      }

      if (searchResults.length === 0) {
        logger.info(`No Wikipedia page found for: ${brandName}`);
        return { exists: false };
      }

      // Step 3: Get the first result (most relevant)
      const pageTitle = searchResults[0];
      logger.debug(`Found Wikipedia page (${language}): ${pageTitle}`);

      // Step 4: Extract data from the page
      const pageData = await this.extractPageData(pageTitle, baseUrl);

      return {
        exists: true,
        title: pageTitle,
        ...pageData,
      };
    } catch (error) {
      logger.error('Wikipedia search failed:', error instanceof Error ? error.message : 'Unknown error');
      return { exists: false };
    }
  }

  /**
   * Search for pages using Wikipedia API
   */
  private async searchPage(query: string, apiUrl: string): Promise<string[]> {
    try {
      const response = await axios.get(apiUrl, {
        params: {
          action: 'opensearch',
          search: query,
          limit: 5,
          namespace: 0,
          format: 'json',
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'SearchBrand/1.0 (Competitor Intelligence Tool)',
        },
      });

      // OpenSearch returns: [query, [titles], [descriptions], [urls]]
      const titles = response.data[1] as string[];
      return titles || [];
    } catch (error) {
      logger.error('Wikipedia API search failed:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Extract data from a Wikipedia page
   */
  private async extractPageData(
    pageTitle: string,
    baseUrl: string
  ): Promise<Partial<WikipediaData>> {
    try {
      // Get page HTML
      const pageUrl = `${baseUrl}/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`;
      const response = await axios.get(pageUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'SearchBrand/1.0 (Competitor Intelligence Tool)',
        },
      });
      const $ = cheerio.load(response.data);

      // Extract summary (first paragraph)
      const summary = this.extractSummary($);

      // Extract categories
      const categories = this.extractCategories($);

      // Extract infobox data
      const infobox = this.extractInfobox($);

      // Look for competitors in the text
      const competitors = this.extractCompetitors($);

      return {
        summary,
        categories,
        infobox,
        competitors,
      };
    } catch (error) {
      logger.error(`Failed to extract data from Wikipedia page: ${pageTitle}`, error instanceof Error ? error.message : 'Unknown error');
      return {};
    }
  }

  /**
   * Extract the first paragraph as summary
   */
  private extractSummary($: cheerio.CheerioAPI): string | undefined {
    const firstParagraph = $('#mw-content-text .mw-parser-output > p')
      .not('.mw-empty-elt')
      .first()
      .text()
      .trim();

    return firstParagraph.length > 50 ? firstParagraph : undefined;
  }

  /**
   * Extract page categories
   */
  private extractCategories($: cheerio.CheerioAPI): string[] {
    const categories: string[] = [];

    $('#mw-normal-catlinks ul li a').each((_, element) => {
      const category = $(element).text().trim();
      if (category) {
        categories.push(category);
      }
    });

    return categories.slice(0, 10); // Limit to 10 most relevant
  }

  /**
   * Extract infobox data (key-value pairs)
   */
  private extractInfobox($: cheerio.CheerioAPI): Record<string, string> {
    const infobox: Record<string, string> = {};

    $('.infobox tr').each((_, row) => {
      const $row = $(row);
      const header = $row.find('th').first().text().trim();
      const value = $row.find('td').first().text().trim();

      if (header && value) {
        // Clean up the key
        const key = header
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '');

        infobox[key] = value;
      }
    });

    return infobox;
  }

  /**
   * Extract potential competitors mentioned in the page
   */
  private extractCompetitors($: cheerio.CheerioAPI): string[] {
    const competitors: string[] = [];
    const competitorKeywords = ['competitor', 'rival', 'alternative', 'similar', 'compared'];

    // Look for sections about competitors
    $('#mw-content-text h2, #mw-content-text h3').each((_, heading) => {
      const $heading = $(heading);
      const headingText = $heading.text().toLowerCase();

      // Check if heading mentions competitors
      const isCompetitorSection = competitorKeywords.some(keyword =>
        headingText.includes(keyword)
      );

      if (isCompetitorSection) {
        // Extract links from the following section
        $heading.nextUntil('h2, h3').find('a[href^="/wiki/"]').each((_, link) => {
          const competitorName = $(link).text().trim();
          if (competitorName && competitorName.length > 2 && competitorName.length < 50) {
            competitors.push(competitorName);
          }
        });
      }
    });

    // Remove duplicates and limit
    return [...new Set(competitors)].slice(0, 10);
  }

  /**
   * Normalize search term by removing accents and special characters
   * This helps Wikipedia API handle searches better
   */
  private normalizeSearchTerm(term: string): string {
    return term
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
      .trim();
  }
}

// Export singleton instance
export const wikipediaService = new WikipediaService();

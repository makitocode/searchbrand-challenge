/**
 * Website Analyzer Service
 * Analyzes official brand websites for multi-language support and international presence
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { WebsiteData } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class WebsiteAnalyzerService {
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  /**
   * Analyze official website for classification signals
   */
  async analyzeWebsite(brandUrl?: string, brandName?: string): Promise<WebsiteData> {
    logger.info(`Website analysis for: ${brandUrl || brandName}`);

    // If no URL provided, try to find it
    if (!brandUrl && brandName) {
      brandUrl = await this.findOfficialWebsite(brandName);
    }

    if (!brandUrl) {
      logger.warn('No website URL available for analysis');
      return {
        languages_available: 0,
        has_country_selector: false,
        multi_domain: false,
      };
    }

    try {
      const response = await axios.get(brandUrl, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8,fr;q=0.7',
        },
        timeout: 10000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);

      // Detect available languages
      const languageIndicators = new Set<string>();

      // Method 1: Look for language selector elements
      const languageSelectors = [
        '[class*="language"]',
        '[class*="lang"]',
        '[id*="language"]',
        '[id*="lang"]',
        'select[name*="language"]',
        'select[name*="lang"]',
        '[hreflang]',
      ];

      for (const selector of languageSelectors) {
        $(selector).each((_index, element) => {
          const text = $(element).text().toLowerCase();
          const hreflang = $(element).attr('hreflang');
          const href = $(element).attr('href');

          // Extract language from hreflang
          if (hreflang) {
            languageIndicators.add(hreflang.split('-')[0]);
          }

          // Extract language from href (e.g., /en/, /es/, /fr/)
          if (href) {
            const langMatch = href.match(/\/(en|es|fr|de|it|pt|ja|zh|ko|ru|ar)\//);
            if (langMatch) {
              languageIndicators.add(langMatch[1]);
            }
          }

          // Common language names
          if (text.includes('english')) languageIndicators.add('en');
          if (text.includes('español') || text.includes('spanish')) languageIndicators.add('es');
          if (text.includes('français') || text.includes('french')) languageIndicators.add('fr');
          if (text.includes('deutsch') || text.includes('german')) languageIndicators.add('de');
          if (text.includes('italiano') || text.includes('italian')) languageIndicators.add('it');
          if (text.includes('português') || text.includes('portuguese'))
            languageIndicators.add('pt');
          if (text.includes('日本語') || text.includes('japanese')) languageIndicators.add('ja');
          if (text.includes('中文') || text.includes('chinese')) languageIndicators.add('zh');
        });
      }

      // Method 2: Check HTML lang attribute
      const htmlLang = $('html').attr('lang');
      if (htmlLang) {
        languageIndicators.add(htmlLang.split('-')[0]);
      }

      // Method 3: Check for alternate language links
      $('link[rel="alternate"][hreflang]').each((_index, element) => {
        const hreflang = $(element).attr('hreflang');
        if (hreflang && hreflang !== 'x-default') {
          languageIndicators.add(hreflang.split('-')[0]);
        }
      });

      // Detect country selector
      const countrySelectors = [
        '[class*="country"]',
        '[class*="region"]',
        '[id*="country"]',
        '[id*="region"]',
        'select[name*="country"]',
        'select[name*="region"]',
      ];

      let hasCountrySelector = false;
      for (const selector of countrySelectors) {
        if ($(selector).length > 0) {
          hasCountrySelector = true;
          break;
        }
      }

      // Detect multi-domain presence (check for links to different country domains)
      const multiDomainIndicators = new Set<string>();
      $('a[href]').each((_index, element) => {
        const href = $(element).attr('href');
        if (href && href.startsWith('http')) {
          try {
            const url = new URL(href);
            const domain = url.hostname;

            // Check if domain contains country code before main domain
            // e.g., us.brand.com, uk.brand.com
            const subdomainMatch = domain.match(/^([a-z]{2})\./);
            if (subdomainMatch) {
              multiDomainIndicators.add(subdomainMatch[1]);
            }

            // Check for country-specific TLDs
            const tldMatch = domain.match(/\.([a-z]{2})$/);
            if (tldMatch && tldMatch[1] !== 'co' && tldMatch[1] !== 'io') {
              multiDomainIndicators.add(tldMatch[1]);
            }
          } catch {
            // Ignore invalid URLs
          }
        }
      });

      const result: WebsiteData = {
        languages_available: languageIndicators.size,
        has_country_selector: hasCountrySelector,
        multi_domain: multiDomainIndicators.size >= 2,
      };

      logger.debug(
        `Website analysis result: ${result.languages_available} languages, country selector: ${result.has_country_selector}, multi-domain: ${result.multi_domain}`
      );

      return result;
    } catch (error) {
      logger.error(
        'Website analysis failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Return empty data on failure
      return {
        languages_available: 0,
        has_country_selector: false,
        multi_domain: false,
      };
    }
  }

  /**
   * Try to find official website using search
   */
  private async findOfficialWebsite(brandName: string): Promise<string | undefined> {
    try {
      // Simple heuristic: try common patterns
      const commonTLDs = ['com', 'net', 'org'];
      const cleanName = brandName.toLowerCase().replace(/\s+/g, '');

      for (const tld of commonTLDs) {
        const potentialUrl = `https://www.${cleanName}.${tld}`;
        try {
          await axios.head(potentialUrl, {
            timeout: 5000,
            maxRedirects: 0,
            validateStatus: (status) => status >= 200 && status < 400,
          });
          logger.info(`Found potential official website: ${potentialUrl}`);
          return potentialUrl;
        } catch {
          // Try next TLD
        }
      }
    } catch (error) {
      logger.debug('Could not find official website automatically');
    }

    return undefined;
  }

  /**
   * Calculate score based on website data
   * Returns 0-15 points according to strategy
   */
  calculateScore(websiteData: WebsiteData): number {
    let score = 0;

    // Signal 1: 3+ languages available (10 points)
    if (websiteData.languages_available >= 3) {
      score += 10;
    }

    // Signal 2: Has country selector (5 points)
    if (websiteData.has_country_selector) {
      score += 5;
    }

    logger.debug(`Website score: ${score}/15 points`);
    return score;
  }
}

// Export singleton instance
export const websiteAnalyzerService = new WebsiteAnalyzerService();

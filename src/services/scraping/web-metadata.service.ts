/**
 * Web Metadata Extraction Service
 * Extracts metadata from competitor websites for analysis
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { ScrapedMetadata } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

export class WebMetadataService {
  private readonly userAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  /**
   * Extract metadata from a website URL
   */
  async extractMetadata(url: string): Promise<ScrapedMetadata> {
    logger.info(`Extracting metadata from: ${url}`);

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'text/html',
        },
        timeout: 10000,
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);

      // Extract basic metadata
      const title = $('title').text().trim() || $('meta[property="og:title"]').attr('content');

      const description =
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content');

      // Extract keywords
      const keywordsAttr = $('meta[name="keywords"]').attr('content');
      const keywords: string[] = keywordsAttr
        ? keywordsAttr
            .split(',')
            .map(k => k.trim())
            .filter(Boolean)
        : [];

      // Extract Open Graph data
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');

      // Try to extract additional keywords from headings and content
      const headings = new Set<string>();
      $('h1, h2, h3').each((_index, element) => {
        const text = $(element).text().trim();
        if (text && text.length < 100) {
          headings.add(text.toLowerCase());
        }
      });

      // Combine keywords from meta tags and headings
      const allKeywords = [...new Set([...keywords, ...Array.from(headings)])];

      const result: ScrapedMetadata = {
        title: title || undefined,
        description: description || undefined,
        keywords: allKeywords.length > 0 ? allKeywords.slice(0, 20) : undefined, // Limit to top 20
        ogTitle: ogTitle || undefined,
        ogDescription: ogDescription || undefined,
        url,
      };

      logger.debug(
        `Extracted metadata: ${result.title ? 'title' : 'no title'}, ${result.keywords?.length || 0} keywords`
      );

      return result;
    } catch (error) {
      logger.warn(
        `Failed to extract metadata from ${url}:`,
        error instanceof Error ? error.message : 'Unknown error'
      );

      // Return minimal metadata on failure
      return {
        url,
        keywords: [],
      };
    }
  }

  /**
   * Extract metadata from multiple URLs in parallel
   */
  async extractBulkMetadata(urls: string[]): Promise<ScrapedMetadata[]> {
    logger.info(`Extracting metadata from ${urls.length} URLs`);

    const results = await Promise.allSettled(urls.map(url => this.extractMetadata(url)));

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        logger.warn(`Failed to extract metadata from ${urls[index]}`);
        return {
          url: urls[index],
          keywords: [],
        };
      }
    });
  }
}

// Export singleton instance
export const webMetadataService = new WebMetadataService();

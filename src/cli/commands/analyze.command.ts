/**
 * Analyze Command - Main CLI command for brand competitor analysis
 */

import chalk from 'chalk';
import ora from 'ora';
import { inputAnalyzer } from '../../services/llm/input-analyzer.js';
import { wikipediaService } from '../../services/scraping/wikipedia.service.js';
import { brandTypeDetector } from '../../services/analysis/brand-type-detector.js';
import { brandClassifier } from '../../services/llm/brand-classifier.js';
import { googleSearchService } from '../../services/scraping/google-search.service.js';
import { websiteAnalyzerService } from '../../services/scraping/website-analyzer.service.js';
import { promptBrandInput, promptCategorySelection } from '../prompts/interactive-prompts.js';
import { logger } from '../../utils/logger.js';
import { InputAnalysis, BrandClassificationData } from '../../types/index.js';

/**
 * Main analyze command
 */
export async function analyzeCommand(): Promise<void> {
  try {
    // Get brand input
    const brandInput = await promptBrandInput();

    // Analyze input
    const spinner = ora({ text: 'Analizando marca...', spinner: 'dots' }).start();

    const analysis: InputAnalysis = await inputAnalyzer.analyzeInput(brandInput);
    spinner.succeed('Análisis inicial completado');

    // Handle ambiguity
    let selectedCategory: string | undefined;
    if (analysis.isAmbiguous && analysis.suggestedCategories) {
      console.log('\n' + chalk.yellow('⚠️  Categorías detectadas:'));
      for (let index = 0; index < analysis.suggestedCategories.length; index++) {
        const category = analysis.suggestedCategories[index];
        console.log(`  ${index + 1}. ${category}`);
      }
      console.log('');
      selectedCategory = await promptCategorySelection(analysis.suggestedCategories);
    }

    // Brand classification
    const classSpinner = ora({ text: 'Clasificando tipo de marca...', spinner: 'dots' }).start();

    // Collect data from all sources in parallel
    const dataResults = await Promise.allSettled([
      wikipediaService.searchBrand(analysis.brandName),
      brandClassifier.classifyBrand(analysis.brandName),
      googleSearchService.searchBrand(analysis.brandName),
      websiteAnalyzerService.analyzeWebsite(analysis.brandUrl, analysis.brandName),
    ]);

    const wikipediaData =
      dataResults[0].status === 'fulfilled' ? dataResults[0].value : { exists: false };
    const llmKnowledge =
      dataResults[1].status === 'fulfilled'
        ? dataResults[1].value
        : {
            knows_brand: false,
            classification: 'unknown' as const,
            confidence: 0,
            known_countries: [],
            continental_presence: [],
            primary_country: null,
            reasoning: 'LLM classification failed',
          };
    const serpApiData =
      dataResults[2].status === 'fulfilled'
        ? dataResults[2].value
        : {
            languages_detected: [],
            domains: [],
            international_media: false,
            trendsData: { top_countries: [], continents: [], top_country_concentration: 100 },
          };
    const websiteData =
      dataResults[3].status === 'fulfilled'
        ? dataResults[3].value
        : { languages_available: 0, has_country_selector: false, multi_domain: false };

    const classificationData: BrandClassificationData = {
      wikipedia: wikipediaData.exists ? wikipediaData : undefined,
      llmDirect: llmKnowledge,
      googleSearch:
        serpApiData.languages_detected.length > 0 || serpApiData.international_media || serpApiData.detected_location
          ? {
              languages_detected: serpApiData.languages_detected,
              domains: serpApiData.domains,
              international_media: serpApiData.international_media,
              detected_location: serpApiData.detected_location,
            }
          : undefined,
      googleTrends: serpApiData.trendsData.continents.length > 0 ? serpApiData.trendsData : undefined,
      officialWebsite:
        websiteData.languages_available > 0 || websiteData.has_country_selector
          ? websiteData
          : undefined,
    };

    const brandTypeAnalysis = await brandTypeDetector.detectBrandType(
      analysis.brandName,
      classificationData,
      analysis
    );

    classSpinner.succeed('Clasificación completada');

    // Display results
    console.log('\n' + chalk.cyan('━'.repeat(60)));
    console.log(chalk.bold('Marca analizada:'), chalk.white.bold(analysis.brandName));
    if (analysis.brandUrl) {
      console.log(chalk.bold('URL:'), chalk.blue(analysis.brandUrl));
    }
    console.log(
      chalk.bold('Categoría:'),
      chalk.white(
        selectedCategory ||
          (analysis.inferredIndustries.length > 0 ? analysis.inferredIndustries[0] : 'Unknown')
      )
    );
    console.log(
      chalk.bold('Tipo:'),
      brandTypeAnalysis.type === 'global'
        ? chalk.magenta.bold('Global Brand')
        : chalk.cyan.bold('Niche Brand')
    );
    console.log(chalk.cyan('━'.repeat(60)) + '\n');

    // Search competitors
    const competitorSpinner = ora({ text: 'Buscando competidores...', spinner: 'dots' }).start();

    const primaryIndustry =
      analysis.inferredIndustries.length > 0 ? analysis.inferredIndustries[0] : 'Unknown';
    const location = analysis.brandUrl
      ? undefined
      : selectedCategory?.includes('Santiago')
        ? 'Santiago, Chile'
        : selectedCategory?.includes('Bogotá') || selectedCategory?.includes('Colombia')
          ? 'Bogotá, Colombia'
          : undefined;

    const competitors = await googleSearchService.searchCompetitors(
      analysis.brandName,
      primaryIndustry,
      brandTypeAnalysis.type,
      location,
      classificationData
    );

    competitorSpinner.succeed(`Encontrados ${competitors.length} competidores\n`);

    if (competitors.length === 0) {
      console.log(chalk.yellow('No se encontraron competidores.\n'));
    } else {
      console.log(chalk.bold('Competidores:\n'));

      for (let index = 0; index < competitors.length; index++) {
        const competitor = competitors[index];
        console.log(chalk.white.bold(`${index + 1}. ${competitor.name}`) + chalk.gray(' (85%)')); // TODO: Real score in Phase 4
        console.log(`   ${chalk.gray(competitor.description)}`);
        console.log('');
      }
    }

    // Note about scoring
    console.log(chalk.gray('━'.repeat(60)));
    console.log(
      chalk.gray(
        'Nota: Scoring en 10 criterios será implementado en la siguiente fase con GPT-5'
      )
    );
    console.log(chalk.gray('━'.repeat(60)) + '\n');
  } catch (error) {
    logger.error('Error in analyze command:', error);
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

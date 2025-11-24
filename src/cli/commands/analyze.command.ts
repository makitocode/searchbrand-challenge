/**
 * Analyze Command - Main CLI command for brand competitor analysis
 */

import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import { inputAnalyzer } from '../../services/llm/input-analyzer.js';
import { wikipediaService } from '../../services/scraping/wikipedia.service.js';
import { brandTypeDetector } from '../../services/analysis/brand-type-detector.js';
import { brandClassifier } from '../../services/llm/brand-classifier.js';
import { googleSearchService } from '../../services/scraping/google-search.service.js';
import { websiteAnalyzerService } from '../../services/scraping/website-analyzer.service.js';
import { competitorAnalyzer } from '../../services/llm/competitor-analyzer.js';
import { promptBrandInput, promptCategorySelection } from '../prompts/interactive-prompts.js';
import { logger } from '../../utils/logger.js';
import { InputAnalysis, BrandClassificationData, CompetitorScore, formatBreakdownDisplay } from '../../types/index.js';
import { brandAnalysisRepository } from '../../services/database/repositories/brand-analysis.repository.js';
import { competitorRepository } from '../../services/database/repositories/competitor.repository.js';
import { brandCacheRepository } from '../../services/database/repositories/brand-cache.repository.js';

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

    // Check if we have a recent analysis for this brand (avoid duplicates)
    const recentAnalysis = await brandAnalysisRepository.getRecentByBrandName(analysis.brandName, 7);

    if (recentAnalysis && recentAnalysis.classification_result) {
      logger.info(`Found recent analysis for ${analysis.brandName} (${recentAnalysis.id})`);
      console.log('\n' + chalk.green('✓ Análisis existente encontrado (menos de 7 días)'));
      console.log(chalk.dim(`  ID: ${recentAnalysis.id}`));
      console.log(chalk.dim(`  Fecha: ${new Date(recentAnalysis.created_at).toLocaleString()}`));

      // Display the existing results
      const enrichedData = recentAnalysis.classification_result as any;

      console.log('\n' + chalk.cyan('━'.repeat(60)));
      console.log(chalk.bold('Marca analizada:'), chalk.white.bold(analysis.brandName));
      if (recentAnalysis.brand_url) {
        console.log(chalk.bold('URL:'), chalk.blue(recentAnalysis.brand_url));
      }
      console.log(
        chalk.bold('Categoría:'),
        chalk.white(recentAnalysis.selected_category || 'N/A')
      );
      console.log(chalk.cyan('━'.repeat(60)));

      console.log('\n' + chalk.bold('Tipo de marca:'), chalk.white.bold(recentAnalysis.analysis_type.toUpperCase()));

      if (enrichedData.brandTypeAnalysis) {
        console.log(chalk.bold('Score:'), chalk.white(`${enrichedData.brandTypeAnalysis.score}/100`));
        console.log(chalk.bold('Confianza:'), chalk.white(`${enrichedData.brandTypeAnalysis.confidence}%`));
        console.log(chalk.bold('Razonamiento:'), chalk.gray(enrichedData.brandTypeAnalysis.reasoning));
      }

      if (enrichedData.competitors && enrichedData.competitors.length > 0) {
        console.log('\n' + chalk.bold('Top Competidores:'));
        console.log('');

        for (let i = 0; i < Math.min(5, enrichedData.competitors.length); i++) {
          const comp = enrichedData.competitors[i];
          console.log(
            chalk.white.bold(`${i + 1}. ${comp.name}`) +
            chalk.gray(` - ${comp.similarityScore}% similitud`)
          );

          if (comp.url) {
            console.log(chalk.dim(`   ${comp.url}`));
          }

          if (comp.evidence && comp.evidence.length > 0) {
            console.log(chalk.gray(`   • ${comp.evidence[0]}`));
          }
          console.log('');
        }
      }

      console.log(chalk.dim('\n💡 Tip: Este análisis tiene menos de 7 días. Los datos se reutilizan para ahorrar tiempo y costos.\n'));
      return;
    }

    // Handle ambiguity
    let selectedCategory: string | undefined;
    if (analysis.isAmbiguous && analysis.suggestedCategories) {
      console.log('\n' + chalk.yellow('Categorías detectadas:'));
      for (let index = 0; index < analysis.suggestedCategories.length; index++) {
        const category = analysis.suggestedCategories[index];
        console.log(`  ${index + 1}. ${category}`);
      }
      console.log('');
      selectedCategory = await promptCategorySelection(analysis.suggestedCategories);
    }

    // Brand classification
    const classSpinner = ora({ text: 'Clasificando tipo de marca...', spinner: 'dots' }).start();

    // Check cache first to avoid redundant API calls
    const cachedClassification = await brandCacheRepository.get(analysis.brandName);

    let brandTypeAnalysis;
    let classificationData: BrandClassificationData;

    if (cachedClassification) {
      logger.info(`Brand cache HIT: ${analysis.brandName}`);
      classSpinner.succeed('Clasificación completada (desde cache)');

      // Use cached classification
      brandTypeAnalysis = {
        type: cachedClassification.classification_data.brandType,
        score: cachedClassification.classification_data.score,
        confidence: cachedClassification.classification_data.confidence,
        reasoning: cachedClassification.classification_data.reasoning,
        breakdown: cachedClassification.classification_data.breakdown,
        signals: {
          globalIndicators: 0,
          nicheIndicators: 0,
        },
      };
      classificationData = cachedClassification.classification_data.sources;
    } else {
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

      classificationData = {
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

      brandTypeAnalysis = await brandTypeDetector.detectBrandType(
        analysis.brandName,
        classificationData,
        analysis,
        analysis.brandUrl
      );

      classSpinner.succeed('Clasificación completada');
    }

    // Determine primary industry
    const primaryIndustry =
      analysis.inferredIndustries.length > 0 ? analysis.inferredIndustries[0] : 'Unknown';

    // Create analysis record in database (fire and forget - non-blocking)
    const analysisId = await brandAnalysisRepository.create({
      user_id: null, // For CLI, user_id is null (API will use real UUID)
      input_brand: brandInput,
      input_type: analysis.inputType,
      brand_name: analysis.brandName,
      brand_url: analysis.brandUrl,
      industry: primaryIndustry,
      selected_category: selectedCategory || (analysis.inferredIndustries.length > 0 ? analysis.inferredIndustries[0] : 'Unknown'),
      analysis_type: brandTypeAnalysis.type,
      input_analysis: analysis
    }).catch(err => {
      logger.debug('Failed to create analysis record:', err);
      return null;
    });

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

    // Determine final location for display (from classification data or user input)
    let finalLocation: string | undefined = location;
    if (!finalLocation && classificationData?.googleSearch?.detected_location) {
      const detectedLoc = classificationData.googleSearch.detected_location;
      if (detectedLoc.city && detectedLoc.country) {
        finalLocation = `${detectedLoc.city}, ${detectedLoc.country}`;
      } else if (detectedLoc.country) {
        finalLocation = detectedLoc.country;
      }
    }

    competitorSpinner.succeed(`Encontrados ${competitors.length} competidores\n`);

    if (competitors.length === 0) {
      console.log(chalk.yellow('No se encontraron competidores.\n'));
      return;
    }

    // Analyze competitors with Claude for scoring
    const scoringSpinner = ora({ text: 'Analizando similitud con Claude...', spinner: 'dots' }).start();

    const scoredCompetitors: CompetitorScore[] = await competitorAnalyzer.analyzeCompetitors(
      {
        name: analysis.brandName,
        url: analysis.brandUrl,
        industry: primaryIndustry,
        brandType: brandTypeAnalysis.type,
        location: finalLocation,
      },
      competitors
    );

    scoringSpinner.succeed('Análisis de similitud completado\n');

    // Display scored competitors
    console.log(chalk.bold('Top Competidores:\n'));

    for (let index = 0; index < Math.min(5, scoredCompetitors.length); index++) {
      const competitor = scoredCompetitors[index];
      const scorePercent = Math.round(competitor.similarityScore);

      // Color based on score
      let scoreColor = chalk.green;
      if (scorePercent < 60) scoreColor = chalk.yellow;
      if (scorePercent < 40) scoreColor = chalk.red;

      console.log(chalk.white.bold(`${index + 1}. ${competitor.name}`) + scoreColor(` - ${scorePercent}% similitud`));
      console.log('');

      // Show breakdown
      const breakdownLines = formatBreakdownDisplay(competitor.breakdown);
      for (const line of breakdownLines) {
        console.log(chalk.gray(line));
      }

      // Show evidence
      if (competitor.evidence && competitor.evidence.length > 0) {
        console.log('');
        console.log(chalk.cyan('   Evidencias:'));
        for (const evidence of competitor.evidence.slice(0, 4)) {
          console.log(`   - ${evidence}`);
        }
      }

      console.log('\n' + chalk.gray('─'.repeat(60)) + '\n');
    }

    // Export results to JSON
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const fileName = `results_${analysis.brandName.toLowerCase().replace(/\s+/g, '_')}_${timestamp}.json`;
    const resultsPath = path.join(process.cwd(), fileName);

    const results = {
      analysis: {
        brand: {
          name: analysis.brandName,
          url: analysis.brandUrl,
          industry: primaryIndustry,
          category: selectedCategory || (analysis.inferredIndustries.length > 0 ? analysis.inferredIndustries[0] : 'Unknown'),
          location: finalLocation,
        },
        brandType: brandTypeAnalysis.type,
        score: brandTypeAnalysis.score,
        confidence: brandTypeAnalysis.confidence,
        timestamp: new Date().toISOString(),
      },
      competitors: scoredCompetitors.map((comp, idx) => ({
        rank: idx + 1,
        name: comp.name,
        url: comp.url,
        similarity_score: comp.similarityScore,
        breakdown: comp.breakdown,
        evidence: comp.evidence,
      })),
      metadata: {
        totalCompetitorsFound: competitors.length,
        topCompetitorsAnalyzed: scoredCompetitors.length,
        dataSources: ['Wikipedia', 'Google Search', 'Google Trends', 'Official Website', 'LLM Direct Knowledge'],
        llmModelsUsed: ['claude-3-5-sonnet-20241022'],
      },
    };

    try {
      await fs.writeFile(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
      console.log(chalk.green(`Resultados guardados en: ${chalk.bold(fileName)}\n`));
    } catch (error) {
      logger.warn('Failed to save results to file:', error);
    }

    // Save enriched data and competitors to database
    if (analysisId) {
      // Save enriched data (for cache reuse)
      const enrichedData: any = {
        brandTypeAnalysis,
        competitors: scoredCompetitors,
      };

      await brandAnalysisRepository.updateEnrichedData(analysisId, enrichedData).catch(err => {
        logger.debug('Failed to save enriched data:', err);
      });

      // Save competitors to separate table
      const competitorsToSave = scoredCompetitors.map((comp, idx) => ({
        competitor_name: comp.name,
        competitor_url: comp.url,
        similarity_score: comp.similarityScore,
        ranking: idx + 1,
        score_breakdown: comp.breakdown,
        evidence: comp.evidence
      }));

      await competitorRepository.saveCompetitors(analysisId, competitorsToSave).catch(err => {
        logger.debug('Failed to save competitors:', err);
      });

      // Mark analysis as completed
      await brandAnalysisRepository.updateStatus(analysisId, 'completed').catch(err => {
        logger.debug('Failed to update analysis status:', err);
      });
    }

    // Summary
    console.log(chalk.gray('━'.repeat(60)));
    console.log(chalk.cyan('Resumen:'));
    console.log(`   - Tipo de marca: ${brandTypeAnalysis.type === 'global' ? chalk.magenta('Global') : chalk.cyan('Nicho')}`);
    console.log(`   - Competidores encontrados: ${chalk.white.bold(competitors.length)}`);
    console.log(`   - Analizados con scoring: ${chalk.white.bold(scoredCompetitors.length)}`);
    console.log(`   - Promedio de similitud: ${chalk.white.bold(Math.round(scoredCompetitors.reduce((sum, c) => sum + c.similarityScore, 0) / scoredCompetitors.length))}%`);
    console.log(chalk.gray('━'.repeat(60)) + '\n');
  } catch (error) {
    logger.error('Error in analyze command:', error);
    console.error(chalk.red('\nError:'), error instanceof Error ? error.message : 'Unknown error');

    // Update analysis status to failed if we have an analysis ID
    // Note: analysisId is not accessible here due to scope, so this is a limitation
    // In a production app, we'd want to refactor to handle this better

    process.exit(1);
  }
}

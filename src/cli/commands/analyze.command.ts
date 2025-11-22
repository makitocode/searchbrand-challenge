/**
 * Analyze Command - Main CLI command for brand competitor analysis
 */

import chalk from 'chalk';
import ora from 'ora';
import { inputAnalyzer } from '../../services/llm/input-analyzer.js';
import { wikipediaService } from '../../services/scraping/wikipedia.service.js';
import { brandTypeDetector } from '../../services/analysis/brand-type-detector.js';
import { brandClassifier } from '../../services/llm/brand-classifier.js';
import { promptBrandInput, promptCategorySelection } from '../prompts/interactive-prompts.js';
import { logger } from '../../utils/logger.js';
import { InputAnalysis, BrandClassificationData } from '../../types/index.js';

/**
 * Display analysis results in a pretty format
 */
function displayAnalysisResults(analysis: InputAnalysis, selectedCategory?: string): void {
  console.log('\n' + chalk.cyan('━'.repeat(60)));
  console.log(chalk.bold.green('✅ ANÁLISIS COMPLETADO'));
  console.log(chalk.cyan('━'.repeat(60)) + '\n');

  console.log(chalk.bold('📋 Información de la Marca:'));
  console.log(`  ${chalk.gray('•')} Nombre: ${chalk.white.bold(analysis.brandName)}`);
  console.log(
    `  ${chalk.gray('•')} Tipo de input: ${chalk.white(analysis.inputType === 'url' ? 'URL' : 'Nombre de marca')}`
  );
  if (analysis.brandUrl) {
    console.log(`  ${chalk.gray('•')} URL: ${chalk.blue(analysis.brandUrl)}`);
  }
  console.log(
    `  ${chalk.gray('•')} Confianza del análisis: ${chalk.yellow(analysis.confidence + '%')}`
  );

  console.log('\n' + chalk.bold('🏭 Industrias Identificadas:'));
  for (let index = 0; index < analysis.inferredIndustries.length; index++) {
    const industry = analysis.inferredIndustries[index];
    console.log(`  ${chalk.gray(index + 1 + '.')} ${chalk.white(industry)}`);
  }

  if (analysis.isAmbiguous) {
    console.log('\n' + chalk.yellow.bold('⚠️  MARCA AMBIGUA DETECTADA'));
    console.log(
      chalk.yellow(
        'Esta marca podría pertenecer a diferentes categorías de negocio.\n' +
          'Se necesita más contexto para identificar competidores precisos.'
      )
    );

    if (selectedCategory) {
      console.log('\n' + chalk.bold('✓ Categoría Seleccionada:'));
      console.log(`  ${chalk.green('→')} ${chalk.white.bold(selectedCategory)}`);
    } else if (analysis.suggestedCategories) {
      console.log('\n' + chalk.bold('💡 Categorías Sugeridas:'));
      for (let index = 0; index < analysis.suggestedCategories.length; index++) {
        const category = analysis.suggestedCategories[index];
        console.log(`  ${chalk.gray(index + 1 + '.')} ${chalk.white(category)}`);
      }
    }
  } else {
    console.log('\n' + chalk.green.bold('✅ MARCA CLARA'));
    console.log(chalk.green('El tipo de negocio está bien definido. Listo para análisis.'));
  }

  console.log('\n' + chalk.cyan('━'.repeat(60)) + '\n');
}

/**
 * Main analyze command
 */
export async function analyzeCommand(): Promise<void> {
  try {
    // Step 1: Get brand input from user
    const brandInput = await promptBrandInput();

    // Step 2: Analyze input with Claude
    const spinner = ora({
      text: chalk.blue('Analizando con Claude AI...'),
      spinner: 'dots',
    }).start();

    let analysis: InputAnalysis;
    try {
      analysis = await inputAnalyzer.analyzeInput(brandInput);
      spinner.succeed(chalk.green('Análisis con Claude completado'));
    } catch (error) {
      spinner.fail(chalk.red('Error al analizar con Claude'));
      throw error;
    }

    // Step 3: Handle ambiguity if detected
    let selectedCategory: string | undefined;
    if (analysis.isAmbiguous && analysis.suggestedCategories) {
      console.log(
        '\n' + chalk.yellow.bold('⚠️  Se detectaron múltiples categorías posibles:\n')
      );
      for (let index = 0; index < analysis.suggestedCategories.length; index++) {
        const category = analysis.suggestedCategories[index];
        console.log(`  ${chalk.white(index + 1)}. ${chalk.cyan(category)}`);
      }
      console.log('');

      selectedCategory = await promptCategorySelection(analysis.suggestedCategories);
      logger.info(`User selected category: ${selectedCategory}`);
    }

    // Step 4: Display results
    displayAnalysisResults(analysis, selectedCategory);

    // Step 5: FASE 2 - Multi-Source Data Collection and Brand Classification
    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.bold.cyan('  📍 FASE 2: Clasificación Multi-Fuente'));
    console.log(chalk.cyan('═'.repeat(60)) + '\n');

    const dataSpinner = ora({
      text: chalk.blue('Recopilando datos de fuentes disponibles...'),
      spinner: 'dots',
    }).start();

    // Collect data from available sources in parallel
    const [wikipediaData, llmKnowledge] = await Promise.all([
      wikipediaService.searchBrand(analysis.brandName),
      brandClassifier.classifyBrand(analysis.brandName),
    ]);

    dataSpinner.succeed(chalk.green('Datos recopilados'));

    // Display source results
    console.log('\n' + chalk.bold('📊 Fuentes Consultadas:\n'));

    // Wikipedia results
    if (wikipediaData.exists) {
      console.log(chalk.green('  ✓') + chalk.white(' Wikipedia: ') + chalk.yellow(wikipediaData.title));
      if (wikipediaData.categories && wikipediaData.categories.length > 0) {
        console.log(`    ${chalk.gray(`${wikipediaData.categories.length} categorías encontradas`)}`);
      }
    } else {
      console.log(chalk.yellow('  ✗') + chalk.white(' Wikipedia: ') + chalk.gray('No encontrada'));
    }

    // LLM Direct results
    if (llmKnowledge.knows_brand) {
      console.log(
        chalk.green('  ✓') +
          chalk.white(' LLM Directo: ') +
          chalk.yellow(`Conoce la marca (${llmKnowledge.confidence}% confianza)`)
      );
      if (llmKnowledge.continental_presence.length > 0) {
        console.log(
          `    ${chalk.gray(`Presencia: ${llmKnowledge.continental_presence.join(', ')}`)}`
        );
      }
    } else {
      console.log(
        chalk.yellow('  ✗') +
          chalk.white(' LLM Directo: ') +
          chalk.gray('No conoce la marca o baja confianza')
      );
    }

    // Note about missing sources
    console.log(chalk.gray('  ○ Google Search: No disponible (próxima fase)'));
    console.log(chalk.gray('  ○ Google Trends: No disponible (próxima fase)'));
    console.log(chalk.gray('  ○ Sitio Oficial: No disponible (próxima fase)'));

    // Step 6: Brand Type Detection with multi-source
    console.log(chalk.cyan('\n' + '━'.repeat(60)));
    console.log(chalk.bold.cyan('  🔍 Clasificación de Marca'));
    console.log(chalk.cyan('━'.repeat(60)) + '\n');

    const typeSpinner = ora({
      text: chalk.blue('Calculando clasificación...'),
      spinner: 'dots',
    }).start();

    // Prepare classification data
    const classificationData: BrandClassificationData = {
      wikipedia: wikipediaData.exists ? wikipediaData : undefined,
      llmDirect: llmKnowledge,
      // Google Search, Trends, and Website will be added in next phase
    };

    const brandTypeAnalysis = await brandTypeDetector.detectBrandType(
      analysis.brandName,
      classificationData,
      analysis
    );

    const typeColor = brandTypeAnalysis.type === 'global' ? chalk.magenta : chalk.cyan;
    typeSpinner.succeed(
      chalk.green('Clasificación: ') +
        typeColor.bold(brandTypeAnalysis.type.toUpperCase()) +
        chalk.gray(` (${brandTypeAnalysis.score}/100 pts, ${brandTypeAnalysis.confidence}% confianza)`)
    );

    // Display score breakdown
    console.log('\n' + chalk.bold('📈 Desglose de Puntos:'));
    console.log(`  ${chalk.gray('•')} Wikipedia:      ${chalk.yellow(brandTypeAnalysis.breakdown.wikipedia + '/25')}`);
    console.log(`  ${chalk.gray('•')} LLM Directo:    ${chalk.yellow(brandTypeAnalysis.breakdown.llm_direct + '/25')}`);
    console.log(`  ${chalk.gray('•')} Google Search:  ${chalk.gray(brandTypeAnalysis.breakdown.google_search + '/20')} ${chalk.gray('(pendiente)')}`);
    console.log(`  ${chalk.gray('•')} Google Trends:  ${chalk.gray(brandTypeAnalysis.breakdown.google_trends + '/20')} ${chalk.gray('(pendiente)')}`);
    console.log(`  ${chalk.gray('•')} Sitio Oficial:  ${chalk.gray(brandTypeAnalysis.breakdown.official_website + '/15')} ${chalk.gray('(pendiente)')}`);
    console.log(`  ${chalk.gray('•')} ${chalk.bold('Total:          ' + chalk.yellow(brandTypeAnalysis.score + '/100'))}`);

    // Display reasoning
    console.log('\n' + chalk.bold('💡 Justificación:'));
    console.log(`  ${chalk.white(brandTypeAnalysis.reasoning)}`);

    // Final summary
    console.log(chalk.cyan('\n' + '═'.repeat(60)));
    console.log(chalk.bold.green('✅ FASE 2 COMPLETADA'));
    console.log(chalk.cyan('═'.repeat(60)) + '\n');

    console.log(chalk.bold('📊 Resumen:'));
    console.log(`  ${chalk.gray('•')} Marca: ${chalk.white.bold(analysis.brandName)}`);
    console.log(`  ${chalk.gray('•')} Tipo: ${typeColor.bold(brandTypeAnalysis.type.toUpperCase())}`);
    console.log(`  ${chalk.gray('•')} Score: ${chalk.yellow(brandTypeAnalysis.score + '/100')}`);
    console.log(`  ${chalk.gray('•')} Confianza: ${chalk.yellow(brandTypeAnalysis.confidence + '%')}`);
    if (selectedCategory) {
      console.log(`  ${chalk.gray('•')} Categoría: ${chalk.white(selectedCategory)}`);
    }

    // Next steps
    console.log('\n' + chalk.gray('━'.repeat(60)));
    console.log(
      chalk.bold.magenta('🚀 Próximos Pasos (FASE 3):') +
        '\n  • Búsqueda en Google\n  • Scraping de sitios web\n  • Extracción de metadata de competidores'
    );
    console.log(chalk.gray('━'.repeat(60)) + '\n');
  } catch (error) {
    logger.error('Error in analyze command:', error);
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

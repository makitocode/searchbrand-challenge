/**
 * Analyze Command - Main CLI command for brand competitor analysis
 */

import chalk from 'chalk';
import ora from 'ora';
import { inputAnalyzer } from '../../services/llm/input-analyzer';
import { promptBrandInput, promptCategorySelection } from '../prompts/interactive-prompts';
import { logger } from '../../utils/logger';
import { InputAnalysis } from '../../types';

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
  analysis.inferredIndustries.forEach((industry, index) => {
    console.log(`  ${chalk.gray(index + 1 + '.')} ${chalk.white(industry)}`);
  });

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
      analysis.suggestedCategories.forEach((category, index) => {
        console.log(`  ${chalk.gray(index + 1 + '.')} ${chalk.white(category)}`);
      });
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
      analysis.suggestedCategories.forEach((category, index) => {
        console.log(`  ${chalk.white(index + 1)}. ${chalk.cyan(category)}`);
      });
      console.log('');

      selectedCategory = await promptCategorySelection(analysis.suggestedCategories);
      logger.info(`User selected category: ${selectedCategory}`);
    }

    // Step 4: Display results
    displayAnalysisResults(analysis, selectedCategory);

    // Step 5: Next steps message
    console.log(chalk.gray('━'.repeat(60)));
    console.log(
      chalk.bold.magenta('🚀 Próximos Pasos (FASE 2):') +
        '\n  • Búsqueda en Wikipedia\n  • Detección de tipo de marca (Global vs Nicho)\n  • Identificación de competidores mencionados'
    );
    console.log(chalk.gray('━'.repeat(60)) + '\n');
  } catch (error) {
    logger.error('Error in analyze command:', error);
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

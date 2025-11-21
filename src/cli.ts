#!/usr/bin/env node

/**
 * SearchBrand CLI Entry Point
 * Interactive command-line interface for brand competitor analysis
 */

import chalk from 'chalk';
import { analyzeCommand } from './cli/commands/analyze.command';
import { promptContinue } from './cli/prompts/interactive-prompts';
import { logger } from './utils/logger';

/**
 * Display welcome banner
 */
function displayWelcomeBanner(): void {
  console.log('\n' + chalk.cyan('═'.repeat(60)));
  console.log(
    chalk.bold.cyan('  🔍 SearchBrand') +
      chalk.white(' - Competitor Intelligence Tool')
  );
  console.log(chalk.gray('  Powered by Claude AI + GPT-5'));
  console.log(chalk.cyan('═'.repeat(60)) + '\n');
  console.log(
    chalk.yellow('  📍 FASE 1:') +
      chalk.white(' Análisis de Input con IA') +
      '\n'
  );
}

/**
 * Main CLI entry point
 */
async function main() {
  try {
    displayWelcomeBanner();

    // Main loop - allows analyzing multiple brands
    let continueAnalyzing = true;

    while (continueAnalyzing) {
      await analyzeCommand();

      // Ask if user wants to continue
      continueAnalyzing = await promptContinue();

      if (continueAnalyzing) {
        console.log('\n' + chalk.gray('─'.repeat(60)) + '\n');
      }
    }

    // Goodbye message
    console.log('\n' + chalk.green('✓ ¡Gracias por usar SearchBrand!'));
    console.log(chalk.gray('  Desarrollado por Miguel González\n'));
    logger.info('CLI session ended by user');
  } catch (error) {
    logger.error('Fatal error in CLI:', error);
    console.error(
      chalk.red('\n❌ Error fatal:'),
      error instanceof Error ? error.message : 'Unknown error'
    );
    process.exit(1);
  }
}

main();

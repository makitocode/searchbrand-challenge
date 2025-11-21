/**
 * Interactive CLI Prompts using Inquirer
 */

import inquirer from 'inquirer';

/**
 * Prompt user for brand input
 */
export async function promptBrandInput(): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'brand',
      message: '¿Qué marca quieres analizar?',
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return 'Por favor ingresa un nombre de marca o URL';
        }
        if (input.trim().length > 100) {
          return 'El nombre de la marca es demasiado largo';
        }
        return true;
      },
    },
  ]);

  return answers.brand.trim();
}

/**
 * Prompt user to select category from suggested list
 */
export async function promptCategorySelection(categories: string[]): Promise<string> {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'category',
      message: 'Selecciona la categoría correcta:',
      choices: categories,
    },
  ]);

  return answers.category;
}

/**
 * Ask if user wants to analyze another brand
 */
export async function promptContinue(): Promise<boolean> {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'continue',
      message: '¿Deseas analizar otra marca?',
      default: false,
    },
  ]);

  return answers.continue;
}

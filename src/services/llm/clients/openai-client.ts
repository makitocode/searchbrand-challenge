/**
 * OpenAI GPT-5 API Client
 * Configured with API key from environment
 */

import OpenAI from 'openai';
import { config } from '../../../utils/config';
import { logger } from '../../../utils/logger';

export const openaiClient = new OpenAI({
  apiKey: config.openaiApiKey,
});

/**
 * Helper function to call GPT-5 with consistent settings
 */
export async function callGPT5(
  prompt: string,
  systemPrompt?: string,
  temperature: number = 0.7
): Promise<string> {
  try {
    logger.debug(`Calling GPT API with model: ${config.openaiModel}`);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await openaiClient.chat.completions.create({
      model: config.openaiModel,
      messages,
      temperature,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in GPT-5 response');
    }

    logger.debug('GPT-5 API call successful');
    return content;
  } catch (error) {
    logger.error('GPT-5 API call failed:', error);
    throw error;
  }
}

/**
 * Helper function to call GPT-5 with structured JSON output
 */
export async function callGPT5WithStructuredOutput<T>(
  prompt: string,
  _schema: Record<string, unknown>,
  systemPrompt?: string
): Promise<T> {
  try {
    logger.debug(`Calling GPT API with structured output, model: ${config.openaiModel}`);

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await openaiClient.chat.completions.create({
      model: config.openaiModel,
      messages,
      temperature: 0.3, // Más bajo para JSON estructurado
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in GPT-5 response');
    }

    logger.debug('GPT-5 structured output call successful');
    return JSON.parse(content) as T;
  } catch (error) {
    logger.error('GPT-5 structured output call failed:', error);
    throw error;
  }
}

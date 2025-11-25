/**
 * Anthropic Claude API Client
 * Configured with API key from environment
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../../utils/config.js';
import { logger } from '../../../utils/logger.js';

export const claudeClient = new Anthropic({
  apiKey: config.anthropicApiKey,
});

/**
 * Helper function to call Claude with consistent settings
 */
export async function callClaude(prompt: string, systemPrompt?: string): Promise<string> {
  try {
    logger.debug(`Calling Claude API with model: ${config.anthropicModel}`);

    const response = await claudeClient.messages.create({
      model: config.anthropicModel,
      max_tokens: 2000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    logger.debug('Claude API call successful');
    return content.text;
  } catch (error) {
    logger.error('Claude API call failed:', error);
    throw error;
  }
}

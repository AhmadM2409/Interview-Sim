export type { LLMMessage, LLMProvider, LLMRequestOptions, LLMResponse } from './types';

import { env } from '../env';
import { GeminiProvider } from './gemini';
import { MistralProvider } from './mistral';
import { OpenAIProvider } from './openai';
import type { LLMProvider } from './types';

let _provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (_provider) return _provider;

  switch (env.llmProvider) {
    case 'gemini':
      _provider = new GeminiProvider(env.geminiApiKey, env.geminiModel);
      break;
    case 'mistral':
      _provider = new MistralProvider(env.mistralApiKey, env.mistralModel);
      break;
    case 'openai':
    default:
      _provider = new OpenAIProvider(env.openaiApiKey, env.openaiModel, env.openaiBaseUrl);
  }

  return _provider;
}

export function resetLLMProvider() {
  _provider = null;
}

import { createServerFn } from '@tanstack/react-start';
import { arrayBufferToBase64, textToSpeech } from '../services/elevenlabs';
import { ttsRequestSchema } from '../schemas';
import type { TTSResult } from '../types';

export const ttsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => ttsRequestSchema.parse(data))
  .handler(async ({ data }): Promise<TTSResult> => {
    const buffer = await textToSpeech(data.text, data.voiceId);
    return { audioBase64: arrayBufferToBase64(buffer) };
  });

import { createServerFn } from '@tanstack/react-start';
import { speechToText } from '../services/stt';
import { sttRequestSchema } from '../schemas';
import type { STTResult } from '../types';

export const sttFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => sttRequestSchema.parse(data))
  .handler(async ({ data }): Promise<STTResult> => {
    const transcript = await speechToText(data.audioBase64, data.mimeType);
    return { transcript };
  });

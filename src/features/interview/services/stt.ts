import { env } from '../../../shared/lib/env';
import { withRetry } from '../../../shared/lib/resilience/retry';

export async function speechToText(audioBase64: string, mimeType = 'audio/webm'): Promise<string> {
  const apiKey = env.openaiApiKey;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured (required for Whisper STT)');

  return withRetry(
    async () => {
      // Decode base64 to binary
      const binaryStr = atob(audioBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: mimeType });
      const form = new FormData();
      form.append('file', blob, 'audio.webm');
      form.append('model', 'whisper-1');
      form.append('language', 'en');

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`);

      const data = (await res.json()) as { text: string };
      return data.text.trim();
    },
    { maxAttempts: 3, baseDelayMs: 500 },
  );
}

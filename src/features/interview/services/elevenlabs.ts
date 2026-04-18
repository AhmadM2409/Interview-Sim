import { env } from '../../../shared/lib/env';
import { withRetry } from '../../../shared/lib/resilience/retry';

export async function textToSpeech(text: string, voiceId?: string): Promise<ArrayBuffer> {
  if (!env.elevenlabsApiKey) {
    throw new Error('ELEVENLABS_API_KEY is not configured');
  }

  const voice = voiceId ?? env.elevenlabsVoiceId;

  return withRetry(
    async () => {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': env.elevenlabsApiKey,
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      });

      if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
      return res.arrayBuffer();
    },
    { maxAttempts: 3, baseDelayMs: 1000 },
  );
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

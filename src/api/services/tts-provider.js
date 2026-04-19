import { config } from '../config.js';

export async function synthesizeSpeech(text, voiceId) {
  const targetVoice = voiceId || config.elevenLabsDefaultVoiceId;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${targetVoice}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': config.elevenLabsApiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
      }),
    },
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ElevenLabs request failed: ${response.status} ${errorBody}`.trim());
  }

  return Buffer.from(await response.arrayBuffer());
}

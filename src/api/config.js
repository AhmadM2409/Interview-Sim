import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function requireAnyEnv(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value) {
      return value;
    }
  }

  throw new Error(`Missing required environment variable. Expected one of: ${names.join(', ')}`);
}

export const config = {
  port: Number(process.env.PORT || 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  logLevel: process.env.LOG_LEVEL || 'info',

  tavilyApiKey: requireEnv('TAVILY_API_KEY'),
  mistralApiKey: requireAnyEnv(['MISTRAL_API_KEY', 'GEMINI_API_KEY']),
  mistralModel: process.env.MISTRAL_MODEL || 'mistral-small-latest',
  elevenLabsApiKey: requireEnv('ELEVENLABS_API_KEY'),
  // TODO: Wire this to a user-selectable voice field once a voice selector is added to setup UI.
  elevenLabsDefaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
};

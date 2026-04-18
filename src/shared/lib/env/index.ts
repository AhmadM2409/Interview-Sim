function get(key: string): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env ? (process.env[key] ?? '') : '';
  const fromImportMeta =
    typeof import.meta !== 'undefined'
      ? ((import.meta.env as Record<string, string>)[key] ?? '')
      : '';
  return fromProcess || fromImportMeta;
}

// Getters ensure env vars are read at call-time, not module-init time.
// This keeps test stubs (vi.stubEnv) and runtime configuration consistent.
export const env = {
  get supabaseUrl() {
    return get('SUPABASE_URL') || get('VITE_SUPABASE_URL');
  },
  get supabaseKey() {
    return get('SUPABASE_PUBLISHABLE_KEY') || get('VITE_SUPABASE_PUBLISHABLE_KEY');
  },
  get llmProvider() {
    return (get('LLM_PROVIDER') || 'openai') as 'openai' | 'gemini' | 'mistral';
  },
  get openaiApiKey() {
    return get('OPENAI_API_KEY');
  },
  get openaiModel() {
    return get('OPENAI_MODEL') || 'gpt-4o-mini';
  },
  get openaiBaseUrl() {
    return get('OPENAI_BASE_URL') || 'https://api.openai.com/v1';
  },
  get geminiApiKey() {
    return get('GEMINI_API_KEY');
  },
  get geminiModel() {
    return get('GEMINI_MODEL') || 'gemini-1.5-flash';
  },
  get mistralApiKey() {
    return get('MISTRAL_API_KEY');
  },
  get mistralModel() {
    return get('MISTRAL_MODEL') || 'mistral-small';
  },
  get tavilyApiKey() {
    return get('TAVILY_API_KEY');
  },
  get elevenlabsApiKey() {
    return get('ELEVENLABS_API_KEY');
  },
  get elevenlabsVoiceId() {
    return get('ELEVENLABS_VOICE_ID') || 'EXAVITQu4vr4xnSDxMaL';
  },
};

/**
 * TDD-01: LLM schema validation & retry
 * TDD-02: External API exhaustion & fallback (Tavily)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { resetLLMProvider } from '../../../shared/lib/llm';
import { generateInterviewQuestions } from '../services/llm-interview';
import { fetchJobContext } from '../services/tavily';

// ── TDD-01: LLM retry on schema validation failure ─────────────────────────────

describe('TDD-01: LLM schema validation & retry', () => {
  beforeEach(() => {
    resetLLMProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetLLMProvider();
  });

  it('retries on malformed JSON and succeeds on third attempt', async () => {
    let callCount = 0;

    // Mock fetch for OpenAI completions
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('chat/completions')) {
        callCount++;
        const content =
          callCount < 3
            ? 'not valid json at all!!!'
            : JSON.stringify({
                questions: [
                  { question_text: 'Explain the event loop in Node.js.', question_index: 0 },
                  { question_text: 'What is a closure in JavaScript?', question_index: 1 },
                  { question_text: 'Describe REST vs GraphQL.', question_index: 2 },
                  { question_text: 'What is memoization?', question_index: 3 },
                  { question_text: 'Explain Big O notation.', question_index: 4 },
                ],
              });

        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content } }],
            usage: { prompt_tokens: 100, completion_tokens: 50 },
          }),
          text: async () => '',
        };
      }

      return { ok: false, status: 404, text: async () => 'not found' };
    }));

    // Override env to use openai
    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');

    const questions = await generateInterviewQuestions('Software Engineer', 'context');

    expect(questions).toHaveLength(5);
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it('throws after 3 consecutive schema failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('chat/completions')) {
        return {
          ok: true,
          json: async () => ({
            choices: [{ message: { content: '{"wrong_key": []}' } }],
          }),
          text: async () => '',
        };
      }
      return { ok: false, status: 404, text: async () => '' };
    }));

    vi.stubEnv('LLM_PROVIDER', 'openai');
    vi.stubEnv('OPENAI_API_KEY', 'test-key');

    await expect(
      generateInterviewQuestions('Backend Engineer', 'some context'),
    ).rejects.toThrow('invalid question schema');
  });
});

// ── TDD-02: Tavily exhaustion → degraded mode ──────────────────────────────────

describe('TDD-02: Tavily exhaustion & fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to generic context when Tavily times out 3 times', async () => {
    let tavilyCallCount = 0;

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('tavily.com')) {
        tavilyCallCount++;
        throw new Error('Request timeout');
      }
      return { ok: false, status: 404, text: async () => '' };
    }));

    vi.stubEnv('TAVILY_API_KEY', 'test-key');

    const { context, isDegraded } = await fetchJobContext('Data Scientist');

    expect(isDegraded).toBe(true);
    expect(context).toContain('Data Scientist');
    // Tavily should have been retried (maxAttempts=2, so 2 calls per attempt)
    expect(tavilyCallCount).toBeGreaterThanOrEqual(1);
  });

  it('returns degraded=false when Tavily succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('tavily.com')) {
        return {
          ok: true,
          json: async () => ({
            results: [{ title: 'Test', content: 'Content' }],
            answer: 'Good answer',
          }),
          text: async () => '',
        };
      }
      return { ok: false, status: 404, text: async () => '' };
    }));

    vi.stubEnv('TAVILY_API_KEY', 'test-key');

    const { isDegraded } = await fetchJobContext('Data Scientist');
    expect(isDegraded).toBe(false);
  });
});

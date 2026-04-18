import { env } from '../../../shared/lib/env';
import { getLLMProvider } from '../../../shared/lib/llm';
import { RetryExhaustedError, withRetry } from '../../../shared/lib/resilience/retry';
import { evaluationSchema, generatedQuestionsSchema } from '../schemas';
import type { EvaluationOutput, GeneratedQuestionsOutput } from '../schemas';

const QUESTION_COUNT = 5;

export async function generateInterviewQuestions(
  jobRole: string,
  context: string,
): Promise<GeneratedQuestionsOutput['questions']> {
  ensureInterviewLLMConfigured();
  const llm = getLLMProvider();

  for (let attempt = 1; attempt <= 3; attempt++) {
    let response: { content: string };
    try {
      response = await withRetry(
        () =>
          llm.complete({
            messages: [
              {
                role: 'system',
                content: `You are an expert technical interviewer. Generate exactly ${QUESTION_COUNT} interview questions for a ${jobRole} candidate. Return ONLY valid JSON.`,
              },
              {
                role: 'user',
                content: `Context:\n${context}\n\nGenerate ${QUESTION_COUNT} questions as JSON:\n{"questions": [{"question_text": "...", "question_index": 0}, ...]}`,
              },
            ],
            temperature: 0.7,
            maxTokens: 1500,
            responseFormat: 'json_object',
          }),
        { maxAttempts: 2, baseDelayMs: 500 },
      );
    } catch (error) {
      throw normalizeInterviewGenerationError(error);
    }

    const parsed = safeParseJSON(response.content);
    const validated = parsed ? generatedQuestionsSchema.safeParse(parsed) : null;

    if (validated?.success) {
      return validated.data.questions;
    }

    if (attempt === 3) {
      throw new Error(`LLM returned invalid question schema after 3 attempts`);
    }
  }

  throw new Error('Unreachable');
}

export async function evaluateAnswer(
  jobRole: string,
  questionText: string,
  answerText: string,
): Promise<EvaluationOutput> {
  const llm = getLLMProvider();

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await withRetry(
      () =>
        llm.complete({
          messages: [
            {
              role: 'system',
              content: `You are an expert technical interviewer evaluating a ${jobRole} candidate. Score 0-10 and give concise feedback. Return ONLY valid JSON.`,
            },
            {
              role: 'user',
              content: `Question: ${questionText}\n\nAnswer: ${answerText}\n\nReturn JSON: {"score": <0-10>, "feedback": "..."}`,
            },
          ],
          temperature: 0.3,
          maxTokens: 512,
          responseFormat: 'json_object',
        }),
      { maxAttempts: 2, baseDelayMs: 500 },
    );

    const parsed = safeParseJSON(response.content);
    const validated = parsed ? evaluationSchema.safeParse(parsed) : null;

    if (validated?.success) {
      return validated.data;
    }

    if (attempt === 3) {
      throw new Error(`LLM returned invalid evaluation schema after 3 attempts`);
    }
  }

  throw new Error('Unreachable');
}

export async function generateSummaryFeedback(
  jobRole: string,
  questions: Array<{
    question_text: string;
    answer_text: string | null;
    score: number | null;
    feedback: string | null;
  }>,
  totalScore: number,
): Promise<string> {
  const llm = getLLMProvider();

  const qa = questions
    .map(
      (q, i) =>
        `Q${i + 1}: ${q.question_text}\nA: ${q.answer_text ?? '(no answer)'}\nScore: ${q.score ?? 'N/A'}/10`,
    )
    .join('\n\n');

  const response = await withRetry(
    () =>
      llm.complete({
        messages: [
          {
            role: 'system',
            content: `You are an expert interviewer giving final feedback for a ${jobRole} candidate.`,
          },
          {
            role: 'user',
            content: `Overall Score: ${totalScore.toFixed(1)}/10\n\n${qa}\n\nProvide a concise (3-4 sentence) assessment highlighting strengths and areas for improvement.`,
          },
        ],
        temperature: 0.5,
        maxTokens: 300,
      }),
    { maxAttempts: 2, baseDelayMs: 500 },
  );

  return response.content.trim();
}

function safeParseJSON(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Some LLMs wrap JSON in markdown fences
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    }
    return null;
  }
}

function ensureInterviewLLMConfigured() {
  const provider = env.llmProvider;

  if (provider === 'openai') {
    if (!env.openaiApiKey) {
      throw new Error('API issue: LLM API key not set');
    }
    return;
  }

  if (provider === 'gemini') {
    if (!env.geminiApiKey) {
      throw new Error('API issue: LLM API key not set');
    }
    return;
  }

  if (provider === 'mistral') {
    if (!env.mistralApiKey) {
      throw new Error('API issue: LLM API key not set');
    }
    return;
  }

  throw new Error('API issue: AI provider not configured');
}

function normalizeInterviewGenerationError(error: unknown): Error {
  const rawMessage =
    error instanceof RetryExhaustedError && error.lastError instanceof Error
      ? error.lastError.message
      : error instanceof Error
        ? error.message
        : '';

  const message = rawMessage.toLowerCase();

  if (
    message.includes('api key') ||
    message.includes('401') ||
    message.includes('403') ||
    message.includes('unauthorized')
  ) {
    return new Error('API issue: LLM API key not set');
  }

  if (message.includes('provider') && message.includes('configured')) {
    return new Error('API issue: AI provider not configured');
  }

  return new Error('Interview generation unavailable right now');
}

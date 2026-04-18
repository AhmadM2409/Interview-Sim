import { z } from 'zod';

// ── LLM output schemas ─────────────────────────────────────────────────────────

export const generatedQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        question_text: z.string().min(10),
        question_index: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(10),
});

export type GeneratedQuestionsOutput = z.infer<typeof generatedQuestionsSchema>;

export const evaluationSchema = z.object({
  score: z.number().int().min(0).max(10),
  feedback: z.string().min(5),
});

export type EvaluationOutput = z.infer<typeof evaluationSchema>;

// ── API request schemas ────────────────────────────────────────────────────────

export const initRequestSchema = z.object({
  sessionId: z.string().uuid(),
  jobRole: z.string().min(1).max(200),
  userId: z.string().min(1),
});

export const answerRequestSchema = z.object({
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().min(0),
  answerText: z.string().min(1),
  userId: z.string().min(1),
});

export const evaluateRequestSchema = z.object({
  sessionId: z.string().uuid(),
  questionIndex: z.number().int().min(0),
  userId: z.string().min(1),
});

export const completeRequestSchema = z.object({
  sessionId: z.string().uuid(),
  userId: z.string().min(1),
});

export const ttsRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
});

export const sttRequestSchema = z.object({
  audioBase64: z.string().min(1),
  mimeType: z.string().default('audio/webm'),
});

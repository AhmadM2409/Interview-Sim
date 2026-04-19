import { z } from 'zod';

export const questionTypeSchema = z.enum(['verbal', 'coding']);

export const createSessionSchema = z.object({
  role: z.string().trim().min(1),
  level: z.string().trim().min(1),
});

export const evaluateRequestSchema = z
  .object({
    transcript: z.string().optional(),
    code: z.string().optional(),
    language: z.string().trim().min(1).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const transcript = typeof value.transcript === 'string' ? value.transcript.trim() : '';
    const code = typeof value.code === 'string' ? value.code.trim() : '';

    if (!transcript && !code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Either transcript or code is required',
        path: ['transcript'],
      });
    }
  });

export const llmQuestionSchema = z.object({
  questionText: z.string().trim().min(1),
  type: questionTypeSchema.default('verbal'),
  language: z.string().trim().min(1).optional().nullable(),
});

export const evaluationMetricsSchema = z.object({
  technicalScore: z.number().int().min(0).max(100),
  communicationScore: z.number().int().min(0).max(100),
  feedback: z.string().trim().min(1),
});

export const summarySchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  technicalScore: z.number().int().min(0).max(100).nullable().optional(),
  communicationScore: z.number().int().min(0).max(100).nullable().optional(),
  feedbackSummary: z.string().trim().min(1).nullable().optional(),
  strengths: z.array(z.string().trim().min(1)).min(1),
  improvements: z.array(z.string().trim().min(1)).min(1),
});

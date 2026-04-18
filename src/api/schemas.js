import { z } from 'zod';

export const createSessionSchema = z.object({
  role: z.string().trim().min(1),
  level: z.string().trim().min(1),
});

export const evaluateRequestSchema = z.object({
  transcript: z.string().trim().min(1),
});

export const llmQuestionSchema = z.object({
  questionText: z.string().trim().min(1),
});

export const evaluationMetricsSchema = z.object({
  technicalScore: z.number().int().min(0).max(100),
  communicationScore: z.number().int().min(0).max(100),
  feedback: z.string().trim().min(1),
});

export const summarySchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string().trim().min(1)).min(1),
  improvements: z.array(z.string().trim().min(1)).min(1),
});

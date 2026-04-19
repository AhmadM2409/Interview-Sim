import { z } from 'zod';

export const questionTypeSchema = z.enum(['verbal', 'coding']);
export const questionCategorySchema = z.enum([
  'background',
  'behavioral',
  'technical',
  'situational',
  'coding',
]);
export const codingLanguageSchema = z.enum(['javascript', 'typescript', 'python', 'java', 'cpp']);

export const createSessionSchema = z.object({
  role: z.string().trim().min(1),
  level: z.string().trim().min(1),
});

export const assistantMessageSchema = z.object({
  role: z.enum(['assistant', 'candidate']).default('assistant'),
  text: z.string().trim().min(1),
});

export const evaluateRequestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('verbal'),
    transcript: z.string().trim().min(1, 'Transcript is required for verbal answers'),
  }),
  z.object({
    type: z.literal('coding'),
    code: z.string().trim().min(1, 'Code is required for coding answers'),
    language: codingLanguageSchema,
    transcript: z.string().optional().default(''),
    assistantMessages: z.array(assistantMessageSchema).max(8).optional().default([]),
  }),
]);

export const llmQuestionSchema = z.object({
  questionText: z.string().trim().min(1),
  type: questionTypeSchema.default('verbal'),
  category: questionCategorySchema.optional().nullable(),
  language: codingLanguageSchema.optional().nullable(),
});

export const evaluationMetricsSchema = z.object({
  technicalScore: z.number().int().min(0).max(100),
  communicationScore: z.number().int().min(0).max(100),
  feedback: z.string().trim().min(1),
});

export const codingEvaluationSchema = z.object({
  technicalScore: z.number().int().min(0).max(100),
  problemSolvingScore: z.number().int().min(0).max(100),
  communicationScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string().trim().min(1)).min(1).max(4),
  weaknesses: z.array(z.string().trim().min(1)).min(1).max(4),
  edgeCasesMissing: z.array(z.string().trim().min(1)).max(4),
  codeQualityNotes: z.array(z.string().trim().min(1)).min(1).max(4),
  finalFeedback: z.string().trim().min(1),
});

export const codingAssistantRequestSchema = z.object({
  code: z.string().optional().default(''),
  language: codingLanguageSchema.optional(),
  transcript: z.string().optional().default(''),
  assistantMessages: z.array(assistantMessageSchema).max(8).optional().default([]),
  includeAudio: z.boolean().optional().default(false),
});

export const codingAssistantFeedbackSchema = z.object({
  responseText: z.string().trim().min(1),
  goodSignals: z.array(z.string().trim().min(1)).max(3),
  missingOrRisky: z.array(z.string().trim().min(1)).max(3),
  questionableAssumptions: z.array(z.string().trim().min(1)).max(3),
  suggestedNextStep: z.string().trim().min(1),
});

export const summarySchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  technicalScore: z.number().int().min(0).max(100).nullable().optional(),
  communicationScore: z.number().int().min(0).max(100).nullable().optional(),
  feedbackSummary: z.string().trim().min(1).nullable().optional(),
  strengths: z.array(z.string().trim().min(1)).min(1),
  improvements: z.array(z.string().trim().min(1)).min(1),
});

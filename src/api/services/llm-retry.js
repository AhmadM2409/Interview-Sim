import logger from '../logger.js';
import { HttpError } from '../errors.js';
import { llmQuestionSchema, evaluationMetricsSchema, summarySchema } from '../schemas.js';
import { generateQuestion, evaluateAnswer, generateSummary } from './llm-provider.js';

const normalizeIssues = (error) => {
  if (error?.issues) {
    return error.issues;
  }

  return [{ message: error?.message ?? 'Unknown validation error' }];
};

const actionFailureMessage = (actionName) => {
  if (actionName === 'generateSummary') {
    return 'Summary generation failed after schema validation retries';
  }

  if (actionName === 'generateQuestion') {
    return 'Question generation failed after schema validation retries';
  }

  return 'Evaluation failed after schema validation retries';
};

const actionProviderUnavailableMessage = (actionName, providerMessage) => {
  if (actionName === 'generateSummary') {
    return `Summary provider unavailable: ${providerMessage}`;
  }

  if (actionName === 'generateQuestion') {
    return `Question provider unavailable: ${providerMessage}`;
  }

  return `Evaluation provider unavailable: ${providerMessage}`;
};

const runWithValidationRetry = async ({ actionName, sessionId, schema, runner }) => {
  let attempt = 0;
  let lastProviderError = null;

  while (attempt < 2) {
    attempt += 1;

    let rawOutput;
    try {
      rawOutput = await runner(attempt);
      lastProviderError = null;
    } catch (error) {
      lastProviderError = error;
      logger.warn(
        {
          checkpoint: 'evaluate.provider.call.failed',
          actionName,
          sessionId,
          attempt,
          errorMessage: error?.message,
          errorStack: error?.stack,
          statusCode: error?.statusCode,
        },
        'LLM provider call failed',
      );

      if (attempt >= 2) {
        const statusCode =
          typeof lastProviderError?.statusCode === 'number' && lastProviderError.statusCode >= 400
            ? lastProviderError.statusCode
            : 503;
        const providerMessage =
          lastProviderError?.publicMessage ??
          actionProviderUnavailableMessage(actionName, lastProviderError?.message ?? 'Unknown provider error');
        throw new HttpError(
          statusCode,
          providerMessage,
        );
      }

      continue;
    }

    try {
      const parsed = schema.parse(rawOutput);
      logger.info(
        {
          checkpoint: 'evaluate.zod.parse.passed',
          actionName,
          sessionId,
          attempt,
        },
        'LLM output passed schema validation',
      );
      return parsed;
    } catch (error) {
      logger.warn(
        {
          checkpoint: 'evaluate.zod.parse.failed',
          actionName,
          sessionId,
          attempt,
          error: normalizeIssues(error),
          errorMessage: error?.message,
          errorStack: error?.stack,
        },
        'LLM Schema Validation Failed',
      );

      if (attempt >= 2) {
        throw new HttpError(500, actionFailureMessage(actionName));
      }
    }
  }

  throw new HttpError(500, actionFailureMessage(actionName));
};

export const generateQuestionWithRetry = async (role, sessionId, context = '') =>
  runWithValidationRetry({
    actionName: 'generateQuestion',
    sessionId,
    schema: llmQuestionSchema,
    runner: (attempt) => generateQuestion({ role, sessionId, context, attempt }),
  });

export const evaluateAnswerWithRetry = async (sessionId, transcript) =>
  runWithValidationRetry({
    actionName: 'evaluateAnswer',
    sessionId,
    schema: evaluationMetricsSchema,
    runner: (attempt) => evaluateAnswer({ sessionId, transcript, attempt }),
  });

export const generateSummaryWithRetry = async (sessionId, role, responses) =>
  runWithValidationRetry({
    actionName: 'generateSummary',
    sessionId,
    schema: summarySchema,
    runner: (attempt) => generateSummary({ sessionId, role, responses, attempt }),
  });

import { ZodError } from 'zod';
import { errorEnvelope } from '../response.js';
import logger from '../logger.js';

export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json(errorEnvelope(`Validation error: ${err.issues[0]?.message ?? 'Invalid request'}`));
    return;
  }

  if (err?.statusCode) {
    logger.error(
      {
        checkpoint: 'api.error.http',
        statusCode: err.statusCode,
        errorMessage: err.message,
        errorStack: err.stack,
      },
      'Handled HTTP error',
    );
    res.status(err.statusCode).json(errorEnvelope(err.message));
    return;
  }

  logger.error(
    {
      checkpoint: 'api.error.unhandled',
      errorMessage: err?.message,
      errorStack: err?.stack,
    },
    'Unhandled API error',
  );
  res.status(500).json(errorEnvelope('Internal server error'));
};

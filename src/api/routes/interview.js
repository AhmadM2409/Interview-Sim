import { Router } from 'express';
import { HttpError } from '../errors.js';
import { createSessionSchema } from '../schemas.js';
import { successEnvelope } from '../response.js';
import logger from '../logger.js';
import {
  completeSession,
  createSession,
  createNextQuestion,
  evaluateSessionAnswer,
  getCurrentQuestionAudio,
  getCurrentQuestion,
  getSummary,
  listSessionHistory,
  withSessionLock,
} from '../services/interview-service.js';
import { evaluateRequestSchema } from '../schemas.js';

const router = Router();

router.post('/session', async (req, res, next) => {
  try {
    const payload = createSessionSchema.parse(req.body ?? {});
    const result = await createSession({
      ...payload,
      userSub: req.user?.sub,
    });

    res.status(200).json(successEnvelope(result));
  } catch (error) {
    next(error);
  }
});

router.get('/history', async (req, res, next) => {
  try {
    const result = await listSessionHistory(req.user?.sub);
    res.status(200).json(successEnvelope(result));
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/question/current', async (req, res, next) => {
  try {
    const question = await getCurrentQuestion(req.params.sessionId);
    res.status(200).json(successEnvelope(question));
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/question/current/audio', async (req, res, next) => {
  try {
    const audio = await getCurrentQuestionAudio(req.params.sessionId);
    res.status(200).json(successEnvelope(audio));
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/question/next', async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const forceTavilyTimeout = req.headers['x-test-force-tavily-timeout'] === 'true';
    const forceInternalError = req.headers['x-test-force-internal-error'] === 'true';

    const question = await withSessionLock(sessionId, async () => {
      if (forceInternalError) {
        throw new HttpError(500, 'Forced internal error');
      }

      return createNextQuestion(sessionId, { forceTavilyTimeout });
    });

    res.status(200).json(successEnvelope(question));
  } catch (error) {
    next(error);
  }
});

router.post('/:sessionId/evaluate', async (req, res, next) => {
  try {
    logger.info(
      {
        checkpoint: 'evaluate.request.received',
        sessionId: req.params.sessionId,
      },
      'Evaluate request received',
    );

    const payload = evaluateRequestSchema.parse(req.body ?? {});
    logger.info(
      {
        checkpoint: 'evaluate.request.validated',
        sessionId: req.params.sessionId,
      },
      'Evaluate request validated',
    );

    const forceTavilyTimeout = req.headers['x-test-force-tavily-timeout'] === 'true';
    const forceInternalError = req.headers['x-test-force-internal-error'] === 'true';

    const result = await evaluateSessionAnswer(req.params.sessionId, payload, {
      forceTavilyTimeout,
      forceInternalError,
    });

    logger.info(
      {
        checkpoint: 'evaluate.response.returned',
        sessionId: req.params.sessionId,
      },
      'Evaluate response returned',
    );
    res.status(200).json(successEnvelope(result));
  } catch (error) {
    logger.error(
      {
        checkpoint: 'evaluate.route.error',
        sessionId: req.params.sessionId,
        errorMessage: error?.message,
        errorStack: error?.stack,
      },
      'Evaluate route failed',
    );
    next(error);
  }
});

router.post('/:sessionId/complete', async (req, res, next) => {
  try {
    logger.info(
      {
        checkpoint: 'complete.request.received',
        sessionId: req.params.sessionId,
      },
      'Complete request received',
    );
    const result = await completeSession(req.params.sessionId);
    logger.info(
      {
        checkpoint: 'complete.response.returned',
        sessionId: req.params.sessionId,
      },
      'Complete response returned',
    );
    res.status(200).json(successEnvelope(result));
  } catch (error) {
    next(error);
  }
});

router.get('/:sessionId/summary', async (req, res, next) => {
  try {
    const result = await getSummary(req.params.sessionId);
    res.status(200).json(successEnvelope(result));
  } catch (error) {
    next(error);
  }
});

export default router;

import { requestJson } from '../../shared/api/client.js';

export const createInterviewSession = ({ token, role, level }) =>
  requestJson('/api/interview/session', {
    method: 'POST',
    token,
    body: { role, level },
  });

export const getCurrentInterviewQuestion = ({ token, sessionId }) =>
  requestJson(`/api/interview/${sessionId}/question/current`, {
    token,
  });

export const getCurrentQuestionAudio = ({ token, sessionId }) =>
  requestJson(`/api/interview/${sessionId}/question/current/audio`, {
    token,
  });

export const evaluateInterviewAnswer = ({ token, sessionId, transcript, code, language }) =>
  requestJson(`/api/interview/${sessionId}/evaluate`, {
    method: 'POST',
    token,
    body: {
      ...(typeof transcript === 'string' ? { transcript } : {}),
      ...(typeof code === 'string' ? { code } : {}),
      ...(language ? { language } : {}),
    },
  });

export const getNextInterviewQuestion = ({ token, sessionId }) =>
  requestJson(`/api/interview/${sessionId}/question/next`, {
    method: 'POST',
    token,
  });

export const completeInterviewSession = ({ token, sessionId }) =>
  requestJson(`/api/interview/${sessionId}/complete`, {
    method: 'POST',
    token,
  });

export const getInterviewSummary = ({ token, sessionId }) =>
  requestJson(`/api/interview/${sessionId}/summary`, {
    token,
  });

export const getInterviewHistory = ({ token }) =>
  requestJson('/api/interview/history', {
    token,
  });

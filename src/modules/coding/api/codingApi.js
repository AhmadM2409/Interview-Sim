import { requestJson } from '../../shared/api/client.js';

export const initializeCodingSetup = ({ token, language, problem }) =>
  requestJson('/api/coding/setup', {
    method: 'POST',
    token,
    body: { language, problem },
  });

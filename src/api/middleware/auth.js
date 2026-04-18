import { HttpError } from '../errors.js';
import { isValidAuthToken } from '../services/auth0.js';

export const authMiddleware = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new HttpError(401, 'Unauthorized'));
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  if (!isValidAuthToken(token)) {
    next(new HttpError(401, 'Unauthorized'));
    return;
  }

  req.user = { sub: 'google-oauth2|mock-user' };
  next();
};

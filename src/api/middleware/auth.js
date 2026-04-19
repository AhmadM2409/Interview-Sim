import { HttpError } from '../errors.js';
import { isValidAuthToken } from '../services/auth0.js';

export const authMiddleware = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new HttpError(401, 'Unauthorized'));
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();

  try {
    const isValid = await isValidAuthToken(token);
    if (!isValid) {
      next(new HttpError(401, 'Unauthorized'));
      return;
    }

    req.user = { sub: 'google-oauth2|mock-user' };
    next();
  } catch (error) {
    next(new HttpError(401, 'Unauthorized'));
  }
};

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { successEnvelope } from './response.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import interviewRouter from './routes/interview.js';
import codingRouter from './routes/coding.js';
import { config } from './config.js';

dotenv.config();

const app = express();
const loopbackOriginPattern = /^http:\/\/127\.0\.0\.1(?::\d+)?$/;
const isAllowedOrigin = (origin) =>
  config.allowedOrigins.includes(origin) || loopbackOriginPattern.test(origin);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }

    if (isAllowedOrigin(origin)) {
      return callback(null, origin);
    }

    return callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json(successEnvelope({ ok: true }));
});

app.use('/api/interview', authMiddleware, interviewRouter);
app.use('/api/coding', authMiddleware, codingRouter);
app.use(errorHandler);

export default app;

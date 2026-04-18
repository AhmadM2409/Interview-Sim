import pino from 'pino';
import { config } from './config.js';

const logger = pino({
  name: 'ai-interview-simulator',
  level: config.logLevel,
});

export default logger;

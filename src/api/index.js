import dotenv from 'dotenv';
import app from './server.js';
import { createNewDBInstance } from './db.js';
import { config } from './config.js';

dotenv.config();

await createNewDBInstance();

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${config.port}`);
});

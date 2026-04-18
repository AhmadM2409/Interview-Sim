import { Router } from 'express';
import { successEnvelope } from '../response.js';

const router = Router();

router.post('/setup', (_req, res) => {
  res.status(200).json(
    successEnvelope({
      mode: 'coding',
      status: 'stub',
      message: 'Coding setup scaffold ready for UI integration.',
    }),
  );
});

export default router;

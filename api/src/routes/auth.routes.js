import express from 'express';
import { loginRateLimit } from '../middleware/rate-limits.js';
import requireAuth from '../middleware/require-auth.js';
import * as controller from '../controllers/auth.controller.js';

const router = express.Router();

router.post('/login', ...loginRateLimit, controller.login);
router.get('/me', requireAuth, controller.me);

export default router;

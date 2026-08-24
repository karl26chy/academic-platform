import express from 'express';
import requireAuth from '../middleware/require-auth.js';
import * as controller from '../controllers/achievement.controller.js';

const router = express.Router();

router.get('/assignments/:assignmentId/achievements', requireAuth, controller.getAchievement);
router.put('/assignments/:assignmentId/achievements', requireAuth, controller.upsertAchievement);

export default router;

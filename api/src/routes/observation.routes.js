import express from 'express';
import requireAuth from '../middleware/require-auth.js';
import * as controller from '../controllers/observation.controller.js';

const router = express.Router();

router.get('/students/:studentId/observations', requireAuth, controller.getObservation);
router.put('/students/:studentId/observations', requireAuth, controller.upsertObservation);

export default router;

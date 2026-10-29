import express from 'express';
import requireAuth from '../middleware/require-auth.js';
import * as controller from '../controllers/period-final-grades.controller.js';

/** "Notas boletín" (TEMPORAL): definitivas de periodos anteriores por clase. */
const router = express.Router();

router.get('/assignments/:assignmentId/period-final-grades', requireAuth, controller.getForClass);
router.put('/assignments/:assignmentId/period-final-grades', requireAuth, controller.saveForClass);

export default router;

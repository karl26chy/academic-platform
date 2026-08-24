import express from 'express';
import requireAuth from '../middleware/require-auth.js';
import * as controller from '../controllers/report-config.controller.js';

const router = express.Router();

router.get('/institutions/:id/report-config', requireAuth, controller.getReportConfig);
router.post('/institutions/:id/report-config', requireAuth, controller.upsertReportConfig);

export default router;

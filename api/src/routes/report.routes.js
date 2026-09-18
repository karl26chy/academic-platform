import express from 'express';
import requireAuth from '../middleware/require-auth.js';
import * as controller from '../controllers/report.controller.js';

const router = express.Router();

router.get('/students/:studentId/report', requireAuth, controller.getReport);
router.get('/students/:studentId/report/pdf', requireAuth, controller.getReportPDF);

/**
 * Generación masiva de boletines de un grado.
 * GET /grades/:gradeId/bulk-report/pdf?anio=2026
 * Solo admin de la institución; el service valida que el grado pertenezca a la institución.
 */
router.get('/grades/:gradeId/bulk-report/pdf', requireAuth, controller.getBulkReportPDF);

export default router;

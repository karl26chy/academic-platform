import express from 'express';
import requireAuth from '../middleware/require-auth.js';
import { pdfRateLimit, bulkPdfRateLimit } from '../middleware/rate-limits.js';
import * as controller from '../controllers/report.controller.js';

const router = express.Router();

router.get('/students/:studentId/report', requireAuth, controller.getReport);

/**
 * Estado académico anual de todos los estudiantes de una institución, en una
 * sola petición (estudiantes en riesgo y destacados del resumen del admin).
 */
router.get('/institutions/:institutionId/academic-status', requireAuth, controller.getInstitutionStatus);
router.get('/students/:studentId/report/pdf', requireAuth, pdfRateLimit, controller.getReportPDF);

/**
 * Generación masiva de boletines de un grado.
 * GET /grades/:gradeId/bulk-report/pdf?anio=2026
 * Solo admin de la institución; el service valida que el grado pertenezca a la institución.
 */
router.get('/grades/:gradeId/bulk-report/pdf', requireAuth, bulkPdfRateLimit, controller.getBulkReportPDF);

export default router;

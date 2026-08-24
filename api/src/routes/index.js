import express from 'express';
import authRoutes from './auth.routes.js';
import academicHistoryRoutes from './academic-history.routes.js';
import reportRoutes from './report.routes.js';
import reportConfigRoutes from './report-config.routes.js';
import reportTemplatesRoutes from './report-templates.routes.js';
import achievementRoutes from './achievement.routes.js';
import observationRoutes from './observation.routes.js';
import resourceRoutes from './resource.routes.js';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);
// El historial debe declararse antes del CRUD genérico para que su ruta
// /students/:studentId/academic-history no caiga en el 404 de recursos.
router.use('/', academicHistoryRoutes);
router.use('/', reportRoutes);
router.use('/', reportConfigRoutes);
router.use('/', reportTemplatesRoutes);
router.use('/', achievementRoutes);
router.use('/', observationRoutes);
router.use('/', resourceRoutes);

export default router;

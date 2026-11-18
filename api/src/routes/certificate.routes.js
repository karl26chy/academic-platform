import express from 'express';
import requireAuth from '../middleware/require-auth.js';
import * as controller from '../controllers/certificate.controller.js';
import { TAMANO_MAXIMO } from '../services/certificate.service.js';

/** Certificados PDF de estudiantes (solo corporaciones). */
const router = express.Router();

// El PDF llega tal cual en el cuerpo (Content-Type: application/pdf).
const pdf = express.raw({ type: 'application/pdf', limit: TAMANO_MAXIMO });

router.post('/students/:studentId/certificates', requireAuth, pdf, controller.upload);
router.get('/students/:studentId/certificates', requireAuth, controller.list);
router.get('/certificates/:id/archivo', requireAuth, controller.download);
router.delete('/certificates/:id', requireAuth, controller.remove);

export default router;

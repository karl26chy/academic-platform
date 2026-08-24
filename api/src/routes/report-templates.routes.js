import express from 'express';
import requireAuth from '../middleware/require-auth.js';
import { listTemplates } from '../templates/boletines/registry.js';

const router = express.Router();

router.get('/report-templates', requireAuth, (req, res, next) => {
  try {
    if (req.user?.rol !== 'super_admin') {
      return res.status(403).json({ error: 'Solo el Super Administrador puede ver los formatos.' });
    }
    res.json(listTemplates());
  } catch (err) {
    next(err);
  }
});

export default router;

import * as repo from '../repositories/report-config.repository.js';
import { getTemplateById } from '../templates/boletines/registry.js';
import { HttpError } from '../shared/http-error.js';

export async function getReportConfig(req, res, next) {
  try {
    if (req.user?.rol !== 'super_admin') {
      throw new HttpError(403, 'Solo el Super Administrador puede gestionar la configuración de boletines.');
    }
    const { id } = req.params;
    const tipoDocumento = req.query.tipo_documento || 'boletin';
    const row = await repo.getReportConfig(id, tipoDocumento);
    res.json(row);
  } catch (err) {
    next(err);
  }
}

export async function upsertReportConfig(req, res, next) {
  try {
    if (req.user?.rol !== 'super_admin') {
      throw new HttpError(403, 'Solo el Super Administrador puede gestionar la configuración de boletines.');
    }
    const { id } = req.params;
    const { tipo_documento, template_id, config, logo_url, activo } = req.body;

    const tipoDocumento = tipo_documento || 'boletin';

    // Nuevo modelo: solo template_id versionado. Mantener compatibilidad si llega config.html (Fase 4 vieja) → migrar a template_id solo si existe en registry
    let templateId = template_id || config?.template_id;
    // Compat: si aún mandan {config:{html,css}} sin template_id, rechazar con mensaje claro (ya no se permite html crudo)
    if (!templateId && config?.html) {
      throw new HttpError(400, 'El formato ahora se elige por template_id del registro versionado, no por HTML/CSS crudo. Usa template_id.');
    }
    if (!templateId || typeof templateId !== 'string' || !templateId.trim()) {
      throw new HttpError(400, 'Falta template_id.');
    }
    if (!getTemplateById(templateId)) {
      throw new HttpError(400, 'Formato no encontrado.');
    }

    const row = await repo.upsertReportConfig(
      id,
      tipoDocumento,
      { template_id: templateId },
      logo_url || null,
      activo !== undefined ? Boolean(activo) : true
    );
    res.json(row);
  } catch (err) {
    next(err);
  }
}

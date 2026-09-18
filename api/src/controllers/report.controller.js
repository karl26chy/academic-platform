import * as reportService from '../services/report.service.js';
import * as reportPdfService from '../services/report-pdf.service.js';

export async function getReport(req, res, next) {
  try {
    const { studentId } = req.params;
    const { period_id, anio } = req.query;
    if (anio !== undefined) {
      res.json(await reportService.getYearReport(req.user, studentId, anio));
    } else {
      res.json(await reportService.getReport(req.user, studentId, period_id));
    }
  } catch (err) {
    next(err);
  }
}

export async function getReportPDF(req, res, next) {
  try {
    const { studentId } = req.params;
    const { anio } = req.query;
    if (!anio) {
      return res.status(400).json({ error: 'Falta anio.' });
    }
    const institucionId = req.user?.institucion_id;
    const buffer = await reportPdfService.renderReportPDF(studentId, anio, institucionId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="boletin_${anio}.pdf"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
}

/**
 * Genera todos los boletines de un grado y los devuelve como un ZIP en streaming.
 *
 * Seguridad:
 * - requireAuth garantiza usuario autenticado.
 * - Solo el admin de la institución puede usar este endpoint (validado aquí).
 * - `renderBulkReportZip` verifica que el grado pertenece a la institución del admin.
 */
export async function getBulkReportPDF(req, res, next) {
  try {
    const { gradeId } = req.params;
    const { anio } = req.query;

    if (!anio) {
      return res.status(400).json({ error: 'Falta el parámetro anio.' });
    }
    if (!req.user || req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'Solo el administrador puede generar boletines masivos.' });
    }

    const institucionId = req.user.institucion_id;
    if (!institucionId) {
      return res.status(403).json({ error: 'No se pudo determinar tu institución.' });
    }

    // La función hace pipe directo al res; si falla antes de escribir headers,
    // el error llegará al errorHandler normal vía next(err).
    // Si falla después de abrir el stream, se maneja internamente en el service.
    await reportPdfService.renderBulkReportZip(gradeId, anio, institucionId, res);
  } catch (err) {
    // Si los headers ya se enviaron (streaming iniciado), no podemos responder con JSON.
    // El cliente verá un ZIP incompleto/corrupto. Esto es un error irrecuperable
    // en el protocolo HTTP sin WebSockets.
    if (res.headersSent) {
      console.error('[BulkReport] Error tras iniciar streaming:', err.message);
      return res.end();
    }
    next(err);
  }
}

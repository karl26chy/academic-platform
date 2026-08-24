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

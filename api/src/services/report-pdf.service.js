import Handlebars from 'handlebars';
import puppeteer from 'puppeteer-core';

import * as reportService from './report.service.js';
import * as reportConfigRepo from '../repositories/report-config.repository.js';
import { getTemplateById } from '../templates/boletines/registry.js';
import { HttpError } from '../shared/http-error.js';

Handlebars.registerHelper('gte', (a, b) => a !== null && a !== undefined && a >= b);
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('inc', i => Number(i) + 1);

export async function renderReportPDF(studentId, anio, institucionId) {
  if (!studentId || !anio || !institucionId) {
    throw new HttpError(400, 'Faltan parámetros para generar el boletín.');
  }

  // Reutiliza la lógica ya existente (buildPeriodData) sin duplicarla.
  const fakeUser = { institucion_id: institucionId, rol: 'admin' };
  const data = await reportService.getYearReport(fakeUser, studentId, anio);

  const tpl = await reportConfigRepo.getReportConfig(institucionId, 'boletin');
  const templateId = tpl?.config?.template_id;
  if (!templateId) {
    // Fila vieja con {html,css} o sin config → mensaje claro, no genérico
    throw new HttpError(404, 'Formato de boletín no configurado para esta institución.');
  }
  const entry = getTemplateById(templateId);
  if (!entry) {
    throw new HttpError(404, `Formato "${templateId}" no encontrado en el registro versionado. Reasigne un formato válido a la institución.`);
  }

  const fechaGeneracion = new Date().toLocaleDateString('es-CO');
  const observaciones = data.observaciones || '';

  const htmlBody = Handlebars.compile(entry.html)({
    student: data.student,
    institution: data.institution,
    grade: data.grade,
    year: data.year,
    periods: data.periods,
    subjects: data.subjects,
    attendance: data.attendance,
    summary: data.summary,
    fechaGeneracion,
    observaciones,
  });
  const css = entry.css || '';
  const htmlFinal = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${htmlBody}</body></html>`;

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(htmlFinal, { waitUntil: 'networkidle0' });
    const buffer = await page.pdf({ format: 'letter', printBackground: true });
    return buffer;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

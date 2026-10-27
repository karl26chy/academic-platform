import Handlebars from 'handlebars';
import puppeteer from 'puppeteer-core';
import { ZipArchive } from 'archiver';

import * as reportService from './report.service.js';
import * as reportConfigRepo from '../repositories/report-config.repository.js';
import * as repo from '../repositories/report.repository.js';
import { getTemplateById } from '../templates/boletines/registry.js';
import { HttpError } from '../shared/http-error.js';


Handlebars.registerHelper('gte', (a, b) => a !== null && a !== undefined && a >= b);
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('inc', i => Number(i) + 1);

/**
 * Plantilla Handlebars ya compilada. El registro devuelve un objeto nuevo
 * cuando la plantilla cambia en disco, así que basta con indexar por objeto.
 */
const compiledByEntry = new WeakMap();
function compiledTemplate(entry) {
  let fn = compiledByEntry.get(entry);
  if (!fn) {
    fn = Handlebars.compile(entry.html);
    compiledByEntry.set(entry, fn);
  }
  return fn;
}

let cachedBrowser = null;
let launchingPromise = null;

/**
 * Chromium ocupa cientos de MB de RAM y los boletines se generan pocas veces
 * por periodo: se cierra tras este tiempo sin generar ningún PDF y se relanza
 * bajo demanda en la siguiente petición.
 */
const BROWSER_IDLE_MS = Number(process.env.PDF_BROWSER_IDLE_MS) || 2 * 60 * 1000;

/** PDFs en curso; mientras haya alguno el navegador no se cierra. */
let activeRenders = 0;
let idleTimer = null;

/**
 * Tope de páginas de Chromium abiertas a la vez en TODO el proceso, sumando
 * boletines individuales y masivos de cualquier usuario. Los que excedan
 * esperan turno en vez de disparar la RAM del servidor.
 */
const MAX_PAGINAS = Number(process.env.PDF_MAX_CONCURRENT) || 4;
let paginasAbiertas = 0;
const enEspera = [];

async function turnoDePagina() {
  if (paginasAbiertas < MAX_PAGINAS) {
    paginasAbiertas++;
    return;
  }
  // Quien libera la página le pasa el turno directamente (sin soltar el cupo).
  await new Promise(resolve => enEspera.push(resolve));
}

function liberarPagina() {
  const siguiente = enEspera.shift();
  if (siguiente) siguiente();
  else paginasAbiertas--;
}

function cancelIdleClose() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
}

function scheduleIdleClose() {
  cancelIdleClose();
  idleTimer = setTimeout(() => {
    idleTimer = null;
    if (activeRenders > 0 || !cachedBrowser) return;
    const browser = cachedBrowser;
    cachedBrowser = null;
    browser.close().catch(() => {});
  }, BROWSER_IDLE_MS);
  // El temporizador no debe mantener vivo el proceso (tests, apagado).
  idleTimer.unref?.();
}

/**
 * Obtiene o lanza la instancia Singleton de Puppeteer/Chromium.
 * Soporta inicialización diferida, llamadas concurrentes y auto-recuperación ante cierres.
 */
async function getBrowser() {
  if (cachedBrowser && cachedBrowser.connected) {
    return cachedBrowser;
  }
  if (launchingPromise) {
    return launchingPromise;
  }

  launchingPromise = (async () => {
    try {
      const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      browser.on('disconnected', () => {
        if (cachedBrowser === browser) {
          cachedBrowser = null;
        }
      });
      cachedBrowser = browser;
      return browser;
    } finally {
      launchingPromise = null;
    }
  })();

  return launchingPromise;
}

export async function renderReportPDF(studentId, anio, institucionId) {
  if (!studentId || !anio || !institucionId) {
    throw new HttpError(400, 'Faltan parámetros para generar el boletín.');
  }

  // Reutiliza la lógica ya existente (buildPeriodData) sin duplicarla.
  const fakeUser = { institucion_id: institucionId, rol: 'admin' };
  // Ambas consultas se lanzan a la vez; los errores se revisan en el orden de
  // antes (primero el del reporte) para no cambiar la respuesta del API.
  const [reportResult, configResult] = await Promise.allSettled([
    reportService.getYearReport(fakeUser, studentId, anio),
    reportConfigRepo.getReportConfig(institucionId, 'boletin'),
  ]);
  if (reportResult.status === 'rejected') throw reportResult.reason;
  if (configResult.status === 'rejected') throw configResult.reason;
  const data = reportResult.value;
  const tpl = configResult.value;
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

  const htmlBody = compiledTemplate(entry)({
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

  // Se cuenta antes de pedir el navegador para que el cierre por inactividad
  // no pueda dispararse mientras se lanza o se usa.
  activeRenders++;
  cancelIdleClose();
  await turnoDePagina();
  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    // Las plantillas son HTML+CSS con imágenes embebidas: la página no
    // necesita JavaScript ni red. Bloquearlos impide que un texto con HTML
    // colado pueda ejecutar código o pedir URLs internas del servidor.
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('data:') || url === 'about:blank') request.continue();
      else request.abort();
    });
    await page.setContent(htmlFinal, { waitUntil: 'load' });
    // puppeteer devuelve un Uint8Array: Express lo serializaría como JSON y
    // archiver no lo acepta. Se entrega siempre como Buffer.
    return Buffer.from(await page.pdf({ format: 'letter', printBackground: true }));
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    liberarPagina();
    activeRenders--;
    if (activeRenders === 0) scheduleIdleClose();
  }
}

// ---------------------------------------------------------------------------
// Generación masiva de boletines
// ---------------------------------------------------------------------------

/** Número máximo de PDFs que se generan en paralelo. */
const BULK_CONCURRENCY = 4;

/**
 * Nombre de archivo seguro para un estudiante dentro del ZIP.
 * Ejemplo: "001_Garcia_Lopez_Juan_Carlos.pdf"
 */
function safeFilename(index, student) {
  const slug = `${student.nombre}_${student.apellido}`
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  const num = String(index + 1).padStart(3, '0');
  return `${num}_${slug}.pdf`;
}

/**
 * Genera todos los boletines de los estudiantes de un grado y los empaqueta
 * en un ZIP que se transmite directamente al stream de respuesta HTTP.
 *
 * Diseño:
 * - Reutiliza `renderReportPDF` (sin modificarla).
 * - Concurrencia controlada: BULK_CONCURRENCY PDFs simultáneos.
 * - Errores individuales no abortan la generación; se reportan al final.
 * - El ZIP se construye progresivamente (nunca todo en RAM).
 * - No se escribe nada a disco del servidor.
 *
 * @param {string} gradeId
 * @param {number|string} anio
 * @param {string} institucionId
 * @param {import('http').ServerResponse} res   Stream de la respuesta HTTP
 * @returns {Promise<{ total: number, ok: number, errors: Array<{nombre:string, apellido:string, error:string}> }>}
 */
export async function renderBulkReportZip(gradeId, anio, institucionId, res) {
  if (!gradeId || !anio || !institucionId) {
    throw new HttpError(400, 'Faltan parámetros para la generación masiva.');
  }

  // 1. Obtener grado e información básica.
  const gradeInfo = await repo.gradeBasicInfo(gradeId);
  if (!gradeInfo || gradeInfo.institucion_id !== institucionId) {
    throw new HttpError(404, 'Grado no encontrado o no pertenece a tu institución.');
  }

  // 2. Obtener estudiantes del grado (ya valida que el grado es de la institución).
  const students = await repo.studentsOfGrade(gradeId, institucionId);
  if (students === null) {
    throw new HttpError(404, 'Grado no encontrado o no pertenece a tu institución.');
  }
  if (students.length === 0) {
    throw new HttpError(422, 'No hay estudiantes matriculados en este grado para el año solicitado.');
  }

  // 3. Nombre del ZIP: Boletines_{nombre_grado}_{tipo_grado}_{anio}.zip
  const gradeSlug = `${gradeInfo.nombre}_${gradeInfo.tipo_grado}`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '');
  const zipName = `Boletines_${gradeSlug}_${anio}.zip`;

  // 4. Iniciar stream ZIP hacia la respuesta HTTP.
  const archive = new ZipArchive({ zlib: { level: 6 } });

  archive.on('error', (err) => {
    // Un throw aquí sería una excepción no capturada que tumba el proceso:
    // se registra y se corta solo esta respuesta.
    console.error('[BulkReport] Error al construir el ZIP:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error al construir el archivo ZIP.' });
    } else {
      res.destroy(err);
    }
  });

  // Escribir headers antes de empezar a hacer pipe (headersSent = true desde aquí).
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
  // Sin Content-Length, Node envía la respuesta por trozos (chunked) solo; fijar
  // Transfer-Encoding a mano rompía la respuesta de error (llevaba ambos).

  archive.pipe(res);

  // 5. Generar PDFs en lotes con concurrencia controlada.
  const errors = [];

  for (let i = 0; i < students.length; i += BULK_CONCURRENCY) {
    const batch = students.slice(i, i + BULK_CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (student, batchIdx) => {
        const globalIdx = i + batchIdx;
        const buffer = await renderReportPDF(student.id, anio, institucionId);
        const filename = safeFilename(globalIdx, student);
        // archiver.append() es seguro llamarlo mientras el archive está abierto.
        archive.append(buffer, { name: filename });
        return { student, filename };
      })
    );

    // Registrar errores individuales sin abortar el ZIP.
    for (const [j, result] of results.entries()) {
      if (result.status === 'rejected') {
        const student = batch[j];
        errors.push({
          nombre: student.nombre,
          apellido: student.apellido,
          error: result.reason?.message || 'Error desconocido',
        });
      }
    }
  }

  // 6. Finalizar el ZIP (envía el directorio central y el End-of-Central-Directory).
  await archive.finalize();

  return {
    total: students.length,
    ok: students.length - errors.length,
    errors,
  };
}

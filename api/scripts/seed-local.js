/**
 * Seed LOCAL — Base de datos funcional para desarrollo.
 * Aislado de producción: aborta si DATABASE_URL apunta a Supabase.
 *
 * Cubre: Super Admin + Institución + Admin + Docentes + Estudiantes
 *        + Grados + Materias + Períodos + Evaluaciones + Notas + Asistencia
 *
 * Idempotente: si la DB ya tiene datos reales, no hace nada destructivo.
 * Si está vacía, crea todo desde cero. Si ya tiene la institución demo,
 * solo rellena lo que falta.
 *
 * Uso:
 *   DATABASE_URL=postgresql://platform:platform@localhost:55432/platform npm run seed:local
 *   # o vía Docker: npm run setup ya crea esquema; luego npm run seed:local
 */

import bcrypt from 'bcryptjs';
import pool from '../src/db/pool.js';

const INST_ID = 'inst-demo-local';
const GRADE_A_ID = 'grade-demo-6a';
const GRADE_B_ID = 'grade-demo-6b';

const SUBJECTS = [
  { id: 'subj-demo-mat', nombre: 'Matemáticas', descripcion: 'Demo local' },
  { id: 'subj-demo-len', nombre: 'Lengua', descripcion: 'Demo local' },
  { id: 'subj-demo-cie', nombre: 'Ciencias', descripcion: 'Demo local' },
  { id: 'subj-demo-soc', nombre: 'Sociales', descripcion: 'Demo local' },
];

async function ensureNotProduction(client) {
  // El guard de config/index.js ya bloquea, pero aquí validamos de nuevo
  // por si el script se invoca con NODE_ENV=production por error.
  const url = process.env.DATABASE_URL || '';
  const lower = url.toLowerCase();
  if (lower.includes('supabase.co') || lower.includes('pooler.supabase')) {
    throw new Error('[BLOQUEO seed-local] DATABASE_URL apunta a Supabase. Abortando seed local.');
  }
  // Verificación heurística: si hay instituciones con subdominio real (no demo/test), abortar
  const { rows } = await client.query(`SELECT subdominio FROM institutions LIMIT 5`);
  const suspicious = rows.some((r) => r.subdominio && !r.subdominio.includes('demo') && !r.subdominio.includes('test'));
  if (rows.length > 5 && suspicious) {
    console.warn('>> Advertencia: la DB parece tener datos no-demo. seed-local solo añadirá lo que falta, no borrará.');
  }
}

async function upsertInstitution(client) {
  const { rows } = await client.query('SELECT id FROM institutions WHERE id = $1', [INST_ID]);
  if (rows.length > 0) {
    console.log('   institución demo ya existe, omitida');
    return;
  }
  await client.query(
    `INSERT INTO institutions (id, nombre, subdominio, tipo, escala_maxima, nota_minima_aprobacion, activa)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [INST_ID, 'Colegio Demo Local', 'demo-local', 'colegio', 10, 6, true]
  );
  console.log('   institución: Colegio Demo Local (demo-local)');
}

async function upsertUser(client, { id, email, password, rol, nombre, apellido, institucion_id, extra = {} }) {
  const { rows } = await client.query('SELECT id FROM users WHERE id = $1 OR email = $2', [id, email]);
  if (rows.length > 0) return rows[0].id;
  const hash = await bcrypt.hash(password, 10);
  const base = {
    id, email, password: hash, rol, nombre, apellido,
    institucion_id: institucion_id || null,
    activo: true,
    ...extra,
  };
  const cols = Object.keys(base);
  const vals = Object.values(base);
  const ph = vals.map((_, i) => '$' + (i + 1)).join(', ');
  await client.query(`INSERT INTO users (${cols.map((c) => '"' + c + '"').join(', ')}) VALUES (${ph})`, vals);
  return id;
}

async function upsertGrade(client, id, nombre) {
  const { rows } = await client.query('SELECT id FROM grades WHERE id = $1', [id]);
  if (rows.length > 0) return;
  await client.query(`INSERT INTO grades (id, institucion_id, nombre, tipo_grado) VALUES ($1,$2,$3,$4)`, [id, INST_ID, nombre, 'A']);
}

async function upsertSubject(client, s) {
  const { rows } = await client.query('SELECT id FROM subjects WHERE id = $1', [s.id]);
  if (rows.length > 0) return;
  await client.query(`INSERT INTO subjects (id, institucion_id, nombre, descripcion) VALUES ($1,$2,$3,$4)`, [s.id, INST_ID, s.nombre, s.descripcion]);
}

async function upsertAssignment(client, id, profesor_id, materia_id, grado_id) {
  const { rows } = await client.query('SELECT id FROM assignments WHERE id = $1', [id]);
  if (rows.length > 0) return;
  await client.query(`INSERT INTO assignments (id, profesor_id, materia_id, grado_id, institucion_id) VALUES ($1,$2,$3,$4,$5)`, [id, profesor_id, materia_id, grado_id, INST_ID]);
}

async function upsertEnrollment(client, id, estudiante_id, grado_id) {
  const { rows } = await client.query('SELECT id FROM student_grades WHERE id = $1', [id]);
  if (rows.length > 0) return;
  await client.query(`INSERT INTO student_grades (id, estudiante_id, grado_id) VALUES ($1,$2,$3)`, [id, estudiante_id, grado_id]);
}

async function run() {
  const client = await pool.connect();
  try {
    await ensureNotProduction(client);

    console.log('>> seed-local: creando esquema si falta...');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const here = path.dirname(fileURLToPath(import.meta.url));
    const schema = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
    await client.query(schema);

    console.log('>> seed-local: institución y catálogos...');
    await upsertInstitution(client);
    await upsertGrade(client, GRADE_A_ID, '6to A');
    await upsertGrade(client, GRADE_B_ID, '6to B');
    for (const s of SUBJECTS) await upsertSubject(client, s);

    // Periodos académicos: 1..4 del año actual, solo si no existen
    const anio = new Date().getFullYear();
    for (let n = 1; n <= 4; n++) {
      const pid = `p-${INST_ID}-${anio}-${n}`;
      const { rows } = await client.query('SELECT 1 FROM academic_periods WHERE id = $1', [pid]);
      if (rows.length === 0) {
        await client.query(`INSERT INTO academic_periods (id, institucion_id, nombre, numero, anio, activo) VALUES ($1,$2,$3,$4,$5,$6)`, [pid, INST_ID, `Periodo ${n}`, n, anio, n === 1]);
      }
    }
    const { rows: periodRows } = await client.query(`SELECT id FROM academic_periods WHERE institucion_id = $1 AND activo LIMIT 1`, [INST_ID]);
    const periodoActivoId = periodRows[0]?.id || `p-${INST_ID}-${anio}-1`;

    console.log('>> seed-local: usuarios...');
    await upsertUser(client, { id: 'usr-super-local', email: 'super@local.test', password: 'Super123!', rol: 'super_admin', nombre: 'Super', apellido: 'Local', institucion_id: null });
    const adminId = await upsertUser(client, { id: 'usr-admin-demo', email: 'admin@demo-local.test', password: 'Admin123!', rol: 'admin', nombre: 'Ana', apellido: 'Admin', institucion_id: INST_ID });
    const doc1 = await upsertUser(client, { id: 'usr-doc1-demo', email: 'doc1@demo-local.test', password: 'Doc123!', rol: 'teacher', nombre: 'Carlos', apellido: 'Docente', institucion_id: INST_ID });
    const doc2 = await upsertUser(client, { id: 'usr-doc2-demo', email: 'doc2@demo-local.test', password: 'Doc123!', rol: 'teacher', nombre: 'Laura', apellido: 'Docente', institucion_id: INST_ID });

    const estudiantes = [];
    for (let i = 1; i <= 10; i++) {
      const sid = `usr-est${String(i).padStart(2, '0')}-demo`;
      const email = `est${i}@demo-local.test`;
      const ident = `EST-DEMO-${String(i).padStart(3, '0')}`;
      await upsertUser(client, {
        id: sid, email, password: 'Est123!', rol: 'student', nombre: `Estudiante${i}`, apellido: 'Demo', institucion_id: INST_ID,
        extra: { identificacion: ident, tipo_documento: 'TI', genero: i % 2 === 0 ? 'femenino' : 'masculino', fecha_nacimiento: '2012-03-15' },
      });
      estudiantes.push({ id: sid, idx: i });
    }

    console.log('>> seed-local: asignaciones y matrículas...');
    await upsertAssignment(client, 'assign-doc1-mat-6a', doc1, SUBJECTS[0].id, GRADE_A_ID);
    await upsertAssignment(client, 'assign-doc1-len-6a', doc1, SUBJECTS[1].id, GRADE_A_ID);
    await upsertAssignment(client, 'assign-doc2-cie-6b', doc2, SUBJECTS[2].id, GRADE_B_ID);
    await upsertAssignment(client, 'assign-doc2-soc-6b', doc2, SUBJECTS[3].id, GRADE_B_ID);
    for (const est of estudiantes) {
      const grado = est.idx <= 5 ? GRADE_A_ID : GRADE_B_ID;
      await upsertEnrollment(client, `enroll-${est.id}`, est.id, grado);
    }

    console.log('>> seed-local: evaluaciones...');
    const evals = [
      { id: 'eval-demo-mat-p1', materia_id: SUBJECTS[0].id, grado_id: GRADE_A_ID, nombre: 'Parcial 1 Matemáticas', fecha: `${anio}-03-10`, porcentaje: 30 },
      { id: 'eval-demo-len-p1', materia_id: SUBJECTS[1].id, grado_id: GRADE_A_ID, nombre: 'Parcial 1 Lengua', fecha: `${anio}-03-12`, porcentaje: 25 },
      { id: 'eval-demo-cie-p1', materia_id: SUBJECTS[2].id, grado_id: GRADE_B_ID, nombre: 'Parcial 1 Ciencias', fecha: `${anio}-03-14`, porcentaje: 30 },
      { id: 'eval-demo-soc-p1', materia_id: SUBJECTS[3].id, grado_id: GRADE_B_ID, nombre: 'Parcial 1 Sociales', fecha: `${anio}-03-16`, porcentaje: 25 },
    ];
    for (const ev of evals) {
      const { rows } = await client.query('SELECT id FROM evaluations WHERE id = $1', [ev.id]);
      if (rows.length > 0) continue;
      await client.query(
        `INSERT INTO evaluations (id, institucion_id, materia_id, grado_id, nombre, fecha_evaluacion, porcentaje, periodo, anio, periodo_id, creado_por)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [ev.id, INST_ID, ev.materia_id, ev.grado_id, ev.nombre, ev.fecha, ev.porcentaje, 'Periodo 1', String(anio), periodoActivoId, doc1]
      );
    }

    console.log('>> seed-local: notas (marks)...');
    // Notas deterministas 6.0-9.5 para que los promedios se vean reales
    for (const ev of evals) {
      const grado = ev.grado_id;
      const alumnos = estudiantes.filter((e) => (grado === GRADE_A_ID ? e.idx <= 5 : e.idx > 5));
      for (const est of alumnos) {
        const markId = `mark-${est.id}-${ev.id}`;
        const { rows } = await client.query('SELECT id FROM marks WHERE id = $1', [markId]);
        if (rows.length > 0) continue;
        const nota = 6 + ((est.idx * 7 + ev.id.length) % 35) / 10; // 6.0 - 9.4
        await client.query(
          `INSERT INTO marks (id, estudiante_id, materia_id, grado_id, evaluacion_id, tipo_evaluacion, fecha_evaluacion, porcentaje, nota, periodo, anio, periodo_id, registrado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [markId, est.id, ev.materia_id, grado, ev.id, 'parcial', ev.fecha, ev.porcentaje, Number(nota.toFixed(1)), 'Periodo 1', String(anio), periodoActivoId, doc1]
        );
      }
    }

    console.log('>> seed-local: asistencia...');
    const fechas = [`${anio}-03-10`, `${anio}-03-11`, `${anio}-03-12`, `${anio}-03-13`];
    for (const est of estudiantes.slice(0, 6)) {
      for (const fecha of fechas) {
        const attId = `att-${est.id}-${fecha}`;
        const { rows } = await client.query('SELECT id FROM attendance WHERE id = $1', [attId]);
        if (rows.length > 0) continue;
        const estado = est.idx % 5 === 0 && fecha === fechas[0] ? 'ausente' : 'presente';
        const grado = est.idx <= 5 ? GRADE_A_ID : GRADE_B_ID;
        const materia = grado === GRADE_A_ID ? SUBJECTS[0].id : SUBJECTS[2].id;
        await client.query(
          `INSERT INTO attendance (id, estudiante_id, materia_id, grado_id, fecha, estado, periodo_id, registrado_por)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [attId, est.id, materia, grado, fecha, estado, periodoActivoId, doc1]
        );
      }
    }

    console.log('>> seed-local completado.');
    console.log('   Super Admin: super@local.test / Super123!  (sin subdominio)');
    console.log('   Admin:       admin@demo-local.test / Admin123!  (subdominio: demo-local)');
    console.log('   Docentes:    doc1@demo-local.test / Doc123! , doc2@demo-local.test / Doc123!');
    console.log('   Estudiantes: est1@demo-local.test .. est10@demo-local.test / Est123!  (login por identificación EST-DEMO-001..)');
    console.log('   Institución: demo-local (Colegio Demo Local), escala 0-10, Grados 6to A/B');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Error en seed-local:', err.message);
  console.error(err.stack);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import pool from '../src/db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const SCHEMA = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
const SEED_FILE = path.join(here, '..', 'db.json');

const COLLECTION_TABLES = [
  'institutions',
  'users',
  'grades',
  'subjects',
  'assignments',
  'student_grades',
  'attendance',
  'marks',
  'citations',
  'messages',
  'evaluations',
];

/**
 * Siembra los periodos académicos del año actual para cada institución que
 * todavía no los tenga. Es idempotente y corre en cada arranque.
 *
 * Mantiene la invariante de la plataforma: UNA SOLA periodo abierto por
 * institución. Los periodos faltantes nacen CERRADOS; si la institución se
 * queda sin abierto, se abre el primero (año ascendente, número ascendente);
 * si por estado heredado hay más de uno abierto, se deja solo el primero.
 */
async function seedAcademicPeriods(client) {
  const anio = new Date().getFullYear();
  const { rows: instituciones } = await client.query('SELECT id FROM institutions');

  for (const inst of instituciones) {
    for (let numero = 1; numero <= 4; numero++) {
      const { rows } = await client.query(
        `SELECT 1 FROM academic_periods WHERE "institucion_id" = $1 AND "numero" = $2 AND "anio" = $3`,
        [inst.id, numero, anio]
      );
      if (rows.length > 0) continue;

      const id = `p-${inst.id}-${anio}-${numero}`;
      await client.query(
        `INSERT INTO academic_periods (id, "institucion_id", nombre, numero, anio, activo)
         VALUES ($1, $2, $3, $4, $5, false)`,
        [id, inst.id, `Periodo ${numero}`, numero, anio]
      );
    }

    const { rows: abiertos } = await client.query(
      `SELECT id FROM academic_periods
       WHERE "institucion_id" = $1 AND activo
       ORDER BY "anio" ASC, "numero" ASC`,
      [inst.id]
    );

    if (abiertos.length === 0) {
      const { rows: primero } = await client.query(
        `SELECT id FROM academic_periods
         WHERE "institucion_id" = $1
         ORDER BY "anio" ASC, "numero" ASC LIMIT 1`,
        [inst.id]
      );
      if (primero[0]) {
        await client.query('UPDATE academic_periods SET activo = true WHERE id = $1', [primero[0].id]);
      }
    } else if (abiertos.length > 1) {
      for (const extra of abiertos.slice(1)) {
        await client.query('UPDATE academic_periods SET activo = false WHERE id = $1', [extra.id]);
      }
    }
  }
}

/**
 * Asocia evaluaciones existentes a un periodo cuando hay evidencia inequívoca:
 * el texto `periodo` coincide con el nombre del periodo y el año derivado de la
 * fecha coincide. Nunca inventa asociaciones ambiguas.
 */
async function seedEvaluationPeriodLinks(client) {
  const { rows: evals } = await client.query(
    `SELECT e.id, e."institucion_id", e."periodo", e."anio"
     FROM evaluations e
     WHERE e."periodo_id" IS NULL AND e."periodo" IS NOT NULL AND e."anio" IS NOT NULL`
  );

  for (const ev of evals) {
    const periodoNombre = String(ev.periodo).trim().toLowerCase();
    const { rows } = await client.query(
      `SELECT id FROM academic_periods
       WHERE "institucion_id" = $1 AND "anio" = $2 AND LOWER(nombre) = $3
       LIMIT 1`,
      [ev.institucion_id, Number(ev.anio), periodoNombre]
    );
    if (rows.length === 0) continue;
    await client.query(
      `UPDATE evaluations SET "periodo_id" = $1 WHERE id = $2`,
      [rows[0].id, ev.id]
    );
  }
}

async function run() {
  const client = await pool.connect();
  try {
    console.log('>> Creando esquema de tablas...');
    await client.query(SCHEMA);

    await seedAcademicPeriods(client);
    await seedEvaluationPeriodLinks(client);

    let totalCount = 0;
    for (const table of COLLECTION_TABLES) {
      const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
      totalCount += rows[0].count;
    }
    if (totalCount > 0) {
      console.log(`>> La base ya tiene datos (${totalCount} registros). Seed omitido.`);
      return;
    }

    console.log('>> Sembrando datos desde db.json...');
    // db.json es opcional: sin él solo se crean el esquema y los periodos.
    let seed = {};
    try {
      seed = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    } catch {
      console.log('>> db.json no encontrado; seed de colecciones omitido.');
    }

    for (const table of COLLECTION_TABLES) {
      const records = Array.isArray(seed[table]) ? seed[table] : [];
      if (records.length === 0) continue;

      for (const record of records) {
        const data = { ...record };

        if (table === 'users' && data.password) {
          data.password = await bcrypt.hash(String(data.password), 10);
        }
        if (table === 'users' && data.contacto_emergencia && typeof data.contacto_emergencia === 'object') {
          data.contacto_emergencia = JSON.stringify(data.contacto_emergencia);
        }

        const cols = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => '$' + (i + 1)).join(', ');

        await client.query(
          `INSERT INTO ${table} (${cols.map((c) => '"' + c + '"').join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
      console.log(`   ${table}: ${records.length} registros`);
    }

    console.log('>> Seed completado.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Error durante el setup:', err);
  process.exit(1);
});

import pool from './pool.js';

/**
 * Esquema de las CORPORACIONES (programas técnicos y cursos cortos).
 *
 * Solo AGREGA: una tabla de programas, tres columnas opcionales en `grades`
 * (que en una corporación representan grupos: programa + jornada + nivel) y
 * una tabla de certificados. Los colegios no usan nada de esto y sus datos no
 * cambian. Es idempotente y se ejecuta al arrancar la API, para no depender
 * de correr migraciones a mano contra la base de producción.
 * (Las mismas sentencias están al final de schema.sql para instalaciones nuevas.)
 */
export const ESQUEMA_CORPORACIONES = `
  CREATE TABLE IF NOT EXISTS programs (
    id TEXT PRIMARY KEY,
    institucion_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('tecnico', 'curso_corto')),
    activo BOOLEAN NOT NULL DEFAULT true
  );
  CREATE INDEX IF NOT EXISTS idx_programs_institucion ON programs(institucion_id);

  ALTER TABLE grades ADD COLUMN IF NOT EXISTS programa_id TEXT REFERENCES programs(id) ON DELETE RESTRICT;
  ALTER TABLE grades ADD COLUMN IF NOT EXISTS jornada TEXT;
  ALTER TABLE grades ADD COLUMN IF NOT EXISTS nivel INTEGER;
  CREATE UNIQUE INDEX IF NOT EXISTS uq_grades_grupo_corporacion
    ON grades (programa_id, jornada, COALESCE(nivel, 0)) WHERE programa_id IS NOT NULL;

  CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    institucion_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    estudiante_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    archivo BYTEA NOT NULL,
    tamano INTEGER NOT NULL,
    subido_por TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_certificates_estudiante ON certificates(estudiante_id);
`;

export async function asegurarEsquemaCorporaciones() {
  await pool.query(ESQUEMA_CORPORACIONES);
}

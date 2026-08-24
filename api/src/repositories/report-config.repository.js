import pool from '../db/pool.js';

/** Configuración activa de plantilla por institución y tipo de documento. */
export async function getReportConfig(institucionId, tipoDocumento = 'boletin') {
  const { rows } = await pool.query(
    `SELECT id, institucion_id, tipo_documento, config, logo_url, version, activo, created_at, updated_at
     FROM institution_report_configs
     WHERE "institucion_id" = $1 AND "tipo_documento" = $2 AND activo
     ORDER BY version DESC
     LIMIT 1`,
    [institucionId, tipoDocumento]
  );
  return rows[0] || null;
}

/** Crea o actualiza la configuración (html/css) de una institución. */
export async function upsertReportConfig(
  institucionId,
  tipoDocumento = 'boletin',
  config,
  logoUrl = null,
  activo = true
) {
  const id = `rc-${institucionId}-${tipoDocumento}`;
  const now = new Date().toISOString();
  const configJson = JSON.stringify(config || {});

  const { rows } = await pool.query(
    `INSERT INTO institution_report_configs
       (id, institucion_id, tipo_documento, config, logo_url, version, activo, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, 1, $6, $7, $7)
     ON CONFLICT ("institucion_id", "tipo_documento")
     DO UPDATE SET
       config = EXCLUDED.config,
       logo_url = EXCLUDED.logo_url,
       activo = EXCLUDED.activo,
       version = institution_report_configs.version + 1,
       updated_at = EXCLUDED.updated_at
     RETURNING *`,
    [id, institucionId, tipoDocumento, configJson, logoUrl, Boolean(activo), now]
  );
  return rows[0];
}

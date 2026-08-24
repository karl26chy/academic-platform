/**
 * Catálogo declarativo de recursos expuestos por el API.
 *
 *   cols    columnas permitidas (lista blanca de escritura y lectura)
 *   hidden  columnas que nunca salen en una respuesta
 *   secret  columnas que se guardan hasheadas
 *
 * Añadir un recurso nuevo es añadir una entrada aquí; no hay que tocar
 * rutas, controladores ni repositorios.
 */
export const RESOURCES = {
  institutions: {
    cols: ['id', 'nombre', 'subdominio', 'tipo', 'escala_maxima', 'nota_minima_aprobacion', 'activa'],
  },
  users: {
    cols: [
      'id',
      'email',
      'password',
      'rol',
      'nombre',
      'apellido',
      'genero',
      'fecha_nacimiento',
      'identificacion',
      'tipo_documento',
      'eps',
      'tipo_sangre',
      'contacto_emergencia',
      'discapacidad',
      'institucion_id',
      'activo',
    ],
    hidden: ['password'],
    secret: ['password'],
  },
  grades: { cols: ['id', 'institucion_id', 'nombre', 'tipo_grado'] },
  subjects: { cols: ['id', 'institucion_id', 'nombre', 'descripcion'] },
  assignments: { cols: ['id', 'profesor_id', 'materia_id', 'grado_id', 'institucion_id'] },
  student_grades: { cols: ['id', 'estudiante_id', 'grado_id'] },
  attendance: {
    cols: ['id', 'estudiante_id', 'materia_id', 'grado_id', 'fecha', 'estado', 'periodo_id', 'registrado_por'],
  },
  marks: {
    cols: [
      'id',
      'estudiante_id',
      'materia_id',
      'grado_id',
      'evaluacion_id',
      'tipo_evaluacion',
      'fecha_evaluacion',
      'porcentaje',
      'nota',
      'periodo',
      'anio',
      'periodo_id',
      'registrado_por',
    ],
  },
  citations: {
    cols: ['id', 'estudiante_id', 'materia_id', 'fecha_citacion', 'motivo', 'estado', 'creado_por'],
  },
  messages: {
    cols: ['id', 'remitente_id', 'destinatario_id', 'materia_id', 'asunto', 'cuerpo', 'leido', 'created_at'],
  },
  evaluations: {
    cols: [
      'id',
      'institucion_id',
      'materia_id',
      'grado_id',
      'nombre',
      'fecha_evaluacion',
      'porcentaje',
      'periodo',
      'anio',
      'periodo_id',
      'creado_por',
    ],
  },
  academic_periods: {
    cols: ['id', 'institucion_id', 'nombre', 'numero', 'anio', 'fecha_inicio', 'fecha_fin', 'activo'],
  },
};

export const isResource = (resource) =>
  Object.prototype.hasOwnProperty.call(RESOURCES, resource);

export const quote = (identifier) => '"' + identifier + '"';

const hiddenCols = (resource) => RESOURCES[resource].hidden || [];

export const secretCols = (resource) => RESOURCES[resource].secret || [];

/** Lista de columnas para el SELECT, ya escapada y sin las ocultas. */
export function selectColumns(resource) {
  return RESOURCES[resource].cols
    .filter((col) => !hiddenCols(resource).includes(col))
    .map(quote)
    .join(', ');
}

/** Elimina in situ las columnas ocultas de una fila devuelta por la base. */
export function sanitizeRow(resource, row) {
  if (!row) return row;
  for (const col of hiddenCols(resource)) {
    delete row[col];
  }
  return row;
}

/** Se queda solo con las columnas declaradas: descarta cualquier campo ajeno. */
export function pickColumns(resource, body) {
  const allowed = RESOURCES[resource].cols;
  const out = {};
  for (const col of allowed) {
    if (Object.prototype.hasOwnProperty.call(body || {}, col)) {
      out[col] = body[col];
    }
  }
  return out;
}

CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  subdominio TEXT UNIQUE NOT NULL,
  tipo TEXT NOT NULL,
  escala_maxima INTEGER DEFAULT 10,
  nota_minima_aprobacion NUMERIC DEFAULT 6,
  activa BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password TEXT NOT NULL,
  rol TEXT NOT NULL,
  nombre TEXT,
  apellido TEXT,
  genero TEXT,
  fecha_nacimiento TEXT,
  identificacion TEXT,
  tipo_documento TEXT,
  eps TEXT,
  tipo_sangre TEXT,
  contacto_emergencia JSONB,
  discapacidad TEXT,
  institucion_id TEXT REFERENCES institutions(id) ON DELETE SET NULL,
  activo BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY,
  institucion_id TEXT REFERENCES institutions(id) ON DELETE CASCADE,
  nombre TEXT,
  tipo_grado TEXT
);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  institucion_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  nombre TEXT,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  profesor_id TEXT,
  materia_id TEXT,
  grado_id TEXT,
  institucion_id TEXT
);

CREATE TABLE IF NOT EXISTS student_grades (
  id TEXT PRIMARY KEY,
  estudiante_id TEXT,
  grado_id TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  estudiante_id TEXT,
  materia_id TEXT,
  grado_id TEXT,
  fecha TEXT,
  estado TEXT,
  periodo_id TEXT,
  registrado_por TEXT
);

CREATE TABLE IF NOT EXISTS marks (
  id TEXT PRIMARY KEY,
  estudiante_id TEXT,
  materia_id TEXT,
  grado_id TEXT,
  evaluacion_id TEXT,
  tipo_evaluacion TEXT,
  fecha_evaluacion TEXT,
  porcentaje NUMERIC,
  nota NUMERIC,
  periodo TEXT,
  registrado_por TEXT
);

CREATE TABLE IF NOT EXISTS citations (
  id TEXT PRIMARY KEY,
  estudiante_id TEXT,
  materia_id TEXT,
  fecha_citacion TEXT,
  motivo TEXT,
  estado TEXT,
  creado_por TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  remitente_id TEXT,
  destinatario_id TEXT,
  materia_id TEXT,
  asunto TEXT,
  cuerpo TEXT,
  leido BOOLEAN DEFAULT false,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  institucion_id TEXT,
  materia_id TEXT,
  grado_id TEXT,
  nombre TEXT,
  fecha_evaluacion TEXT,
  porcentaje NUMERIC,
  periodo TEXT,
  creado_por TEXT
);

-- Periodos académicos por institución (catálogo; la administración es fase 2).
CREATE TABLE IF NOT EXISTS academic_periods (
  id TEXT PRIMARY KEY,
  institucion_id TEXT,
  nombre TEXT,
  numero NUMERIC,
  anio NUMERIC,
  fecha_inicio TEXT,
  fecha_fin TEXT,
  activo BOOLEAN DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_users_institucion ON users(institucion_id);
CREATE INDEX IF NOT EXISTS idx_grades_institucion ON grades(institucion_id);
CREATE INDEX IF NOT EXISTS idx_marks_estudiante ON marks(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_attendance_estudiante ON attendance(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_citations_estudiante ON citations(estudiante_id);
CREATE INDEX IF NOT EXISTS idx_messages_destinatario ON messages(destinatario_id);

-- Un estudiante solo puede tener una nota por evaluación
CREATE UNIQUE INDEX IF NOT EXISTS uq_marks_student_evaluation ON marks (estudiante_id, evaluacion_id);

-- Migración idempotente: añade tipo_documento a bases ya creadas.
ALTER TABLE users ADD COLUMN IF NOT EXISTS tipo_documento TEXT;

-- Migración idempotente: elimina el cupo máximo de grados (ya no se usa).
ALTER TABLE grades DROP COLUMN IF EXISTS cupo_maximo;

-- Migración idempotente: año académico y periodo_id para el historial.
ALTER TABLE marks ADD COLUMN IF NOT EXISTS anio TEXT;
ALTER TABLE marks ADD COLUMN IF NOT EXISTS periodo_id TEXT;

-- Backfill idempotente del año a partir de la fecha de la evaluación.
-- Solo actualiza filas sin año y con fecha válida YYYY-MM-DD; el resto queda NULL.
UPDATE marks
SET anio = LEFT(fecha_evaluacion, 4)
WHERE anio IS NULL AND fecha_evaluacion ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}';

-- Migración idempotente: año académico y periodo_id para las evaluaciones.
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS anio TEXT;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS periodo_id TEXT;

-- Backfill idempotente del año de las evaluaciones desde su fecha.
UPDATE evaluations
SET anio = LEFT(fecha_evaluacion, 4)
WHERE anio IS NULL AND fecha_evaluacion ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}';

-- Migración idempotente: escala de calificación por institución.
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS escala_maxima INTEGER;

-- La escala es configurable por institución: 5, 10 o 100.
ALTER TABLE institutions DROP CONSTRAINT IF EXISTS chk_institutions_escala;
ALTER TABLE institutions
  ADD CONSTRAINT chk_institutions_escala
  CHECK (escala_maxima IS NULL OR escala_maxima IN (5, 10, 100));

-- La nota mínima de aprobación es un umbral: nunca 0 y nunca fuera de la escala.
ALTER TABLE institutions DROP CONSTRAINT IF EXISTS chk_institutions_nota_minima;
ALTER TABLE institutions
  ADD CONSTRAINT chk_institutions_nota_minima
  CHECK (nota_minima_aprobacion IS NULL OR (nota_minima_aprobacion >= 1 AND nota_minima_aprobacion <= escala_maxima));

-- Migración idempotente: asistencia asociada al periodo académico.
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS periodo_id TEXT;
CREATE INDEX IF NOT EXISTS idx_attendance_periodo ON attendance(periodo_id);

-- Migración idempotente: el correo deja de ser obligatorio (sigue siendo único).
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- La identificación es única por institución (no global), cuando existe.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_identificacion_inst
  ON users("institucion_id", identificacion) WHERE identificacion IS NOT NULL;

-- Migración idempotente: las materias pertenecen a una institución.
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS institucion_id TEXT;
-- Backfill idempotente de materias huérfanas: se asignan a una institución que
-- las use vía assignments, o a la única/primera institución como último recurso.
UPDATE subjects s
SET institucion_id = (
  SELECT a."institucion_id"
  FROM assignments a
  WHERE a."materia_id" = s.id
  LIMIT 1
)
WHERE s."institucion_id" IS NULL;

UPDATE subjects s
SET institucion_id = (SELECT id FROM institutions ORDER BY id LIMIT 1)
WHERE s."institucion_id" IS NULL AND EXISTS (SELECT 1 FROM institutions);

ALTER TABLE subjects ALTER COLUMN institucion_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subjects_institucion ON subjects("institucion_id");
ALTER TABLE subjects DROP CONSTRAINT IF EXISTS fk_subjects_institucion;
ALTER TABLE subjects
  ADD CONSTRAINT fk_subjects_institucion
  FOREIGN KEY ("institucion_id") REFERENCES institutions(id) ON DELETE CASCADE;

-- Configuración de boletines/documentos por institución. La config es JSON
-- ligero (plantilla, colores, secciones visibles); el logo se referencia por
-- URL. Institución sin fila activa → el renderer usa la plantilla default.
CREATE TABLE IF NOT EXISTS institution_report_configs (
  id TEXT PRIMARY KEY,
  institucion_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  logo_url TEXT,
  version INTEGER DEFAULT 1,
  activo BOOLEAN DEFAULT true,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_report_configs_institucion ON institution_report_configs("institucion_id");
CREATE UNIQUE INDEX IF NOT EXISTS uq_report_configs_inst_tipo
  ON institution_report_configs("institucion_id", "tipo_documento");

-- Logros por assignment + período (texto compartido por todo el grupo/materia)
CREATE TABLE IF NOT EXISTS subject_achievements (
  id TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  periodo_id TEXT NOT NULL REFERENCES academic_periods(id) ON DELETE CASCADE,
  texto VARCHAR(1000) NOT NULL,
  updated_by TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subject_achievements_assign_periodo
  ON subject_achievements(assignment_id, periodo_id);

-- Observaciones por estudiante + período (una por estudiante, last-write-wins)
CREATE TABLE IF NOT EXISTS student_observations (
  id TEXT PRIMARY KEY,
  estudiante_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  periodo_id TEXT NOT NULL REFERENCES academic_periods(id) ON DELETE CASCADE,
  texto VARCHAR(1000) NOT NULL,
  updated_by TEXT,
  updated_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_observations_est_periodo
  ON student_observations(estudiante_id, periodo_id);

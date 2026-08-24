/**
 * Aislamiento multi-institución en lectura.
 *
 * Cada recurso declara su propia estrategia; añadir un recurso es añadir una
 * entrada al mapa, no editar un switch (principio abierto/cerrado).
 * El resultado es un fragmento WHERE parametrizado que consume el repositorio.
 */

const SIN_FILTRO = { where: '', params: [] };
const NADA = { where: '1 = 0', params: [] };

const mismaInstitucion = ({ instId }) => ({ where: '"institucion_id" = $1', params: [instId] });
const soloPropias = ({ uid }) => ({ where: '"estudiante_id" = $1', params: [uid] });
const porGradoDeLaInstitucion = ({ instId }) => ({
  where: '"grado_id" IN (SELECT id FROM grades WHERE "institucion_id" = $1)',
  params: [instId],
});

/** El estudiante solo ve lo suyo; el resto del personal, lo de su institución. */
const propiasOInstitucion = (deLaInstitucion) => (ctx) =>
  ctx.rol === 'student' ? soloPropias(ctx) : deLaInstitucion(ctx);

const scopeByResource = {
  users: mismaInstitucion,
  grades: mismaInstitucion,
  assignments: mismaInstitucion,
  evaluations: mismaInstitucion,
  academic_periods: mismaInstitucion,
  subjects: mismaInstitucion,

  institutions: ({ instId }) => ({ where: '"id" = $1', params: [instId] }),

  student_grades: propiasOInstitucion(porGradoDeLaInstitucion),
  marks: propiasOInstitucion(porGradoDeLaInstitucion),
  attendance: propiasOInstitucion(porGradoDeLaInstitucion),

  citations: propiasOInstitucion(({ instId }) => ({
    where:
      '("estudiante_id" IN (SELECT id FROM users WHERE "institucion_id" = $1) OR "creado_por" IN (SELECT id FROM users WHERE "institucion_id" = $1))',
    params: [instId],
  })),

  messages: ({ uid }) => ({
    where: '("remitente_id" = $1 OR "destinatario_id" = $1)',
    params: [uid],
  }),

  // `subjects` no aparece: es un catálogo global compartido entre instituciones.
};

export function buildReadScope(resource, user) {
  if (!user || user.rol === 'super_admin') return SIN_FILTRO;

  const instId = user.institucion_id;
  if (!instId) return NADA;

  const strategy = scopeByResource[resource];
  if (!strategy) return SIN_FILTRO;

  return strategy({ instId, uid: user.sub, rol: user.rol });
}

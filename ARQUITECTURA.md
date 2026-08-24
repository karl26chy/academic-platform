# Arquitectura

Arquitectura por capas pragmática. La regla es una sola: **cada capa solo conoce a la de abajo**.

---

## Backend (`api/`)

```
src/
├── server.js            arranque: conecta la BD y abre el puerto
├── app.js               ensambla Express (sin listen) → montable desde pruebas
├── config/              lectura de entorno; único sitio que toca process.env
├── db/                  pool de conexiones a PostgreSQL
├── routes/              verbo + ruta → controlador. Nada más
├── controllers/         traducen HTTP ↔ dominio: leen req, eligen status, responden
├── services/            casos de uso: autorizar → validar → persistir
├── repositories/        todo el SQL; única capa que importa el pool
├── policies/            quién ve qué (read-scope) y quién escribe qué (write-access)
├── validators/          forma y rango de los datos, por recurso
├── middleware/          token, rate limit y manejo central de errores
└── shared/              utilidades sin dominio: HttpError, ids, bcrypt
```

### Qué NO debe pasar

| Capa | Prohibido |
|---|---|
| `routes/` | lógica, SQL, `res.json` |
| `controllers/` | SQL, reglas de negocio |
| `services/` | tocar `req`/`res`, escribir SQL literal |
| `repositories/` | reglas de negocio, conocer HTTP |
| `policies/` y `validators/` | conocer HTTP |

### Flujo de una petición

```
GET /api/marks
  → resource.routes         declara la ruta
  → requireAuthOrPublic     verifica el token (institutions/GET es público)
  → resource.controller     extrae params, elige el status
  → resource.service        pide el alcance de lectura y delega
  → read-scope.policy       "un estudiante solo ve SUS notas"
  → resource.repository     SELECT con el WHERE parametrizado
```

### Añadir un recurso nuevo

1. Declararlo en `repositories/registry.js` (columnas, ocultas, secretas).
2. Si necesita aislamiento por institución, añadir su estrategia en `policies/read-scope.policy.js`.
3. Si necesita reglas de escritura, añadir su estrategia en `policies/write-access.policy.js`.
4. Si necesita validación, añadir su validador en `validators/`.

No hay que tocar rutas, controladores ni repositorios: son genéricos.

---

## Frontend (`client/`)

```
src/
├── lib/                 cálculos puros y testeables (sin React, sin fetch)
├── types/               contratos de datos compartidos
├── services/
│   ├── http.ts          transporte: URL base, token, manejo del 401
│   ├── api/             un módulo por recurso + fachada `api`
│   └── export/          generación de PDF y Excel
├── context/             app-context (contrato) · AppProvider · useApp
├── hooks/               estado con ciclo de vida: sesión, datos, mensajería
└── components/
    ├── ui/              primitivas sin lógica de dominio
    ├── charts/          gráficas reutilizables
    ├── messaging/       bandeja compartida entre docente y estudiante
    ├── layout/ · auth/
    └── dashboards/<rol>/  un archivo por pestaña
```

### Reglas

- `lib/` no importa React ni servicios: son funciones puras.
- Los componentes no llaman a `fetch`: usan `services/api`.
- La lógica con ciclo de vida vive en `hooks/`, no en el cuerpo del componente.
- `components/ui/` no conoce el dominio: recibe datos ya preparados.

---

## Reglas de negocio y dónde viven

| Regla | Ubicación |
|---|---|
| Aislamiento multi-institución en lectura | `api/src/policies/read-scope.policy.js` |
| Quién puede crear/editar/borrar cada recurso | `api/src/policies/write-access.policy.js` |
| Escala de notas 0-10 (colegio) / 0-5 (universidad) | `api/src/validators/marks.validator.js` |
| Una nota por estudiante y evaluación | índice único `uq_marks_student_evaluation` en `schema.sql` |
| Promedio ponderado Σ(nota×%) / Σ(%) | `client/src/lib/grades.ts` |
| Acceso por subdominio y estado de la institución | `client/src/hooks/useAuthSession.ts` |

> El promedio ponderado se calcula en el cliente. Es la única regla de negocio
> que vive fuera del API; se mantuvo así para no alterar el comportamiento actual.

---

## Entorno local vs producción

- **Desarrollo:** `docker-compose.local.yml` (`name: pruebas-app-local`) levanta PG en `55432:5432` + API `5000` + Vite `5173`. `DATABASE_URL` siempre local (`db:5432` interno). Ver `/.env.local` y `docker-compose.local.yml:39`.
- **Guard anti-producción:** `api/src/config/index.js` y `api/src/db/pool.js` abortan si `DATABASE_URL` contiene `supabase.co`/`pooler.supabase.com` con `NODE_ENV != production`. Protege tanto `docker compose` como `node src/server.js` directo.
- **Overlay remoto:** `docker-compose.supabase-remote.yml` requiere `--profile supabase-remote` + `NODE_ENV=production` para conectar a Supabase a propósito (debug). Sin profile no se activa.
- **Producción:** `Dockerfile.production` + `render.yaml` (un solo Web Service, `DATABASE_URL` inyectado por dashboard).

## Pruebas

`api/tests/` congela el comportamiento del API: 110 verificaciones sobre
autenticación, lecturas públicas, aislamiento multi-institución, RBAC de
escritura, validaciones, CRUD y errores.

```bash
cd api && npm test
```

El runner arranca su propia instancia de la API, crea un mundo de pruebas con
dos instituciones aisladas y lo borra al terminar. Necesita una base PostgreSQL
accesible; se configura con `TEST_DATABASE_URL` (default `postgres://platform:platform@localhost:55432/platform`, alinea con PG local).

Los tests documentan el comportamiento **actual**, incluidos los defectos
conocidos marcados como tales. Si se corrige uno, hay que invertir su test.

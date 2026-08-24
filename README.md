# Plataforma Educativa Multi-Institución

Sistema integral de gestión académica para colegios y universidades, con soporte multi-institucional basado en subdominios. Inspirado en Q10.

## Arquitectura

Arquitectura por capas: cada capa solo conoce a la de abajo.
Detalle completo y reglas en [ARQUITECTURA.md](ARQUITECTURA.md).

```
/
├── api/                      # API (Express + PostgreSQL + JWT, ESM)
│   ├── src/
│   │   ├── server.js         # arranque
│   │   ├── app.js            # ensamblado de Express
│   │   ├── routes/           # verbo + ruta → controlador
│   │   ├── controllers/      # HTTP ↔ dominio
│   │   ├── services/         # casos de uso
│   │   ├── repositories/     # todo el SQL
│   │   ├── policies/         # aislamiento multi-institución + RBAC
│   │   ├── validators/       # validación por recurso
│   │   ├── middleware/       # auth, rate limit, errores
│   │   ├── config/ · db/ · shared/
│   ├── tests/                # suite que congela el comportamiento del API
│   ├── schema.sql            # Esquema de tablas
│   ├── scripts/setup.js      # Crea esquema y siembra datos iniciales (db.json)
│   └── db.json               # Datos iniciales de seed
├── client/                   # Frontend (React + Vite + TypeScript + Tailwind)
│   └── src/
│       ├── lib/              # cálculos puros (promedios, asistencia, edades)
│       ├── services/         # http · api/ · export/
│       ├── context/ · hooks/ # estado global y ciclo de vida
│       └── components/       # ui/ · charts/ · messaging/ · dashboards/<rol>/
└── docker-compose.yml        # Despliegue: PostgreSQL + API + Nginx
```

## Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8 + TypeScript 6 |
| Estilos | Tailwind CSS 4 |
| Gráficas | Recharts |
| Backend | Express + PostgreSQL 16 |
| Auth | JWT + bcrypt (passwords hasheadas) |
| Exportación | jsPDF, SheetJS (xlsx) |
| Despliegue | Docker Compose + Nginx + Let's Encrypt |

## Inicio Rápido (Docker - recomendado)

```bash
# 1. Configura las variables (opcional; hay defaults)
cp .env.example .env

# 2. Construye e inicia todo
docker compose up -d --build

# 3. Abre el frontend
#    http://localhost:8080
```

El primer arranque crea el esquema en PostgreSQL y siembra los datos de `api/db.json` automáticamente. Los datos persisten en el volumen `pgdata`.

## Desarrollo Local (aislado de producción)

> ⚠️ **Nunca uses Supabase producción en desarrollo.** El guard en `api/src/config/index.js` bloquea el arranque si `DATABASE_URL` contiene `supabase.co` con `NODE_ENV != production`.

### Opción A — Docker (recomendado, un comando)

```bash
# 1. Variables locales (ya existe .env.local; si no: cp .env.local.example .env.local)
# 2. Levanta PostgreSQL + API + Client
docker compose -f docker-compose.local.yml up -d --build

# Backend → http://localhost:5000
# Frontend (Vite) → http://localhost:5173
# PostgreSQL → localhost:55432  (usuario: platform, DB: platform)

# Seed de desarrollo (institución demo + usuarios + notas)
docker compose -f docker-compose.local.yml exec api npm run seed:local
# o desde el host:
DATABASE_URL=postgresql://platform:platform@localhost:55432/platform npm run seed:local --prefix api

# Verificar aislamiento
npm run verify:isolation --prefix api
docker compose -f docker-compose.local.yml logs -f

# Detener
docker compose -f docker-compose.local.yml down
```

Credenciales del seed local (`api/scripts/seed-local.js`):
- Super Admin: `super@local.test` / `Super123!` (sin subdominio)
- Admin: `admin@demo-local.test` / `Admin123!` (subdominio `demo-local`)
- Docentes: `doc1@demo-local.test` / `Doc123!`, `doc2@demo-local.test` / `Doc123!`
- Estudiantes: `est1@demo-local.test`..`est10@demo-local.test` / `Est123!` (login por identificación `EST-DEMO-001`..)

### Opción B — Sin Docker (API + Client directo)

```bash
# API
cd api
npm install
# DATABASE_URL local: localhost:55432 (NO Supabase)
DATABASE_URL=postgresql://platform:platform@localhost:55432/platform npm run setup
DATABASE_URL=postgresql://platform:platform@localhost:55432/platform npm run seed:local
DATABASE_URL=postgresql://platform:platform@localhost:55432/platform npm run dev  # http://localhost:5000

# Cliente
cd client
npm install
npm run dev  # http://localhost:5173 (proxya /api → localhost:5000)
```

### Variables de entorno local

- `/.env.local` (raíz) — estándar del proyecto. No se commitea (`.gitignore: .env.*`). Plantilla: `.env.local.example`.
- `api/.env.example` — `DATABASE_URL=postgresql://platform:platform@localhost:55432/platform?sslmode=disable`.
- `api/.env` y `/.env` están **vaciados a propósito** para que un arranque sin env falle claro en vez de tocar producción.

### Overlay remoto (solo debug intencional contra Supabase)

```bash
# Requiere profile explícito + NODE_ENV=production (el guard bloquea sin él)
docker compose -f docker-compose.local.yml -f docker-compose.supabase-remote.yml --profile supabase-remote up -d --build api client
```

## Pruebas

```bash
cd api
npm test                  # suite completa del API (110 verificaciones)
```

El runner arranca su propia instancia de la API, crea dos instituciones de
prueba aisladas y limpia todo al terminar. Apunta a la base indicada en
`TEST_DATABASE_URL` (por defecto `postgres://platform:platform@localhost:55432/platform`).

Una base de pruebas desechable:

```bash
docker run -d --name pruebas-app-testdb \
  -e POSTGRES_USER=platform -e POSTGRES_PASSWORD=platform -e POSTGRES_DB=platform \
  -p 55432:5432 postgres:16-alpine
```

## Despliegue a Producción

### 1. VPS con Docker

```bash
git clone <tu-repo> && cd <carpeta>
cp .env.example .env
# Edita .env: JWT_SECRET obligatorio, POSTGRES_PASSWORD fuerte
docker compose up -d --build
```

### 2. DNS

Crea un registro **wildcard** y el subdominio del portal admin apuntando a tu VPS:

- `*.tudominio.com` → IP del VPS
- `admin.tudominio.com` → IP del VPS

### 3. Nginx + dominio real

El archivo `client/nginx.conf` usa el placeholder `TU_DOMINIO`. Reemplázalo por tu dominio real:

```nginx
server_name ~^(?<subdomain>.+)\.tudominio\.com$;   # instituciones
server_name admin.tudominio.com;                    # portal super admin
```

Luego reconstruye el contenedor del cliente: `docker compose up -d --build client`.

### 4. SSL (Let's Encrypt)

Con `certbot` en el host, apuntando a los contenedores:

```bash
# opción 1: certbot standalone + recargar nginx del contenedor
docker compose run --rm --service-ports certbot certonly --standalone \
  -d tudominio.com -d '*.tudominio.com' -d admin.tudominio.com \
  --preferred-challenges http
```

> Recomendado: añadir un contenedor `certbot` + `certbot.timer` para renovación automática, y redirigir HTTP→HTTPS en `nginx.conf`.

### 5. Backups

```bash
docker compose exec db pg_dump -U platform platform > backup_$(date +%F).sql
```

## Credenciales de Prueba (seed inicial)

> La base de datos se despliega vacía con un único super administrador.
> Inicia sesión y desde el dashboard crea instituciones, usuarios, grados y materias.

### Super Admin (sin subdominio)

Se crea manualmente con `api/scripts/seed-supabase.js` definiendo las variables de entorno:

```bash
SUPER_EMAIL=tu@email.com SUPER_PASSWORD=tu-password \
DATABASE_URL=<connection-string> \
node api/scripts/seed-supabase.js
```

> No se guardan credenciales reales en el repositorio. En Render, ejecútalo desde la
> consola Shell del servicio backend una sola vez cuando estés listo.

## Funcionalidades

- **Super Admin:** CRUD de instituciones, activar/desactivar
- **Admin:** Gestión de usuarios, grados, materias, asignaciones profesor-materia-grado, dashboard con métricas y materias deficientes
- **Profesor:** Toma de asistencia, ingreso de notas, citaciones, mensajería privada
- **Estudiante:** Gráfico de rendimiento con nota mínima, historial de asistencias, citaciones, mensajería

## Seguridad

- Contraseñas hasheadas con bcrypt (nunca se devuelven por el API)
- Autenticación JWT con expiración; las rutas de escritura y lectura están protegidas
- Lecturas públicas: solo `GET /institutions` (necesario para el login; si va con token válido, se acota a la institución del usuario)
- **Aislamiento multi-institucional:** cada usuario solo lee datos de su institución; los estudiantes solo ven SUS notas/asistencias/citaciones
- **RBAC de escritura:** solo el Super Admin gestiona instituciones; solo los admins crean usuarios/grados/materias; los profesores solo registran notas/asistencia/evaluaciones de su materia-grado asignada; los estudiantes no escriben datos académicos
- **Validación de notas server-side:** rango 0–10 (colegio) o 0–5 (universidad), según la institución; una nota por estudiante y evaluación (duplicados → 409)
- Rate limiting en `/auth/login` (anti fuerza bruta)
- Security headers (CSP, X-Frame-Options, nosniff) en Nginx

## Módulo de Notas

- **Upsert:** al guardar calificaciones se actualiza la nota existente del estudiante en esa evaluación (no crea duplicados)
- **Prefill:** al seleccionar una evaluación ya calificada se muestran las notas guardadas para editar
- **Escala por institución:** `0–10` colegios, `0–5` universidades
- **Promedios ponderados:** el rendimiento por materia usa `Σ(nota × porcentaje) / Σ(porcentaje)` (gráfica del estudiante, métricas y boletín del admin)

## Fases

- [x] FASE 1: Setup del proyecto
- [x] FASE 2: Super Admin
- [x] FASE 3: Admin Institución
- [x] FASE 4: Profesor
- [x] FASE 5: Estudiante
- [x] FASE 6: Exportación PDF/Excel
- [x] FASE 7: Pruebas automatizadas del API (`api/tests`)
- [ ] FASE 7b: Pruebas del frontend
- [ ] FASE 8: Despliegue producción (SSL + dominio)

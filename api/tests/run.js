import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWorld, destroyWorld } from './helpers/fixtures.js';
import { report, suite } from './helpers/runner.js';

import authSuite from './suites/auth.js';
import publicReadSuite from './suites/public-read.js';
import scopeSuite from './suites/scope.js';
import rbacWriteSuite from './suites/rbac-write.js';
import validationSuite from './suites/validation.js';
import crudSuite from './suites/crud.js';
import errorsSuite from './suites/errors.js';
import periodsSuite from './suites/periods.js';
import gradingSuite from './suites/grading.js';
import attendanceSuite from './suites/attendance.js';
import subjectsSuite from './suites/subjects.js';
import studentsSuite from './suites/students.js';
import reportsSuite from './suites/reports.js';
import evaluationsSuite from './suites/evaluations.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, '..');

const PORT = process.env.TEST_PORT || '5099';
const DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://platform:platform@localhost:55432/platform';

process.env.API_URL = process.env.API_URL || `http://localhost:${PORT}/api`;

/** El punto de entrada cambia de nombre durante el refactor; lo detectamos. */
function resolveEntry() {
  if (process.env.API_ENTRY) return process.env.API_ENTRY;
  for (const candidate of ['src/server.js', 'src/index.js']) {
    if (existsSync(path.join(apiRoot, candidate))) return candidate;
  }
  throw new Error('No se encontró el punto de entrada de la API.');
}

function run(command, args, { quiet = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: apiRoot,
      env: {
        ...process.env,
        DATABASE_URL,
        PORT,
        JWT_SECRET: 'test-secret',
        NODE_ENV: 'test',
        SUPER_EMAIL: 'super@test.local',
        SUPER_PASSWORD: 'test1234',
      },
      stdio: quiet ? 'ignore' : 'inherit',
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} salió con código ${code}`))));
    child.on('error', reject);
  });
}

function startServer(entry) {
  const child = spawn('node', [entry], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL, PORT, JWT_SECRET: 'test-secret', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));
  return { child, logs };
}

async function waitForHealth(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/health`);
      if (res.ok) return true;
    } catch {
      // el servidor todavía no acepta conexiones
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

async function main() {
  const entry = resolveEntry();
  console.log(`\n  API      : ${entry}`);
  console.log(`  Base     : ${process.env.API_URL}`);
  console.log(`  Postgres : ${DATABASE_URL.replace(/:[^:@]*@/, ':****@')}\n`);

  console.log('>> Preparando esquema...');
  await run('node', ['scripts/setup.js'], { quiet: true });
  console.log('>> Creando super admin de prueba...');
  await run('node', ['scripts/seed-supabase.js'], { quiet: true });

  const { child, logs } = startServer(entry);
  let world = null;
  let exitCode = 1;

  try {
    if (!await waitForHealth()) {
      throw new Error(`La API no respondió en /api/health.\n${logs.join('')}`);
    }

    world = await buildWorld();

    await authSuite(world);
    await publicReadSuite(world);
    await scopeSuite(world);
    await rbacWriteSuite(world);
    await validationSuite(world);
    await crudSuite(world);
    await errorsSuite(world);
    await periodsSuite(world);
    await gradingSuite(world);
    await attendanceSuite(world);
    await subjectsSuite(world);
    await studentsSuite(world);
    await reportsSuite(world);
    await evaluationsSuite(world);

    exitCode = report();
  } catch (err) {
    suite('Error fatal');
    console.error(`\n  ${err.message}\n`);
    exitCode = 1;
  } finally {
    if (world) {
      await destroyWorld(world).catch((err) => {
        console.error('  Aviso: la limpieza dejó residuos:', err.message);
      });
    }
    child.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    if (!child.killed) child.kill('SIGKILL');
  }

  process.exit(exitCode);
}

main();

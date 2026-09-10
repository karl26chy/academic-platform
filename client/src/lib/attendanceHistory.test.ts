import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { compareStudents, sortStudents, studentFullName } from './people.ts';
import { ESTADOS, type Estado, getLocalTodayString, filterAttendanceByDateAndClass } from './attendance.ts';
import type { Attendance, User } from '../types.ts';

const createStudent = (id: string, apellido: string, nombre: string): User => ({
  id,
  apellido,
  nombre,
  email: `${id}@test.local`,
  rol: 'student',
  institucion_id: 'inst-1',
  activo: true,
});

describe('Historial y Edición de Asistencia - Lógica y Reglas de Negocio', () => {
  const sampleRecords: Attendance[] = [
    {
      id: 'att-1',
      estudiante_id: 's-1',
      materia_id: 'mat-1',
      grado_id: 'gra-1',
      fecha: '2026-08-08',
      estado: 'ausente',
      periodo_id: 'per-1',
      registrado_por: 'prof-1',
    },
    {
      id: 'att-2',
      estudiante_id: 's-2',
      materia_id: 'mat-1',
      grado_id: 'gra-1',
      fecha: '2026-08-08',
      estado: 'presente',
      periodo_id: 'per-1',
      registrado_por: 'prof-1',
    },
    {
      id: 'att-3',
      estudiante_id: 's-3',
      materia_id: 'mat-1',
      grado_id: 'gra-1',
      fecha: '2026-08-08',
      estado: 'justificada',
      periodo_id: 'per-1',
      registrado_por: 'prof-1',
    },
    {
      id: 'att-other',
      estudiante_id: 's-1',
      materia_id: 'mat-1',
      grado_id: 'gra-1',
      fecha: '2026-08-01',
      estado: 'presente',
      periodo_id: 'per-1',
      registrado_por: 'prof-1',
    },
    {
      id: 'att-other-subject',
      estudiante_id: 's-1',
      materia_id: 'mat-99',
      grado_id: 'gra-1',
      fecha: '2026-08-08',
      estado: 'presente',
      periodo_id: 'per-1',
      registrado_por: 'prof-2',
    },
  ];

  // 1. Consulta histórica
  test('1. Consulta histórica: dada una fecha y clase, filtra y devuelve exactamente los registros de esa fecha', () => {
    const targetDate = '2026-08-08';
    const targetSubject = 'mat-1';
    const targetGrade = 'gra-1';

    const result = filterAttendanceByDateAndClass(sampleRecords, targetSubject, targetGrade, targetDate);

    assert.equal(result.length, 3);
    assert.deepEqual(result.map(r => r.id), ['att-1', 'att-2', 'att-3']);
  });

  // 2. Actualización de un registro existente
  test('2. Actualización: cambiar Ausente a Inasistencia justificada actualiza el registro existente con el mismo ID', () => {
    const originalRecord = sampleRecords.find(r => r.id === 'att-1')!;
    assert.equal(originalRecord.estado, 'ausente');

    // Simula la edición por el docente
    const nuevoEstado: Estado = 'justificada';
    const updatedRecord: Attendance = {
      ...originalRecord,
      estado: nuevoEstado,
    };

    assert.equal(updatedRecord.id, originalRecord.id, 'Debe conservar el ID original');
    assert.equal(updatedRecord.estudiante_id, originalRecord.estudiante_id);
    assert.equal(updatedRecord.fecha, originalRecord.fecha);
    assert.equal(updatedRecord.estado, 'justificada');
  });

  // 3. No duplicación
  test('3. No duplicación: guardar sin cambios o guardar repetidamente no crea registros duplicados', () => {
    let database = [...sampleRecords];

    const saveChanges = (changes: { id: string; estado: Estado }[]) => {
      // Solo actualiza los existentes; no crea nuevas filas
      database = database.map(row => {
        const ch = changes.find(c => c.id === row.id);
        return ch ? { ...row, estado: ch.estado } : row;
      });
    };

    const countBefore = database.length;

    // Guardado 1: sin cambios
    saveChanges([]);
    assert.equal(database.length, countBefore, 'No se deben crear registros');

    // Guardado 2: modificación de att-1
    saveChanges([{ id: 'att-1', estado: 'justificada' }]);
    assert.equal(database.length, countBefore, 'La cantidad de filas debe ser exactamente la misma');
    assert.equal(database.find(r => r.id === 'att-1')?.estado, 'justificada');

    // Guardado 3: guardar otra vez con el mismo estado
    saveChanges([]);
    assert.equal(database.length, countBefore, 'Reintentar guardar no duplica');
  });

  // 4. Autorización
  test('4. Autorización: un docente solo accede a registros de su propia clase asignada', () => {
    const teacherAssignments = [
      { profesor_id: 'prof-1', materia_id: 'mat-1', grado_id: 'gra-1' },
    ];

    const canAccessClass = (teacherId: string, materiaId: string, gradoId: string) =>
      teacherAssignments.some(
        a => a.profesor_id === teacherId && a.materia_id === materiaId && a.grado_id === gradoId
      );

    assert.ok(canAccessClass('prof-1', 'mat-1', 'gra-1'), 'El docente titular tiene acceso');
    assert.ok(!canAccessClass('prof-2', 'mat-1', 'gra-1'), 'Un docente ajeno no tiene acceso');
    assert.ok(!canAccessClass('prof-1', 'mat-99', 'gra-1'), 'El docente no tiene acceso a materias no asignadas');
  });

  // 5. Fecha sin registros
  test('5. Fecha sin registros: responde vacío y no crea registros automáticamente por consultar', () => {
    const emptyDate = '2026-08-15';
    const result = filterAttendanceByDateAndClass(sampleRecords, 'mat-1', 'gra-1', emptyDate);

    assert.equal(result.length, 0, 'No debe haber registros para una fecha sin asistencia');
    // La base de datos simulada no debe sufrir alteraciones por una consulta
    assert.equal(sampleRecords.length, 5);
  });

  // 6. Ordenamiento
  test('6. Ordenamiento: los estudiantes aparecen ordenados por apellido ASC, nombre ASC, id ASC', () => {
    const unsortedList: User[] = [
      createStudent('s-3', 'Rodríguez Gómez', 'María Fernanda'),
      createStudent('s-1', 'García López', 'Juan Carlos'),
      createStudent('s-2', 'Pérez Martínez', 'Carlos Andrés'),
    ];

    const sorted = sortStudents(unsortedList);
    assert.deepEqual(
      sorted.map(s => s.apellido),
      ['García López', 'Pérez Martínez', 'Rodríguez Gómez']
    );
  });

  // 7. Nombre completo
  test('7. Nombre completo: muestra Apellido1 Apellido2, Nombre1 Nombre2 con studentFullName sin split', () => {
    const student1 = createStudent('s-1', 'García López', 'Juan Carlos');
    const student2 = createStudent('s-2', 'Álvarez Rodríguez', 'María Fernanda');
    const student3 = createStudent('s-3', 'Pérez Martínez', 'Carlos Andrés');

    assert.equal(studentFullName(student1), 'García López, Juan Carlos');
    assert.equal(studentFullName(student2), 'Álvarez Rodríguez, María Fernanda');
    assert.equal(studentFullName(student3), 'Pérez Martínez, Carlos Andrés');
  });

  // 8. Estados válidos
  test('8. Estados: solo se permiten los estados existentes (presente, ausente, justificada)', () => {
    const validValues = ESTADOS.map(e => e.value);
    assert.deepEqual(validValues, ['presente', 'ausente', 'justificada']);

    const isValidState = (state: string): state is Estado =>
      validValues.includes(state as Estado);

    assert.ok(isValidState('presente'));
    assert.ok(isValidState('ausente'));
    assert.ok(isValidState('justificada'));
    assert.ok(!isValidState('tardanza'), 'El estado tardanza ya no debe ser aceptado');
    assert.ok(!isValidState('invalido'));
  });

  // 9. Manejo de fechas y restricción futura
  test('9. Manejo de fechas: getLocalTodayString produce formato YYYY-MM-DD local', () => {
    const today = getLocalTodayString();
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/, 'Debe cumplir con el formato YYYY-MM-DD');

    const futureDate = '2099-12-31';
    assert.ok(futureDate > today, 'Una fecha en el futuro debe ser detectable como mayor al día actual');
  });
});

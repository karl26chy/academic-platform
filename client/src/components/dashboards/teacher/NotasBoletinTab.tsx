import React, { useEffect, useMemo, useState } from 'react';
import { Info, Lock } from 'lucide-react';
import { http } from '../../../services/http';
import { Card, EmptyMessage, PRIMARY_BUTTON, TableWrapper, TableHead, TableBody, toast } from '../../ui';
import { studentFullName } from '../../../lib/people';
import type { Assignment, Grade, Subject, User } from '../../../types';

/**
 * "Notas boletín" (TEMPORAL).
 *
 * La plataforma entró en uso en el cuarto periodo: aquí el docente carga la
 * DEFINITIVA de los periodos 1 a 3 de cada estudiante (la que ya se entregó)
 * para que el boletín de fin de año salga completo. El periodo 4 se sigue
 * calculando con las evaluaciones de la plataforma.
 */

interface NotasBoletinResponse {
  habilitado: boolean;
  anio: number;
  periodos: number[];
  notaMax: number;
  notas: { estudiante_id: string; numero: number; nota: number }[];
}

interface NotasBoletinTabProps {
  assignment: Assignment;
  subject?: Subject | null;
  grade?: Grade | null;
  students: User[];
}

const PERIODOS_POR_DEFECTO = [1, 2, 3];

const clave = (estudianteId: string, numero: number) => `${estudianteId}:${numero}`;

/** Valores guardados como texto, para comparar con lo que escribe el docente. */
function aMapa(notas: NotasBoletinResponse['notas']): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const n of notas) mapa[clave(n.estudiante_id, n.numero)] = String(n.nota);
  return mapa;
}

export const NotasBoletinTab: React.FC<NotasBoletinTabProps> = ({ assignment, subject, grade, students }) => {
  const [info, setInfo] = useState<NotasBoletinResponse | null>(null);
  const [guardadas, setGuardadas] = useState<Record<string, string>>({});
  const [valores, setValores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ruta = `/assignments/${encodeURIComponent(assignment.id)}/period-final-grades`;

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    http.get<NotasBoletinResponse>(ruta)
      .then(data => {
        if (cancelado) return;
        const mapa = aMapa(data.notas);
        setInfo(data);
        setGuardadas(mapa);
        setValores(mapa);
      })
      .catch(err => {
        if (!cancelado) setError(err instanceof Error ? err.message : 'No se pudieron cargar las notas.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => { cancelado = true; };
  }, [ruta]);

  const periodos = useMemo(() => info?.periodos ?? PERIODOS_POR_DEFECTO, [info]);
  const notaMax = info?.notaMax ?? 5;
  const bloqueado = !info?.habilitado;

  /** Celdas cuyo valor difiere de lo guardado. */
  const cambios = useMemo(() => {
    const lista: { estudiante_id: string; numero: number; nota: string | null }[] = [];
    for (const s of students) {
      for (const numero of periodos) {
        const k = clave(s.id, numero);
        const actual = (valores[k] ?? '').trim();
        if (actual !== (guardadas[k] ?? '')) {
          lista.push({ estudiante_id: s.id, numero, nota: actual === '' ? null : actual });
        }
      }
    }
    return lista;
  }, [students, periodos, valores, guardadas]);

  const fueraDeRango = cambios.some(c => {
    if (c.nota === null) return false;
    const n = Number(c.nota);
    return !Number.isFinite(n) || n < 0 || n > notaMax;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bloqueado || cambios.length === 0) return;
    if (fueraDeRango) {
      toast.error(`Las notas deben estar entre 0 y ${notaMax}.`);
      return;
    }
    setSaving(true);
    try {
      const data = await http.put<NotasBoletinResponse>(ruta, {
        notas: cambios.map(c => ({ ...c, nota: c.nota === null ? null : Number(c.nota) })),
      });
      const mapa = aMapa(data.notas);
      setInfo(data);
      setGuardadas(mapa);
      setValores(mapa);
      toast.success('Notas de boletín guardadas');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al guardar las notas.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-lg font-bold text-gray-900 break-words">
          Notas boletín — {subject?.nombre} ({grade?.nombre})
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Año {info?.anio ?? '…'} · Escala de 0 a {notaMax}
        </p>
      </div>

      <div className="mb-5 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 flex gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Escribe la <strong>definitiva</strong> que cada estudiante obtuvo en los periodos anteriores.
          Saldrá en el boletín en la columna de ese periodo. El <strong>periodo 4</strong> se sigue
          calculando con las evaluaciones de la plataforma. Deja la casilla vacía si no aplica.
        </p>
      </div>

      {loading ? (
        <EmptyMessage className="text-sm text-gray-500 py-6 text-center">Cargando notas…</EmptyMessage>
      ) : error ? (
        <EmptyMessage className="text-sm text-red-500 py-6 text-center">{error}</EmptyMessage>
      ) : students.length === 0 ? (
        <EmptyMessage className="text-gray-500 text-sm py-4">No hay estudiantes matriculados.</EmptyMessage>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {bloqueado && (
            <p className="text-sm text-gray-500 flex items-center gap-2">
              <Lock className="h-4 w-4" /> La carga de notas de boletín está desactivada; solo puedes consultarlas.
            </p>
          )}
          <TableWrapper>
            <TableHead uppercase>
              <th className="pb-3">Estudiante</th>
              {periodos.map(n => (
                <th key={n} className="pb-3 text-center">Periodo {n}</th>
              ))}
            </TableHead>
            <TableBody>
              {students.map(student => (
                <tr key={student.id} className="hover:bg-gray-50">
                  <td className="py-3 font-medium text-gray-900 min-w-[10rem]">{studentFullName(student)}</td>
                  {periodos.map(numero => {
                    const k = clave(student.id, numero);
                    const valor = valores[k] ?? '';
                    const n = Number(valor);
                    const invalido = valor.trim() !== '' && (!Number.isFinite(n) || n < 0 || n > notaMax);
                    const modificado = valor.trim() !== (guardadas[k] ?? '');
                    return (
                      <td key={numero} className="py-2 text-center">
                        <input
                          type="number" step="0.1" min="0" max={notaMax} inputMode="decimal"
                          aria-label={`${studentFullName(student)} — Periodo ${numero}`}
                          value={valor}
                          disabled={bloqueado || saving}
                          onChange={e => setValores(prev => ({ ...prev, [k]: e.target.value }))}
                          placeholder="—"
                          className={`w-20 px-2 py-1.5 bg-white border rounded-lg text-gray-900 text-center text-sm focus:outline-none focus:ring-1 focus:ring-q10-500 disabled:bg-gray-50 disabled:text-gray-500 ${
                            invalido ? 'border-red-400' : modificado ? 'border-amber-400' : 'border-gray-200'
                          }`}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </TableBody>
          </TableWrapper>

          {!bloqueado && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-3 pt-2">
              {cambios.length > 0 && (
                <span className="text-xs text-amber-600">
                  {cambios.length} {cambios.length === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}
                </span>
              )}
              <button
                type="submit"
                disabled={saving || cambios.length === 0}
                className={`px-6 ${PRIMARY_BUTTON} disabled:opacity-50`}
              >
                {saving ? 'Guardando…' : 'Guardar notas de boletín'}
              </button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
};

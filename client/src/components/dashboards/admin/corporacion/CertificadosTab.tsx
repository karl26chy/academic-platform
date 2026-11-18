import React, { useCallback, useEffect, useState } from 'react';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { certificates as certificatesApi } from '../../../../services/api';
import { Card, CardTitle, EmptyMessage, Field, INPUT, PRIMARY_BUTTON, toast } from '../../../ui';
import { ConfirmDeleteModal } from '../../super-admin/ConfirmDeleteModal';
import { useApp } from '../../../../context/useApp';
import { gradeLabel, sortStudents, studentFullName } from '../../../../lib/people';
import { formatoFecha, formatoTamano } from '../../../../lib/corporacion';
import type { Certificate } from '../../../../types';

const TAMANO_MAXIMO = 10 * 1024 * 1024;

/** El admin sube los certificados PDF de cada estudiante; el estudiante los descarga. */
export const CertificadosTab: React.FC = () => {
  const { user, users, grades, studentGrades } = useApp();
  const instId = user?.institucion_id;
  const estudiantes = sortStudents(users.filter(u => u.rol === 'student' && u.institucion_id === instId));

  const [busqueda, setBusqueda] = useState('');
  const [studentId, setStudentId] = useState('');
  const [lista, setLista] = useState<Certificate[]>([]);
  const [titulo, setTitulo] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [subiendo, setSubiendo] = useState(false);
  const [deleting, setDeleting] = useState<Certificate | null>(null);

  const q = busqueda.trim().toLowerCase();
  const filtrados = q
    ? estudiantes.filter(s => `${studentFullName(s)} ${s.identificacion ?? ''}`.toLowerCase().includes(q))
    : estudiantes;
  const grupoDe = (id: string) => gradeLabel(grades.find(g => g.id === studentGrades.find(sg => sg.estudiante_id === id)?.grado_id));
  const elegido = estudiantes.find(s => s.id === studentId);

  const cargar = useCallback(async (id: string) => {
    if (!id) return setLista([]);
    try {
      setLista(await certificatesApi.list(id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudieron cargar los certificados.');
    }
  }, []);

  useEffect(() => { void cargar(studentId); }, [studentId, cargar]);

  const elegirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f && f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      toast.error('El certificado debe ser un PDF.');
      setInputKey(k => k + 1);
      return setArchivo(null);
    }
    if (f && f.size > TAMANO_MAXIMO) {
      toast.error('El PDF supera los 10 MB.');
      setInputKey(k => k + 1);
      return setArchivo(null);
    }
    setArchivo(f);
    if (f && !titulo.trim()) setTitulo(f.name.replace(/\.pdf$/i, ''));
  };

  const subir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !archivo || !titulo.trim()) return;
    setSubiendo(true);
    try {
      await certificatesApi.upload(studentId, titulo.trim(), archivo);
      toast.success('Certificado subido.');
      setTitulo('');
      setArchivo(null);
      setInputKey(k => k + 1);
      await cargar(studentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir el certificado.');
    } finally {
      setSubiendo(false);
    }
  };

  const descargar = async (c: Certificate) => {
    try {
      await certificatesApi.download(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo descargar.');
    }
  };

  const eliminar = async () => {
    if (!deleting) return;
    try {
      await certificatesApi.remove(deleting.id);
      toast.success('Certificado eliminado.');
      await cargar(studentId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al eliminar.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <Card className="h-fit">
        <CardTitle icon={<Upload className="h-5 w-5 text-q10-600" />} className="mb-6">Subir certificado</CardTitle>
        <form onSubmit={subir} className="space-y-4">
          <Field label="Buscar estudiante">
            <input
              type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)}
              placeholder="Nombre o documento" className={INPUT}
            />
          </Field>
          <Field label={`Estudiante (${filtrados.length})`}>
            <select required value={studentId} onChange={e => setStudentId(e.target.value)} className={INPUT}>
              <option value="">-- Seleccionar --</option>
              {filtrados.map(s => <option key={s.id} value={s.id}>{studentFullName(s)}</option>)}
            </select>
          </Field>
          <Field label="Título">
            <input
              type="text" required maxLength={150} value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Certificado de Auxiliar en Enfermería" className={INPUT}
            />
          </Field>
          <Field label="Archivo PDF (máx. 10 MB)">
            <input key={inputKey} type="file" accept="application/pdf,.pdf" required onChange={elegirArchivo} className={`${INPUT} file:mr-3 file:border-0 file:bg-q10-50 file:text-q10-700 file:rounded-lg file:px-3 file:py-1`} />
          </Field>
          <button type="submit" disabled={subiendo} className={`w-full ${PRIMARY_BUTTON} disabled:opacity-60`}>
            {subiendo ? 'Subiendo…' : 'Subir certificado'}
          </button>
        </form>
      </Card>

      <Card className="lg:col-span-2">
        <CardTitle icon={<FileText className="h-5 w-5 text-q10-600" />} className="mb-1">
          {elegido ? `Certificados de ${studentFullName(elegido)}` : 'Certificados'}
        </CardTitle>
        {elegido && <p className="text-xs text-gray-500 mb-5">{grupoDe(elegido.id) || 'Sin grupo'}</p>}
        {!elegido ? (
          <EmptyMessage className="text-sm text-gray-500 py-8">Elige un estudiante para ver o subir sus certificados.</EmptyMessage>
        ) : lista.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-8">Este estudiante aún no tiene certificados.</EmptyMessage>
        ) : (
          <div className="space-y-2">
            {lista.map(c => (
              <div key={c.id} className="flex flex-wrap justify-between items-center gap-2 p-3 bg-white rounded-xl border border-gray-200">
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-900 block truncate">{c.titulo}</span>
                  <span className="text-xs text-gray-400">{formatoFecha(c.created_at)} · {formatoTamano(c.tamano)}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => descargar(c)} title="Descargar"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-q10-600 hover:bg-q10-50 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(c)} title="Eliminar certificado"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {deleting && (
        <ConfirmDeleteModal
          title="Eliminar certificado"
          message={<>¿Eliminar <strong>{deleting.titulo}</strong>? El estudiante ya no podrá descargarlo.</>}
          onCancel={() => setDeleting(null)}
          onConfirm={eliminar}
        />
      )}
    </div>
  );
};

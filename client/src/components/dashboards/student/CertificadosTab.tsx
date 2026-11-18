import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { certificates as certificatesApi } from '../../../services/api';
import { Card, CardTitle, EmptyMessage, toast } from '../../ui';
import { formatoFecha, formatoTamano } from '../../../lib/corporacion';
import type { Certificate } from '../../../types';

/** Corporaciones: el estudiante descarga los certificados que subió la institución. */
export const CertificadosTab: React.FC<{ studentId: string }> = ({ studentId }) => {
  const [lista, setLista] = useState<Certificate[] | null>(null);

  useEffect(() => {
    let vigente = true;
    certificatesApi.list(studentId)
      .then(l => { if (vigente) setLista(l); })
      .catch(err => {
        if (vigente) setLista([]);
        toast.error(err instanceof Error ? err.message : 'No se pudieron cargar tus certificados.');
      });
    return () => { vigente = false; };
  }, [studentId]);

  const descargar = async (c: Certificate) => {
    try {
      await certificatesApi.download(c);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo descargar.');
    }
  };

  return (
    <Card className="animate-fade-in">
      <CardTitle icon={<FileText className="h-5 w-5 text-q10-600" />} className="mb-6">Mis certificados</CardTitle>
      {lista === null ? (
        <div className="flex items-center text-sm text-gray-500 py-6"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando…</div>
      ) : lista.length === 0 ? (
        <EmptyMessage className="text-sm text-gray-500 py-8">Aún no tienes certificados. Cuando la institución los suba, aparecerán aquí.</EmptyMessage>
      ) : (
        <div className="space-y-2">
          {lista.map(c => (
            <div key={c.id} className="flex flex-wrap justify-between items-center gap-3 p-4 bg-white rounded-xl border border-gray-200">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-gray-900 block truncate">{c.titulo}</span>
                <span className="text-xs text-gray-400">{formatoFecha(c.created_at)} · {formatoTamano(c.tamano)}</span>
              </div>
              <button
                onClick={() => descargar(c)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-q10-600 hover:bg-q10-700 text-white text-sm font-semibold transition-colors"
              >
                <Download className="h-4 w-4" /> Descargar
              </button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

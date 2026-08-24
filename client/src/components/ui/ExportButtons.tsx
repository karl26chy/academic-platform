import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { exportToExcel } from '../../services/export';
import type { ExportTable } from '../../services/export';

interface ExportButtonsProps {
  /** Se evalúa al pulsar, para exportar siempre los datos vigentes. */
  build: () => ExportTable;
}

const BUTTON =
  'flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors';

/** Botón Excel sobre una tabla de datos. El sistema PDF fue eliminado. */
export const ExportButtons: React.FC<ExportButtonsProps> = ({ build }) => (
  <div className="flex gap-2">
    <button onClick={() => exportToExcel(build())} className={BUTTON}>
      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
    </button>
  </div>
);

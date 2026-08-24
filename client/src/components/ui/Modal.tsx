import React from 'react';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Ancho máximo del panel; por defecto el de los diálogos de detalle. */
  size?: 'sm' | 'lg' | 'xl';
}

const WIDTHS = { sm: 'max-w-sm', lg: 'max-w-lg', xl: 'max-w-xl' };

/** Diálogo modal: cierra al pulsar el fondo, no al pulsar el panel. */
export const Modal: React.FC<ModalProps> = ({ onClose, children, size = 'lg' }) => (
  <div
    className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
    onClick={onClose}
  >
    <div
      className={`bg-white rounded-2xl shadow-xl ${WIDTHS[size]} w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4`}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

export const ModalCloseButton: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
    ✕
  </button>
);

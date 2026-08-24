import React from 'react';
import { Reply } from 'lucide-react';
import { Modal, ModalCloseButton } from '../ui';
import type { Message } from '../../types';

interface MessageDetailModalProps {
  message: Message;
  currentUserId?: string;
  nameOf: (userId: string) => string;
  onClose: () => void;
  onReply: (msg: Message) => void;
}

/** Detalle de un mensaje con acción de responder. */
export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({
  message,
  currentUserId,
  nameOf,
  onClose,
  onReply,
}) => (
  <Modal onClose={onClose}>
    <div className="flex flex-wrap justify-between items-start gap-2">
      <div className="min-w-0">
        <h3 className="text-lg font-bold text-gray-900 break-words">{message.asunto}</h3>
        <p className="text-xs text-gray-500 mt-1">
          {message.remitente_id === currentUserId
            ? `Para: ${nameOf(message.destinatario_id)}`
            : `De: ${nameOf(message.remitente_id)}`}
          {' · '}
          {new Date(message.created_at).toLocaleDateString()}
        </p>
      </div>
      <ModalCloseButton onClose={onClose} />
    </div>

    <p className="text-sm text-gray-700 whitespace-pre-wrap">{message.cuerpo}</p>

    <div className="flex gap-2 pt-2">
      <button
        onClick={() => {
          onReply(message);
          onClose();
        }}
        className="flex items-center gap-1.5 px-4 py-2 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-xs transition-colors"
      >
        <Reply className="h-3.5 w-3.5" /> Responder
      </button>
      <button
        onClick={onClose}
        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold rounded-xl text-xs transition-colors"
      >
        Cerrar
      </button>
    </div>
  </Modal>
);

import React from 'react';
import { Inbox, Reply } from 'lucide-react';
import { Card, CardTitle, EmptyMessage } from '../ui';
import type { Message } from '../../types';

interface MessageThreadProps {
  messages: Message[];
  currentUserId?: string;
  unreadCount: number;
  /** Nombre visible del interlocutor. */
  nameOf: (userId: string) => string;
  onOpen: (msg: Message) => void;
  onReply: (msg: Message) => void;
}

/** Bandeja de conversaciones, común a docentes y estudiantes. */
export const MessageThread: React.FC<MessageThreadProps> = ({
  messages,
  currentUserId,
  unreadCount,
  nameOf,
  onOpen,
  onReply,
}) => (
  <Card>
    <div className="flex items-center justify-between mb-6">
      <CardTitle icon={<Inbox className="h-5 w-5 text-q10-600" />} className="">
        Conversaciones
      </CardTitle>
      {unreadCount > 0 && (
        <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-1 rounded-full">
          {unreadCount} no leído{unreadCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>

    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {messages.length === 0 ? (
        <EmptyMessage className="text-gray-500 text-xs py-4 text-center">Sin mensajes.</EmptyMessage>
      ) : (
        messages.map(msg => {
          const isSender = msg.remitente_id === currentUserId;
          const isUnread = !isSender && !msg.leido;
          return (
            <div
              key={msg.id}
              onClick={() => onOpen(msg)}
              className={`p-4 rounded-xl border text-xs space-y-1.5 transition-all cursor-pointer ${
                isUnread
                  ? 'bg-q10-50 border-q10-300 text-q10-700'
                  : isSender
                    ? 'bg-white border-gray-200 text-gray-600'
                    : 'bg-gray-50 border-gray-200 text-gray-600'
              }`}
            >
              <div className="flex justify-between items-start gap-2 font-semibold">
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  {isUnread && <span className="w-2 h-2 bg-q10-600 rounded-full shrink-0" />}
                  {isSender ? `Tú → ${nameOf(msg.destinatario_id)}` : nameOf(msg.remitente_id)}
                </span>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {new Date(msg.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="font-bold text-gray-900 break-words">{msg.asunto}</div>
              <p className="text-gray-500 mt-1 line-clamp-2">{msg.cuerpo}</p>
              <div className="flex justify-end pt-1">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onReply(msg);
                  }}
                  className="flex items-center gap-1 text-q10-600 hover:text-q10-700 text-[10px] font-semibold transition-colors"
                >
                  <Reply className="h-3 w-3" /> Responder
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  </Card>
);

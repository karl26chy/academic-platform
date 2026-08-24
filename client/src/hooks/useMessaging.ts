import { useMemo, useState } from 'react';
import { api } from '../services/api';
import { useApp } from '../context/useApp';
import { toast } from '../components/ui';
import type { Message } from '../types';

interface MessagingOptions {
  /** Materia que se asocia al mensaje según el destinatario elegido. */
  resolveMateriaId: (recipientId: string) => string | null;
  /** Confirmación mostrada al enviar; cada portal usa su propio texto. */
  successMessage?: string;
}

/**
 * Mensajería 1 a 1 entre docente y estudiante.
 * Docente y estudiante comparten exactamente el mismo flujo: bandeja
 * ordenada por fecha, marcar como leído al abrir, responder y enviar.
 */
export function useMessaging({
  resolveMateriaId,
  successMessage = 'Mensaje enviado',
}: MessagingOptions) {
  const { user, messages, refreshData } = useApp();

  const [recipientId, setRecipientId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  const unreadIncoming = useMemo(
    () => messages.filter(m => m.destinatario_id === user?.id && !m.leido).length,
    [messages, user]
  );

  /** Conversaciones del usuario, de la más reciente a la más antigua. */
  const thread = useMemo(
    () =>
      messages
        .filter(m => m.remitente_id === user?.id || m.destinatario_id === user?.id)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [messages, user]
  );

  const markAsRead = async (msgId: string) => {
    const msg = messages.find(m => m.id === msgId);
    if (msg && !msg.leido && msg.destinatario_id === user?.id) {
      await api.updateMessage(msgId, { leido: true });
      await refreshData();
    }
  };

  /** El interlocutor de un mensaje es siempre la otra parte. */
  const counterpartOf = (msg: Message) =>
    msg.remitente_id === user?.id ? msg.destinatario_id : msg.remitente_id;

  const startReply = (msg: Message) => {
    setReplyTo(msg);
    setRecipientId(counterpartOf(msg));
    setSubject(msg.asunto.startsWith('Re: ') ? msg.asunto : `Re: ${msg.asunto}`);
    setBody('');
  };

  const resetForm = () => {
    setRecipientId('');
    setSubject('');
    setBody('');
    setReplyTo(null);
  };

  const cancelReply = () => resetForm();

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId || !subject || !body || !user) return;

    try {
      await api.createMessage({
        remitente_id: user.id,
        destinatario_id: recipientId,
        materia_id: resolveMateriaId(recipientId),
        asunto: subject,
        cuerpo: body,
        leido: false,
        created_at: new Date().toISOString(),
      });
      resetForm();
      await refreshData();
      toast.success(successMessage);
    } catch {
      toast.error('Error al enviar mensaje');
    }
  };

  const openMessage = (msg: Message) => {
    setSelectedMessage(msg);
    if (msg.remitente_id !== user?.id) markAsRead(msg.id);
  };

  return {
    unreadIncoming,
    thread,
    form: { recipientId, setRecipientId, subject, setSubject, body, setBody },
    replyTo,
    selectedMessage,
    setSelectedMessage,
    openMessage,
    startReply,
    cancelReply,
    send,
  };
}

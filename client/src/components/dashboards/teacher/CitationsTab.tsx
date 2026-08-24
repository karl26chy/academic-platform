import React, { useState } from 'react';
import { Calendar } from 'lucide-react';
import { api } from '../../../services/api';
import { useApp } from '../../../context/useApp';
import { Card, CardTitle, Field, INPUT, PRIMARY_BUTTON, toast } from '../../ui';
import type { Assignment, User } from '../../../types';

interface CitationsTabProps {
  assignment: Assignment;
  students: User[];
  teacherId: string;
  getStudentName: (studentId: string) => string;
  onSaved: () => Promise<void>;
}

/** Envío de citaciones a estudiantes de la clase y listado de las emitidas. */
export const CitationsTab: React.FC<CitationsTabProps> = ({
  assignment, students, teacherId, getStudentName, onSaved,
}) => {
  const { citations } = useApp();
  const [studentId, setStudentId] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');

  const misCitaciones = citations.filter(c => c.creado_por === teacherId);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !date || !reason) return;
    try {
      await api.createCitation({
        estudiante_id: studentId,
        materia_id: assignment.materia_id,
        fecha_citacion: new Date(date).toISOString(),
        motivo: reason,
        estado: 'pendiente',
        creado_por: teacherId,
      });
      setStudentId(''); setDate(''); setReason('');
      await onSaved();
      toast.success('Citación enviada');
    } catch {
      toast.error('Error al enviar citación');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card className="h-fit">
        <CardTitle className="mb-6">Crear Citación</CardTitle>
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Estudiante">
            <select required value={studentId} onChange={e => setStudentId(e.target.value)} className={INPUT}>
              <option value="">-- Seleccionar --</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>{s.nombre} {s.apellido}</option>
              ))}
            </select>
          </Field>

          <Field label="Fecha y Hora">
            <input
              type="datetime-local" required value={date}
              onChange={e => setDate(e.target.value)} className={INPUT}
            />
          </Field>

          <Field label="Motivo">
            <textarea
              required rows={3} value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Detalle del motivo..." className={INPUT}
            />
          </Field>

          <button type="submit" className={`w-full ${PRIMARY_BUTTON}`}>Enviar Citación</button>
        </form>
      </Card>

      <Card>
        <CardTitle className="mb-6">Citaciones Enviadas</CardTitle>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {misCitaciones.map(cit => (
            <div key={cit.id} className="p-4 bg-white border border-gray-200 rounded-xl space-y-2">
              <div className="flex justify-between items-start">
                <span className="font-semibold text-gray-900 text-sm">
                  {getStudentName(cit.estudiante_id)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    cit.estado === 'pendiente' ? 'bg-amber-100 text-amber-500' : 'bg-emerald-100 text-emerald-500'
                  }`}
                >
                  {cit.estado}
                </span>
              </div>
              <p className="text-xs text-gray-500">{cit.motivo}</p>
              <div className="text-[10px] text-gray-400 flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(cit.fecha_citacion).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

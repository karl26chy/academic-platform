import React, { useEffect, useState } from 'react';
import { Award, AlertTriangle, CheckSquare, ClipboardList, Lock, Mail, Star, MessageSquare } from 'lucide-react';
import { useApp } from '../../../context/useApp';
import { useMessaging } from '../../../hooks/useMessaging';
import { Card, EmptyMessage, Field, INPUT, Tabs, type TabItem } from '../../ui';
import { MessageComposer, MessageThread, MessageDetailModal } from '../../messaging';
import { useTeacherClass } from './useTeacherClass';
import { periodLabel } from '../../../lib/periods';
import { AttendanceTab } from './AttendanceTab';
import { EvaluationsTab } from './EvaluationsTab';
import { MarksTab } from './MarksTab';
import { CitationsTab } from './CitationsTab';
import { LogrosTab } from './LogrosTab';
import { ObservacionesTab } from './ObservacionesTab';

type TeacherTab = 'attendance' | 'evaluations' | 'marks' | 'achievements' | 'observations' | 'citations' | 'messages';

export const TeacherDashboard: React.FC = () => {
  const { refreshData, navigateToTab, setNavigateToTab } = useApp();
  const [selectedAssignId, setSelectedAssignId] = useState('');
  const [activeTab, setActiveTab] = useState<TeacherTab>('attendance');

  const {
    user, teacherAssignments, activeAssignment, activeGrade, activeSubject,
    gradeStudents, activeEvals, marks, notaMax,
    periods, selectedPeriodId, activePeriod, selectPeriod,
    getSubjectName, getGradeName, getStudentName,
  } = useTeacherClass(selectedAssignId);

  const messaging = useMessaging({
    // Los mensajes del docente se asocian a la materia de la clase activa.
    resolveMateriaId: () => activeAssignment?.materia_id ?? null,
  });

  useEffect(() => {
    if (navigateToTab && typeof navigateToTab === 'string') {
      setActiveTab(navigateToTab as TeacherTab);
      setNavigateToTab(null);
    }
  }, [navigateToTab, setNavigateToTab]);

  const tabs: TabItem<TeacherTab>[] = [
    { id: 'attendance', label: 'Asistencia', icon: <CheckSquare className="h-4 w-4" /> },
    { id: 'evaluations', label: 'Evaluaciones', icon: <ClipboardList className="h-4 w-4" /> },
    { id: 'marks', label: 'Notas', icon: <Award className="h-4 w-4" /> },
    { id: 'achievements', label: 'Logros', icon: <Star className="h-4 w-4" /> },
    { id: 'observations', label: 'Observaciones', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'citations', label: 'Citaciones', icon: <AlertTriangle className="h-4 w-4" /> },
    { id: 'messages', label: 'Mensajería', icon: <Mail className="h-4 w-4" />, badge: messaging.unreadIncoming },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Panel del Docente</h2>
        <p className="text-gray-500 text-sm">
          Gestiona tus clases, evaluaciones, asistencia, notas y comunicación.
        </p>
      </div>

      <Card className="p-5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-q10-600 mb-2">
          Selecciona tu Materia y Grado
        </label>
        {teacherAssignments.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500">No tienes materias asignadas.</EmptyMessage>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {teacherAssignments.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedAssignId(a.id)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedAssignId === a.id
                    ? 'bg-q10-50 border-q10-500 text-q10-500'
                    : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                <span className="font-bold block text-gray-900 text-base">{getSubjectName(a.materia_id)}</span>
                <span className="text-xs mt-1 block font-medium">Grado: {getGradeName(a.grado_id)}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {activeAssignment && user && (
        <div className="space-y-6 animate-fade-in">
          <Card className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-q10-600 mb-2">
                  Contexto Académico
                </label>
                <p className="text-sm text-gray-700">
                  <span className="font-bold">{getSubjectName(activeAssignment.materia_id)}</span>
                  {' — '}Grado {getGradeName(activeAssignment.grado_id)}
                </p>
              </div>

              <div className="w-full sm:w-64">
                {periods.length === 0 ? (
                  <EmptyMessage className="text-xs text-gray-500">
                    No hay periodos definidos para esta institución.
                  </EmptyMessage>
                ) : (
                  <>
                    <Field label="Periodo académico">
                      <select
                        value={selectedPeriodId}
                        onChange={e => selectPeriod(e.target.value)}
                        className={INPUT}
                      >
                        {periods.map(p => (
                          <option key={p.id} value={p.id}>
                            {periodLabel(p)}{p.activo ? '' : ' (cerrado)'}
                          </option>
                        ))}
                      </select>
                    </Field>
                    {activePeriod && !activePeriod.activo && (
                      <p className="mt-1 text-[11px] text-red-500 flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Periodo cerrado: no se pueden crear o modificar evaluaciones/notas.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          <Tabs items={tabs} active={activeTab} onChange={setActiveTab} scrollable />

          {activeTab === 'attendance' && (
            <AttendanceTab
              key={activeAssignment.id}
              assignment={activeAssignment}
              subject={activeSubject}
              grade={activeGrade}
              students={gradeStudents}
              teacherId={user.id}
              periods={periods}
              period={activePeriod}
              onSaved={refreshData}
            />
          )}

          {activeTab === 'evaluations' && (
            <EvaluationsTab
              assignment={activeAssignment}
              evaluations={activeEvals}
              teacherId={user.id}
              period={activePeriod}
              onSaved={refreshData}
            />
          )}

          {activeTab === 'marks' && (
            <MarksTab
              key={`${activeAssignment.id}-${selectedPeriodId}`}
              assignment={activeAssignment}
              subject={activeSubject}
              grade={activeGrade}
              students={gradeStudents}
              evaluations={activeEvals}
              marks={marks}
              teacherId={user.id}
              notaMax={notaMax}
              periodLabel={periodLabel(activePeriod)}
              onSaved={refreshData}
            />
          )}

          {activeTab === 'achievements' && (
            <LogrosTab assignment={activeAssignment} period={activePeriod} />
          )}

          {activeTab === 'observations' && (
            <ObservacionesTab students={gradeStudents} period={activePeriod} />
          )}

          {activeTab === 'citations' && (
            <CitationsTab
              assignment={activeAssignment}
              students={gradeStudents}
              teacherId={user.id}
              getStudentName={getStudentName}
              onSaved={refreshData}
            />
          )}

          {activeTab === 'messages' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <MessageComposer
                title="Enviar Mensaje"
                recipients={gradeStudents.map(s => ({ id: s.id, label: `${s.nombre} ${s.apellido}` }))}
                replyTo={messaging.replyTo}
                nameOf={getStudentName}
                recipientId={messaging.form.recipientId}
                onRecipientChange={messaging.form.setRecipientId}
                subject={messaging.form.subject}
                onSubjectChange={messaging.form.setSubject}
                body={messaging.form.body}
                onBodyChange={messaging.form.setBody}
                onSubmit={messaging.send}
                onCancelReply={messaging.cancelReply}
              />
              <MessageThread
                messages={messaging.thread}
                currentUserId={user.id}
                unreadCount={messaging.unreadIncoming}
                nameOf={getStudentName}
                onOpen={messaging.openMessage}
                onReply={messaging.startReply}
              />
            </div>
          )}
        </div>
      )}

      {messaging.selectedMessage && (
        <MessageDetailModal
          message={messaging.selectedMessage}
          currentUserId={user?.id}
          nameOf={getStudentName}
          onClose={() => messaging.setSelectedMessage(null)}
          onReply={messaging.startReply}
        />
      )}
    </div>
  );
};

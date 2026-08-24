import React, { useEffect, useState } from 'react';
import { Award, CheckSquare, AlertTriangle, History, Mail, ShieldAlert } from 'lucide-react';
import { useApp } from '../../../context/useApp';
import { useMessaging } from '../../../hooks/useMessaging';
import { Tabs, type TabItem } from '../../ui';
import { MessageComposer, MessageThread, MessageDetailModal } from '../../messaging';
import { useStudentDashboard } from './useStudentDashboard';
import { GradesTab } from './GradesTab';
import { AttendanceTab } from './AttendanceTab';
import { CitationsTab } from './CitationsTab';
import { AcademicHistoryView } from './AcademicHistoryView';

type StudentTab = 'grades' | 'attendance' | 'citations' | 'history' | 'messages';

export const StudentDashboard: React.FC = () => {
  const { navigateToTab, setNavigateToTab } = useApp();
  const {
    user, currentInstitution, myGrade, myGradeAssignments, myTeachers,
    getSubjectName, getTeacherName, myMarks, chartData,
    myAttendance, attendanceCounts, presenceRate, myCitations, pendingCitations,
    periods, periodLabelOf,
  } = useStudentDashboard();

  const [activeTab, setActiveTab] = useState<StudentTab>('grades');

  const messaging = useMessaging({
    // El mensaje queda asociado a la materia que ese docente imparte en mi grado.
    resolveMateriaId: (teacherId) =>
      myGradeAssignments.find(a => a.profesor_id === teacherId)?.materia_id ?? null,
    successMessage: 'Mensaje enviado con éxito',
  });

  useEffect(() => {
    if (navigateToTab === 'messages') {
      setActiveTab('messages');
      setNavigateToTab(null);
    }
  }, [navigateToTab, setNavigateToTab]);

  const tabs: TabItem<StudentTab>[] = [
    { id: 'grades', label: 'Calificaciones y Notas', icon: <Award className="h-4 w-4" /> },
    { id: 'history', label: 'Historial Académico', icon: <History className="h-4 w-4" /> },
    { id: 'attendance', label: 'Registro de Asistencia', icon: <CheckSquare className="h-4 w-4" /> },
    { id: 'citations', label: `Citaciones (${myCitations.length})`, icon: <AlertTriangle className="h-4 w-4" /> },
    { id: 'messages', label: 'Mensajería', icon: <Mail className="h-4 w-4" />, badge: messaging.unreadIncoming },
  ];

  const recipients = myTeachers.map(t => ({
    id: t.id,
    label: `${t.nombre} ${t.apellido} (${getSubjectName(
      myGradeAssignments.find(a => a.profesor_id === t.id)?.materia_id || ''
    )})`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900"></h2>
          <p className="text-gray-500 text-sm">
            {myGrade ? `Grado: ${myGrade.nombre} "${myGrade.tipo_grado}"` : 'No asignado a un grado aún.'}
          </p>
        </div>

        {pendingCitations.length > 0 && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 animate-pulse">
            <ShieldAlert className="h-6 w-6 text-red-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-bold text-gray-900 text-xs block">CITACIÓN PENDIENTE</span>
              <span className="text-gray-600 text-[11px] block">
                Tienes {pendingCitations.length} citación(es) oficial(es) por atender.
              </span>
            </div>
            <button
              onClick={() => setActiveTab('citations')}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-semibold transition-colors shrink-0"
            >
              Ver
            </button>
          </div>
        )}
      </div>

      <Tabs
        items={tabs}
        active={activeTab}
        onChange={setActiveTab}
        scrollable
        activeBorderClass="border-indigo-500"
      />

      {activeTab === 'grades' && (
        <GradesTab
          chartData={chartData}
          marks={myMarks}
          institution={currentInstitution}
          getSubjectName={getSubjectName}
          periodLabelOf={periodLabelOf}
        />
      )}

      {activeTab === 'history' && user && (
        <AcademicHistoryView studentId={user.id} student={user} hideExport />
      )}

      {activeTab === 'attendance' && (
        <AttendanceTab
          records={myAttendance}
          counts={attendanceCounts}
          presenceRate={presenceRate}
          periods={periods}
          getSubjectName={getSubjectName}
          getTeacherName={getTeacherName}
        />
      )}

      {activeTab === 'citations' && (
        <CitationsTab citations={myCitations} getTeacherName={getTeacherName} />
      )}

      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
          <MessageComposer
            title="Enviar Mensaje a Profesor"
            recipients={recipients}
            replyTo={messaging.replyTo}
            nameOf={getTeacherName}
            showQuotedBody
            recipientId={messaging.form.recipientId}
            onRecipientChange={messaging.form.setRecipientId}
            subject={messaging.form.subject}
            onSubjectChange={messaging.form.setSubject}
            body={messaging.form.body}
            onBodyChange={messaging.form.setBody}
            onSubmit={messaging.send}
            onCancelReply={messaging.cancelReply}
            subjectPlaceholder="Duda sobre el examen / proyecto..."
            bodyPlaceholder="Redacta tu consulta detallada aquí..."
            bodyLabel="Contenido del Mensaje"
            submitLabel="Enviar Mensaje"
          />
          <MessageThread
            messages={messaging.thread}
            currentUserId={user?.id}
            unreadCount={messaging.unreadIncoming}
            nameOf={getTeacherName}
            onOpen={messaging.openMessage}
            onReply={messaging.startReply}
          />
        </div>
      )}

      {messaging.selectedMessage && (
        <MessageDetailModal
          message={messaging.selectedMessage}
          currentUserId={user?.id}
          nameOf={getTeacherName}
          onClose={() => messaging.setSelectedMessage(null)}
          onReply={messaging.startReply}
        />
      )}
    </div>
  );
};

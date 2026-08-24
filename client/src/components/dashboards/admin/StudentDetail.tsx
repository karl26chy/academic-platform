import React, { useMemo, useState } from 'react';
import {
  AlertCircle, CheckCircle, Clock, CreditCard, Droplet, FileText,
  Heart, History, Phone, User as UserIcon, XCircle,
} from 'lucide-react';
import { TableWrapper, TableHead, TableBody, StatusBadge, EmptyMessage } from '../../ui';
import { SubjectPerformanceChart } from '../../charts/SubjectPerformanceChart';
import { averageBySubject, maxScoreFor, weightedAverage } from '../../../lib/grades';
import { countByStatus } from '../../../lib/attendance';
import { getAge, initials } from '../../../lib/people';
import { documentoCompleto } from '../../../lib/documentTypes';
import { AcademicHistoryView } from '../student/AcademicHistoryView';
import type { Attendance, Institution, Mark, Subject, User } from '../../../types';

interface StudentDetailProps {
  student: User;
  institution: Institution | null;
  subjects: Subject[];
  marks: Mark[];
  attendance: Attendance[];
  gradeLabel: string;
  average: number;
  attendanceRate: number;
  getSubjectName: (subjectId: string) => string;
  /** Abre la generación del boletín individual por período. */
  onGenerateReport: (student: User) => void;
}

/** Ficha completa del estudiante: datos, asistencia, gráfica y notas. */
export const StudentDetail: React.FC<StudentDetailProps> = ({
  student, institution, subjects, marks, attendance, gradeLabel,
  average, attendanceRate, getSubjectName, onGenerateReport,
}) => {
  const studentMarks = useMemo(
    () => marks.filter(m => m.estudiante_id === student.id),
    [marks, student.id]
  );

  const [showHistory, setShowHistory] = useState(false);

  const chartData = useMemo(
    () =>
      averageBySubject(studentMarks).map(({ materiaId, promedio }) => ({
        name: getSubjectName(materiaId),
        'Nota Promedio': promedio,
      })),
    [studentMarks, getSubjectName]
  );

  const counts = countByStatus(attendance.filter(a => a.estudiante_id === student.id));

  return (
    <div className="space-y-6">
      {/* Ficha personal */}
      <div className="bg-gradient-to-r from-q10-500 to-indigo-600 rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 bg-white/20 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0">
              {initials(student)}
            </div>
            <div className="min-w-0">
              <h3 className="text-xl font-bold break-words">{student.nombre} {student.apellido}</h3>
              <p className="text-white/80 text-sm">{gradeLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-start justify-end gap-2 sm:gap-4 shrink-0">
            <div className="text-right">
              <div className="text-white/70 text-xs">Promedio General</div>
              <div className="text-2xl font-bold">{average}</div>
            </div>
            <button
              onClick={() => onGenerateReport(student)}
              title="Generar boletín por período de este estudiante"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <FileText className="h-3.5 w-3.5" /> Generar boletín
            </button>
            <button
              onClick={() => setShowHistory(v => !v)}
              title="Ver historial académico"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <History className="h-3.5 w-3.5" /> Historial
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-4 border-t border-white/20">
          <InfoItem icon={<CreditCard className="h-4 w-4 text-white/70" />} label="Documento">
            {documentoCompleto(student.tipo_documento, student.identificacion)}
          </InfoItem>
          <InfoItem icon={<UserIcon className="h-4 w-4 text-white/70" />} label="Edad / Género">
            {getAge(student.fecha_nacimiento)} años · {student.genero || 'N/E'}
          </InfoItem>
          <InfoItem icon={<Heart className="h-4 w-4 text-white/70" />} label="EPS">
            {student.eps || 'N/R'}
          </InfoItem>
          <InfoItem icon={<Droplet className="h-4 w-4 text-white/70" />} label="Tipo Sangre">
            {student.tipo_sangre || 'N/R'}
          </InfoItem>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/20">
          <InfoItem icon={<Phone className="h-4 w-4 text-white/70" />} label="Contacto Emergencia">
            {student.contacto_emergencia
              ? `${student.contacto_emergencia.nombre} (${student.contacto_emergencia.relacion}) - ${student.contacto_emergencia.telefono}`
              : 'N/R'}
          </InfoItem>
          <InfoItem icon={<AlertCircle className="h-4 w-4 text-white/70" />} label="Discapacidad">
            {student.discapacidad || 'Ninguna'}
          </InfoItem>
        </div>
      </div>

      {/* Resumen de asistencia */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AttendanceBox
          icon={<CheckCircle className="h-5 w-5 text-emerald-600 mx-auto mb-1" />}
          value={`${attendanceRate}%`} label="Asistencia"
          className="bg-emerald-50 border-emerald-200" textClass="text-emerald-600"
        />
        <AttendanceBox
          icon={<XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />}
          value={counts.ausente} label="Ausencias"
          className="bg-red-50 border-red-200" textClass="text-red-600"
        />
        <AttendanceBox
          icon={<Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />}
          value={counts.justificada} label="Inasist. justificadas"
          className="bg-amber-50 border-amber-200" textClass="text-amber-600"
        />
      </div>

      {/* Gráfica de rendimiento */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-gray-900 mb-3">Gráfica de Rendimiento por Materia</h4>
        {chartData.length === 0 ? (
          <EmptyMessage className="text-sm text-gray-500 py-4 text-center">
            Sin notas registradas para este estudiante.
          </EmptyMessage>
        ) : (
          <SubjectPerformanceChart
            data={chartData}
            dataKey="Nota Promedio"
            maxScore={maxScoreFor(institution)}
            notaMinima={institution?.nota_minima_aprobacion}
            referenceLabel={`Mín (${institution?.nota_minima_aprobacion})`}
            height="h-64"
          />
        )}
      </div>

      {/* Detalle de notas */}
      <div>
        <h4 className="text-sm font-bold text-gray-900 mb-3">Detalle de Notas por Materia</h4>
        <TableWrapper>
          <TableHead>
            <th className="pb-2">Materia</th>
            <th className="pb-2 text-center">Evaluaciones</th>
            <th className="pb-2 text-center">Promedio</th>
            <th className="pb-2 text-center">Estado</th>
          </TableHead>
          <TableBody>
            {subjects.map(subj => {
              const subjMarks = studentMarks.filter(m => m.materia_id === subj.id);
              if (subjMarks.length === 0) return null;
              const avg = weightedAverage(subjMarks);
              const passing = institution ? avg >= institution.nota_minima_aprobacion : true;
              return (
                <tr key={subj.id} className="hover:bg-gray-50">
                  <td className="py-2.5 font-medium text-gray-900">{subj.nombre}</td>
                  <td className="py-2.5 text-center text-gray-500">{subjMarks.length}</td>
                  <td className="py-2.5 text-center font-semibold">{avg}</td>
                  <td className="py-2.5 text-center">
                    <StatusBadge passing={passing}>{passing ? 'Aprobado' : 'Reprobado'}</StatusBadge>
                  </td>
                </tr>
              );
            })}
          </TableBody>
        </TableWrapper>
      </div>

      {showHistory && (
        <AcademicHistoryView studentId={student.id} student={student} />
      )}
    </div>
  );
};

const InfoItem: React.FC<{ icon: React.ReactNode; label: string; children: React.ReactNode }> = ({
  icon, label, children,
}) => (
  <div className="flex items-center gap-2">
    {icon}
    <div>
      <div className="text-[10px] text-white/70">{label}</div>
      <div className="text-sm font-semibold">{children}</div>
    </div>
  </div>
);

const AttendanceBox: React.FC<{
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  className: string;
  textClass: string;
}> = ({ icon, value, label, className, textClass }) => (
  <div className={`p-4 border rounded-xl text-center ${className}`}>
    {icon}
    <div className={`text-lg font-bold ${textClass}`}>{value}</div>
    <div className={`text-[11px] font-medium ${textClass}`}>{label}</div>
  </div>
);

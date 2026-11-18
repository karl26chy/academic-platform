import React, { useState } from 'react';
import { BookOpen, CalendarDays, Eye, FileText, GraduationCap, LayoutDashboard, Layers, Link2, Users, UsersRound } from 'lucide-react';
import { Tabs, type TabItem } from '../../ui';
import { useApp } from '../../../context/useApp';
import { useAdminDashboard } from './useAdminDashboard';
import { OverviewTab } from './OverviewTab';
import { StudentsTab } from './StudentsTab';
import { PeriodsTab } from './PeriodsTab';
import { GradosTab } from './GradosTab';
import { MateriasTab } from './MateriasTab';
import { DocentesTab } from './DocentesTab';
import { AsignacionesTab } from './AsignacionesTab';
import { ProgramasTab } from './corporacion/ProgramasTab';
import { GruposTab } from './corporacion/GruposTab';
import { CertificadosTab } from './corporacion/CertificadosTab';
import { esCorporacion } from '../../../lib/corporacion';

type AdminTab =
  | 'overview' | 'grados' | 'materias' | 'docentes' | 'asignaciones' | 'students' | 'periods'
  | 'programas' | 'grupos' | 'certificados';

const TABS: TabItem<AdminTab>[] = [
  { id: 'overview', label: 'Resumen', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'students', label: 'Estudiantes', icon: <Eye className="h-4 w-4" /> },
  { id: 'grados', label: 'Grados', icon: <GraduationCap className="h-4 w-4" /> },
  { id: 'materias', label: 'Materias', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'docentes', label: 'Docentes', icon: <Users className="h-4 w-4" /> },
  { id: 'asignaciones', label: 'Asignaciones', icon: <Link2 className="h-4 w-4" /> },
  { id: 'periods', label: 'Periodos Académicos', icon: <CalendarDays className="h-4 w-4" /> },
];

/** Corporaciones: programas, grupos, módulos, semestres y certificados. */
const TABS_CORPORACION: TabItem<AdminTab>[] = [
  { id: 'overview', label: 'Resumen', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'students', label: 'Estudiantes', icon: <Eye className="h-4 w-4" /> },
  { id: 'programas', label: 'Programas', icon: <Layers className="h-4 w-4" /> },
  { id: 'grupos', label: 'Grupos', icon: <UsersRound className="h-4 w-4" /> },
  { id: 'materias', label: 'Módulos', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'docentes', label: 'Docentes', icon: <Users className="h-4 w-4" /> },
  { id: 'asignaciones', label: 'Asignaciones', icon: <Link2 className="h-4 w-4" /> },
  { id: 'periods', label: 'Semestres', icon: <CalendarDays className="h-4 w-4" /> },
  { id: 'certificados', label: 'Certificados', icon: <FileText className="h-4 w-4" /> },
];

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const { refreshData } = useApp();
  const {
    currentInstitution, instGrades, studentUsers, teacherUsers, subjects,
    marks, attendance, studentGrades, getSubjectName, lowPerfSubjects,
    overallSubjectData, getStudentGradeLabel,
    getStudentAverage, getStudentAttendanceRate,
  } = useAdminDashboard();
  const corporacion = esCorporacion(currentInstitution);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Administración Institucional</h2>
        <p className="text-gray-500 text-sm">
          Panel de control y monitoreo de estudiantes - {currentInstitution?.nombre}
        </p>
      </div>

      <Tabs items={corporacion ? TABS_CORPORACION : TABS} active={activeTab} onChange={setActiveTab} scrollable />

      {activeTab === 'overview' && (
        <OverviewTab
          institution={currentInstitution}
          totals={{
            students: studentUsers.length,
            teachers: teacherUsers.length,
            grades: instGrades.length,
          }}
          subjectData={overallSubjectData}
          lowPerfSubjects={lowPerfSubjects}
        />
      )}

      {activeTab === 'grados' && <GradosTab />}
      {corporacion && activeTab === 'programas' && <ProgramasTab />}
      {corporacion && activeTab === 'grupos' && <GruposTab />}
      {corporacion && activeTab === 'certificados' && <CertificadosTab />}
      {activeTab === 'materias' && <MateriasTab />}
      {activeTab === 'docentes' && <DocentesTab />}
      {activeTab === 'asignaciones' && <AsignacionesTab />}

      {activeTab === 'students' && (
        <StudentsTab
          students={studentUsers}
          grades={instGrades}
          studentGrades={studentGrades}
          subjects={subjects}
          marks={marks}
          attendance={attendance}
          institution={currentInstitution}
          getSubjectName={getSubjectName}
          getStudentGradeLabel={getStudentGradeLabel}
          getStudentAverage={getStudentAverage}
          getStudentAttendanceRate={getStudentAttendanceRate}
          onChanged={refreshData}
        />
      )}

      {activeTab === 'periods' && <PeriodsTab />}
    </div>
  );
};

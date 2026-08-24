import React, { useState } from 'react';
import { Building2, BookOpen, Link2, Users } from 'lucide-react';
import { StatCard, Tabs, type TabItem } from '../../ui';
import { useSuperAdmin } from './useSuperAdmin';
import { InstitutionsTab } from './InstitutionsTab';
import { UsersTab } from './UsersTab';
import { GradesSubjectsTab } from './GradesSubjectsTab';
import { AssignmentsTab } from './AssignmentsTab';

type SuperAdminTab = 'institutions' | 'users' | 'grades_subjects' | 'assignments';

const TABS: TabItem<SuperAdminTab>[] = [
  { id: 'institutions', label: 'Instituciones', icon: <Building2 className="h-4 w-4" /> },
  { id: 'users', label: 'Usuarios', icon: <Users className="h-4 w-4" /> },
  { id: 'grades_subjects', label: 'Grados y Materias', icon: <BookOpen className="h-4 w-4" /> },
  { id: 'assignments', label: 'Asignaciones', icon: <Link2 className="h-4 w-4" /> },
];

export const SuperAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('institutions');
  const {
    institutions, users, grades, subjects, assignments, studentGrades, refreshData,
    showMsg, getGradeLabel, getSubjectLabel, getUserLabel, getInstName,
  } = useSuperAdmin();

  const activeCount = institutions.filter(i => i.activa).length;
  const adminCount = users.filter(u => u.rol === 'admin').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Consola de Super Administrador</h2>
          <p className="text-gray-500 text-sm">
            Gestión global de instituciones, usuarios, grados, materias y asignaciones
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Instituciones" value={institutions.length} />
        <StatCard label="Activas" value={activeCount} valueClassName="text-emerald-600" />
        <StatCard label="Administradores" value={adminCount} valueClassName="text-amber-600" />
        <StatCard label="Usuarios Totales" value={users.length} valueClassName="text-blue-600" />
      </div>

      <Tabs items={TABS} active={activeTab} onChange={setActiveTab} scrollable />

      {activeTab === 'institutions' && (
        <InstitutionsTab institutions={institutions} showMsg={showMsg} onChanged={refreshData} />
      )}

      {activeTab === 'users' && (
        <UsersTab
          institutions={institutions}
          users={users}
          showMsg={showMsg}
          getInstName={getInstName}
          onChanged={refreshData}
        />
      )}

      {activeTab === 'grades_subjects' && (
        <GradesSubjectsTab
          institutions={institutions}
          grades={grades}
          subjects={subjects}
          studentGrades={studentGrades}
          showMsg={showMsg}
          onChanged={refreshData}
        />
      )}

      {activeTab === 'assignments' && (
        <AssignmentsTab
          institutions={institutions}
          users={users}
          grades={grades}
          subjects={subjects}
          assignments={assignments}
          studentGrades={studentGrades}
          getUserLabel={getUserLabel}
          getSubjectLabel={getSubjectLabel}
          getGradeLabel={getGradeLabel}
          showMsg={showMsg}
          onChanged={refreshData}
        />
      )}
    </div>
  );
};

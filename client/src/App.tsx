import React from 'react';
import { RefreshCw, ShieldAlert } from 'lucide-react';
import { AppProvider } from './context/AppProvider';
import { useApp } from './context/useApp';
import { Login } from './components/auth/Login';
import { Layout } from './components/layout/Layout';
import { SuperAdminDashboard } from './components/dashboards/super-admin/SuperAdminDashboard';
import { AdminDashboard } from './components/dashboards/admin/AdminDashboard';
import { TeacherDashboard } from './components/dashboards/teacher/TeacherDashboard';
import { StudentDashboard } from './components/dashboards/student/StudentDashboard';

/** Cada rol tiene su propio panel. */
const DASHBOARDS: Record<string, React.FC> = {
  super_admin: SuperAdminDashboard,
  admin: AdminDashboard,
  teacher: TeacherDashboard,
  student: StudentDashboard,
};

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-900">
    <div className="flex flex-col items-center gap-3">
      <RefreshCw className="h-10 w-10 text-q10-500 animate-spin" />
      <span className="text-sm font-medium text-gray-500">Cargando datos...</span>
    </div>
  </div>
);

/**
 * Las instrucciones de infraestructura solo se muestran cuando el servidor no
 * respondió. Si el API sí contestó, el mensaje real es el que importa: enseñar
 * "levanta Docker" ante un error de negocio manda a depurar al sitio erróneo.
 */
const ConnectionError: React.FC<{
  message: string;
  esFalloDeRed: boolean;
  onRetry: () => void;
}> = ({ message, esFalloDeRed, onRetry }) => (
  <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
    <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-6 shadow-sm text-center space-y-4">
      <div className="flex justify-center">
        <div className="p-3 bg-red-50 border border-red-200 rounded-full text-red-600">
          <ShieldAlert className="h-8 w-8" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900">
        {esFalloDeRed ? 'Error de Conexión' : 'No se pudieron cargar los datos'}
      </h2>
      <p className="text-sm text-gray-500">{message}</p>
      {esFalloDeRed && (
        <div className="text-xs text-gray-500 bg-gray-100 p-3 rounded-lg border border-gray-200 text-left font-mono">
          ¿Cómo solucionarlo?<br />
          1. Verifica que el backend esté corriendo.<br />
          2. Local: ejecuta 'npm run dev' en la carpeta 'api' (con PostgreSQL activo).<br />
          3. Producción: 'docker compose up -d' en la raíz del proyecto.<br />
          4. Recarga esta página.
        </div>
      )}
      <button
        onClick={onRetry}
        className="w-full py-2.5 bg-q10-600 hover:bg-q10-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
      >
        <RefreshCw className="h-4 w-4" /> Reintentar Conexión
      </button>
    </div>
  </div>
);

const UnknownRole: React.FC<{ rol: string }> = ({ rol }) => (
  <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm text-center">
    <h3 className="text-lg font-bold text-gray-900 mb-2">Rol Desconocido</h3>
    <p className="text-gray-500 text-sm">El rol "{rol}" no está configurado.</p>
  </div>
);

const MainAppContent: React.FC = () => {
  const { user, loading, dataError, refreshData } = useApp();

  if (loading) return <LoadingScreen />;

  // Si el servidor no responde no hay nada que hacer, ni siquiera autenticarse.
  if (dataError?.esFalloDeRed) {
    return <ConnectionError message={dataError.message} esFalloDeRed onRetry={refreshData} />;
  }

  // Sin sesión, el formulario siempre es alcanzable: él pinta su propio error.
  // Anteponerle el fallo de datos dejaba al usuario encerrado en una pantalla
  // cuyo único botón volvía a pedir recursos protegidos sin token.
  if (!user) return <Login />;

  if (dataError) {
    return <ConnectionError message={dataError.message} esFalloDeRed={false} onRetry={refreshData} />;
  }

  const Dashboard = DASHBOARDS[user.rol];

  // key={user.id} asegura que al cambiar de cuenta se desmonte completamente
  // el dashboard anterior y sus estados internos, sin requerir recarga de página.
  return <Layout key={user.id}>{Dashboard ? <Dashboard key={user.id} /> : <UnknownRole rol={user.rol} />}</Layout>;
};

function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}

export default App;

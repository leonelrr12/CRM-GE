import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MainLayout from './components/Layout/MainLayout';
import LoginPage from './pages/Login';
import DashboardPage from './pages/Dashboard';
import LeadsPage from './pages/Leads';
import LeadDetailPage from './pages/LeadDetail';
import PipelinePage from './pages/Pipeline';
import PublicFormPage from './pages/PublicForm';
import AdminUsersPage from './pages/AdminUsers';
import AdminCompaniesPage from './pages/AdminCompanies';
import type { UserRole } from './types';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" />
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Guard de rol por ruta (el backend igual protege; evita páginas rotas por 403)
function AdminRoute({ roles, children }: { roles: UserRole[]; children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/captacion" element={<Navigate to="/captacion/green-energy-technologie" replace />} />
      <Route path="/captacion/:slug" element={<PublicFormPage />} />
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/leads" element={<LeadsPage />} />
        <Route path="/leads/:id" element={<LeadDetailPage />} />
        <Route path="/pipeline" element={<PipelinePage />} />
        <Route path="/admin/users" element={<AdminRoute roles={['admin', 'company_admin']}><AdminUsersPage /></AdminRoute>} />
        <Route path="/admin/companies" element={<AdminRoute roles={['admin']}><AdminCompaniesPage /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import NotAuthorizedPage from './pages/NotAuthorizedPage';
import DashboardPage from './pages/DashboardPage';
import TicketsPage from './pages/TicketsPage';
import TicketDetailPage from './pages/TicketDetailPage';
import CreateTicketPage from './pages/CreateTicketPage';
import TeamsPage from './pages/TeamsPage';
import UsersPage from './pages/UsersPage';
import TagsPage from './pages/TagsPage';
import CategoriesPage from './pages/CategoriesPage';
import MetricsPage from './pages/MetricsPage';
import SlaAdminPage from './pages/SlaAdminPage';
import AutomationAdminPage from './pages/AutomationAdminPage';
import KbAdminPage from './pages/KbAdminPage';
import SamlAdminPage from './pages/SamlAdminPage';
import NotificationsPage from './pages/NotificationsPage';
import MyJournalPage from './pages/MyJournalPage';
import EmployeesPage from './pages/EmployeesPage';
import EquipmentsPage from './pages/EquipmentsPage';
import Layout from './components/Layout';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
};

const RequireAdmin: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }
  if (!user || user.role !== 'ADMIN') {
    return <Navigate to="/not-authorized" />;
  }
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/not-authorized" element={<NotAuthorizedPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="tickets" element={<TicketsPage />} />
        <Route path="tickets/new" element={<CreateTicketPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="metrics" element={<MetricsPage />} />
        <Route path="teams" element={<TeamsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="tags" element={<TagsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="sla" element={<SlaAdminPage />} />
        <Route path="automations" element={<AutomationAdminPage />} />
        <Route path="kb" element={<KbAdminPage />} />
        <Route
          path="admin/sso"
          element={
            <RequireAdmin>
              <SamlAdminPage />
            </RequireAdmin>
          }
        />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="my/journal" element={<MyJournalPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="equipments" element={<EquipmentsPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Router>
          <AppRoutes />
        </Router>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;

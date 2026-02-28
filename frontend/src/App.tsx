import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
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
import FinancePage from './pages/FinancePage';
import HrPage from './pages/HrPage';
import ProcurementPage from './pages/ProcurementPage';
import IntegrationsAdminPage from './pages/IntegrationsAdminPage';
import { PlatformModule } from './config/modules';
import { ModuleKey, SubmoduleKey } from './config/entitlements';

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

const RequireModule: React.FC<{ module: PlatformModule; children: React.ReactNode }> = ({ module, children }) => {
  const { user, loading, hasModule } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user || !hasModule(module)) {
    return <Navigate to="/not-authorized" />;
  }

  return <>{children}</>;
};

const RequireEntitlement: React.FC<{
  moduleKey: ModuleKey;
  submoduleKey: SubmoduleKey;
  fallbackModule?: PlatformModule;
  children: React.ReactNode;
}> = ({ moduleKey, submoduleKey, fallbackModule, children }) => {
  const { user, loading, hasEntitlement, hasModule } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Carregando...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/not-authorized" />;
  }

  if (user.role === 'ADMIN') {
    return <>{children}</>;
  }

  const entitlementAllowed = hasEntitlement(moduleKey, submoduleKey, 'READ');
  const moduleAllowed = fallbackModule ? hasModule(fallbackModule) : false;
  if (!entitlementAllowed && !moduleAllowed) {
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
            <Outlet />
          </PrivateRoute>
        }
      >
        <Route index element={<RequireModule module="DASHBOARD"><DashboardPage /></RequireModule>} />
        <Route path="tickets" element={<RequireModule module="TICKETS"><TicketsPage /></RequireModule>} />
        <Route path="tickets/new" element={<RequireModule module="TICKETS"><CreateTicketPage /></RequireModule>} />
        <Route path="tickets/:id" element={<RequireModule module="TICKETS"><TicketDetailPage /></RequireModule>} />
        <Route path="metrics" element={<RequireModule module="METRICS"><MetricsPage /></RequireModule>} />
        <Route path="teams" element={<RequireModule module="TEAMS"><TeamsPage /></RequireModule>} />
        <Route
          path="users"
          element={
            <RequireEntitlement moduleKey="ADMIN" submoduleKey="ADMIN_USERS" fallbackModule="USERS">
              <UsersPage />
            </RequireEntitlement>
          }
        />
        <Route path="tags" element={<RequireModule module="TAGS"><TagsPage /></RequireModule>} />
        <Route path="categories" element={<RequireModule module="CATEGORIES"><CategoriesPage /></RequireModule>} />
        <Route path="sla" element={<RequireModule module="SLA"><SlaAdminPage /></RequireModule>} />
        <Route path="automations" element={<RequireModule module="AUTOMATIONS"><AutomationAdminPage /></RequireModule>} />
        <Route path="kb" element={<RequireModule module="KB"><KbAdminPage /></RequireModule>} />
        <Route
          path="admin/sso"
          element={
            <RequireEntitlement moduleKey="ADMIN" submoduleKey="ADMIN_SSO" fallbackModule="ADMIN">
              <RequireAdmin>
                <SamlAdminPage />
              </RequireAdmin>
            </RequireEntitlement>
          }
        />
        <Route path="notifications" element={<RequireModule module="NOTIFICATIONS"><NotificationsPage /></RequireModule>} />
        <Route path="my/journal" element={<RequireModule module="JOURNAL"><MyJournalPage /></RequireModule>} />
        <Route
          path="employees"
          element={
            <RequireEntitlement moduleKey="HR" submoduleKey="HR_EMPLOYEES" fallbackModule="EMPLOYEES">
              <EmployeesPage />
            </RequireEntitlement>
          }
        />
        <Route
          path="equipments"
          element={
            <RequireEntitlement moduleKey="ASSETS" submoduleKey="ASSETS_EQUIPMENT" fallbackModule="EQUIPMENTS">
              <EquipmentsPage />
            </RequireEntitlement>
          }
        />
        <Route
          path="finance"
          element={
            <RequireEntitlement moduleKey="FINANCE" submoduleKey="FINANCE_REPORTS" fallbackModule="FINANCE">
              <FinancePage />
            </RequireEntitlement>
          }
        />
        <Route
          path="hr"
          element={
            <RequireEntitlement moduleKey="HR" submoduleKey="HR_REPORTS" fallbackModule="HR">
              <HrPage />
            </RequireEntitlement>
          }
        />
        <Route
          path="procurement"
          element={
            <RequireEntitlement
              moduleKey="FINANCE"
              submoduleKey="FINANCE_PURCHASE_REQUESTS"
              fallbackModule="PROCUREMENT"
            >
              <ProcurementPage />
            </RequireEntitlement>
          }
        />
        <Route
          path="integrations"
          element={
            <RequireEntitlement moduleKey="ADMIN" submoduleKey="ADMIN_SETTINGS" fallbackModule="ADMIN">
              <RequireAdmin>
                <IntegrationsAdminPage />
              </RequireAdmin>
            </RequireEntitlement>
          }
        />
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

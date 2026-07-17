import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { JobsProvider } from "./context/JobsContext";
import { ToastProvider } from "./components/ui/Toast";
import { GlobalJobsWidget } from "./components/domain/GlobalJobsWidget";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UsersPage } from "./pages/UsersPage";
import { WorkOrdersPage } from "./pages/WorkOrdersPage";
import { InspectionsPage } from "./pages/InspectionsPage";
import { InspectionDetailPage } from "./pages/InspectionDetailPage";
import { EquiposPage } from "./pages/EquiposPage";
import { SyncPage } from "./pages/SyncPage";
import { DatabasePage } from "./pages/DatabasePage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
        <JobsProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<DashboardPage />} />
              <Route
                path="/usuarios"
                element={
                  <ProtectedRoute roles={["ADMINISTRADOR"]}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/equipos"
                element={
                  <ProtectedRoute roles={["ADMINISTRADOR"]}>
                    <EquiposPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ots"
                element={
                  <ProtectedRoute roles={["ADMINISTRADOR", "SUPERVISOR", "INSPECTOR"]}>
                    <WorkOrdersPage />
                  </ProtectedRoute>
                }
              />
              <Route path="/inspecciones" element={<InspectionsPage />} />
              <Route path="/inspecciones/:id" element={<InspectionDetailPage />} />
              <Route
                path="/sync"
                element={
                  <ProtectedRoute roles={["ADMINISTRADOR"]}>
                    <SyncPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/base-de-datos"
                element={
                  <ProtectedRoute roles={["ADMINISTRADOR"]}>
                    <DatabasePage />
                  </ProtectedRoute>
                }
              />
              <Route path="/perfil" element={<ProfilePage />} />
            </Route>
          </Routes>
          <GlobalJobsWidget />
        </JobsProvider>
        </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

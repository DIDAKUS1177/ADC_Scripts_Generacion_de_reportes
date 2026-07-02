import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/ui/Toast";
import { AppShell } from "./components/layout/AppShell";
import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { UsersPage } from "./pages/UsersPage";
import { WorkOrdersPage } from "./pages/WorkOrdersPage";
import { InspectionsPage } from "./pages/InspectionsPage";
import { InspectionDetailPage } from "./pages/InspectionDetailPage";
import { SyncPage } from "./pages/SyncPage";
import { ProfilePage } from "./pages/ProfilePage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
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
              <Route path="/perfil" element={<ProfilePage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FileSearch,
  RefreshCw,
  UserCircle,
  Award,
} from "lucide-react";
import type { Role } from "../../types";
import type { ComponentType } from "react";

export interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
}

export const NAV_BY_ROLE: Record<Role, NavItem[]> = {
  ADMINISTRADOR: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/usuarios", label: "Usuarios", icon: Users },
    { to: "/equipos", label: "Equipos", icon: Award },
    { to: "/ots", label: "Órdenes de Trabajo", icon: ClipboardList },
    { to: "/inspecciones", label: "Inspecciones", icon: FileSearch },
    { to: "/sync", label: "Sincronización", icon: RefreshCw },
    { to: "/perfil", label: "Mi Perfil", icon: UserCircle },
  ],
  SUPERVISOR: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/ots", label: "Órdenes de Trabajo", icon: ClipboardList },
    { to: "/inspecciones", label: "Inspecciones", icon: FileSearch },
    { to: "/perfil", label: "Mi Perfil", icon: UserCircle },
  ],
  INSPECTOR: [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/ots", label: "Mis OTs", icon: ClipboardList },
    { to: "/inspecciones", label: "Mis Reportes", icon: FileSearch },
    { to: "/perfil", label: "Mi Perfil", icon: UserCircle },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  ADMINISTRADOR: "Administrador",
  SUPERVISOR: "Supervisor",
  INSPECTOR: "Inspector",
};

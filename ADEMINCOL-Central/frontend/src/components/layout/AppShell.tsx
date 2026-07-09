import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { NAV_BY_ROLE, ROLE_LABEL, type NavItem } from "./navConfig";
import { FloatingInspectorChartWidget } from "./FloatingInspectorChartWidget";

// Menú SUPERIOR (2026-07-09) — antes era una barra lateral fija a la
// izquierda; se cambió a top-nav por pedido explícito ("me parece muy
// cliché"). Con hasta 8 ítems para ADMINISTRADOR, el menú va en su propia
// fila debajo del branding, y se scrollea horizontal si no cabe (no se
// oculta ni se corta) — mismo criterio en mobile, colapsa a un dropdown.
export function AppShell() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;
  const items = NAV_BY_ROLE[user.rol];

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="sticky top-0 z-30 border-b-4 border-brand-600 bg-white shadow-sm">
        {/* Fila 1: branding + usuario */}
        <div className="flex items-center justify-between px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-lg p-2 hover:bg-ink-100 md:hidden"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="text-lg font-extrabold italic tracking-tight text-ink-900">
              ADEMINCOL <span className="text-brand-600">Central</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-ink-800">{user.nombre}</p>
              <p className="text-xs text-ink-400">{ROLE_LABEL[user.rol]}</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {user.nombre.charAt(0)}
            </div>
            <button
              onClick={logout}
              title="Cerrar sesión"
              className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-brand-600"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Fila 2: navegación horizontal (desktop/tablet) */}
        <nav className="hidden overflow-x-auto border-t border-ink-100 px-4 md:flex lg:px-8">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "border-brand-600 text-brand-700"
                    : "border-transparent text-ink-600 hover:border-ink-200 hover:text-ink-900"
                }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Menú mobile: dropdown debajo del header */}
        {mobileOpen && (
          <nav className="flex flex-col gap-0.5 border-t border-ink-100 p-2 md:hidden">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-700"
                      : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1600px] flex-1 overflow-x-hidden p-4 lg:p-8">
        <Outlet />
      </main>

      <FloatingInspectorChartWidget />
    </div>
  );
}

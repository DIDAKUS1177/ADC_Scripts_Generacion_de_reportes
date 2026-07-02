import { useEffect, useMemo, useState } from "react";
import { Search, UserPlus, PenSquare, Ban, CheckCircle2, Signature } from "lucide-react";
import { fetchUsers, toggleUserActive } from "../mock/client";
import type { Role, User } from "../types";
import { Spinner, ErrorState, EmptyState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import { ROLE_LABEL } from "../components/layout/navConfig";
import { useToast } from "../components/ui/Toast";

const ROLE_TONE: Record<Role, "red" | "blue" | "green"> = {
  ADMINISTRADOR: "red",
  SUPERVISOR: "blue",
  INSPECTOR: "green",
};

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "TODOS">("TODOS");

  function load() {
    setError(null);
    setUsers(null);
    fetchUsers()
      .then(setUsers)
      .catch(() => setError("No se pudo cargar la lista de usuarios."));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchesRole = roleFilter === "TODOS" || u.rol === roleFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery = !q || u.nombre.toLowerCase().includes(q) || u.usuario.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [users, query, roleFilter]);

  async function handleToggle(u: User) {
    try {
      await toggleUserActive(u.id);
      toast.success(`${u.nombre} ${u.activo ? "desactivado" : "activado"}.`);
      load();
    } catch {
      toast.error("No se pudo actualizar el usuario.");
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Usuarios</h1>
          <p className="text-sm text-ink-500">Administradores, supervisores e inspectores</p>
        </div>
        <button
          onClick={() => toast.success("Formulario de nuevo usuario (mockup).")}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <UserPlus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o usuario..."
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as Role | "TODOS")}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
        >
          <option value="TODOS">Todos los roles</option>
          <option value="ADMINISTRADOR">Administrador</option>
          <option value="SUPERVISOR">Supervisor</option>
          <option value="INSPECTOR">Inspector</option>
        </select>
      </div>

      {users === null && !error && <Spinner label="Cargando usuarios..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {users !== null && filtered.length === 0 && (
        <EmptyState title="Sin resultados" description="Ajusta los filtros de búsqueda." />
      )}

      {users !== null && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3">Cargo</th>
                <th className="px-4 py-3">Certificado</th>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-ink-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-800">{u.nombre}</p>
                    <p className="text-xs text-ink-400">{u.usuario} · {u.correo}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={ROLE_TONE[u.rol]}>{ROLE_LABEL[u.rol]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink-600">{u.cargo ?? "-"}</td>
                  <td className="px-4 py-3 text-ink-600">{u.certificado ?? "-"}</td>
                  <td className="px-4 py-3">
                    {u.tieneFirma ? (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <Signature size={14} /> Cargada
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Signature size={14} /> Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.activo ? "green" : "gray"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toast.success("Editar usuario (mockup).")}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                      >
                        <PenSquare size={15} />
                      </button>
                      <button
                        onClick={() => handleToggle(u)}
                        className={`rounded-lg p-1.5 hover:bg-ink-100 ${
                          u.activo ? "text-brand-600" : "text-emerald-600"
                        }`}
                        title={u.activo ? "Desactivar" : "Activar"}
                      >
                        {u.activo ? <Ban size={15} /> : <CheckCircle2 size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

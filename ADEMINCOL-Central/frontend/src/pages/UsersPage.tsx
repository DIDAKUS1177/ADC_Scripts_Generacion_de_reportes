import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Search, UserPlus, Ban, CheckCircle2, Signature, X, Loader2 } from "lucide-react";
import {
  createRealUser,
  fetchRealUsers,
  toggleRealUserActive,
  PreviewApiError,
  type NewUserPayload,
  type RealUser,
} from "../api/previewClient";
import type { Role } from "../types";
import { Spinner, ErrorState, EmptyState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import { ROLE_LABEL } from "../components/layout/navConfig";
import { useToast } from "../components/ui/Toast";

const ROLE_TONE: Record<Role, "red" | "blue" | "green"> = {
  ADMINISTRADOR: "red",
  SUPERVISOR: "blue",
  INSPECTOR: "green",
};

// Página conectada a la BD REAL en Google Sheets (hoja "usuarios", decisión D11).
// La contraseña se hashea con bcrypt en el backend antes de escribirse.
export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<RealUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "TODOS">("TODOS");
  const [showModal, setShowModal] = useState(false);

  function load() {
    setError(null);
    setUsers(null);
    fetchRealUsers()
      .then(setUsers)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "No se pudo cargar la lista de usuarios.")
      );
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    return users.filter((u) => {
      const matchesRole = roleFilter === "TODOS" || u.rol === roleFilter;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || u.nombre.toLowerCase().includes(q) || u.usuario.toLowerCase().includes(q);
      return matchesRole && matchesQuery;
    });
  }, [users, query, roleFilter]);

  async function handleToggle(u: RealUser) {
    try {
      await toggleRealUserActive(u.usuario, !u.activo);
      toast.success(`${u.nombre} ${u.activo ? "desactivado" : "activado"}.`);
      load();
    } catch (e) {
      toast.error(e instanceof PreviewApiError ? e.message : "No se pudo actualizar el usuario.");
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Usuarios</h1>
          <p className="text-sm text-ink-500">
            Base de datos real en Google Sheets — hoja "usuarios"
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
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

      {users === null && !error && <Spinner label="Consultando la BD de usuarios..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {users !== null && filtered.length === 0 && (
        <EmptyState
          title={users.length === 0 ? "Aún no hay usuarios" : "Sin resultados"}
          description={
            users.length === 0
              ? "Crea el primer usuario con el botón 'Nuevo usuario'."
              : "Ajusta los filtros de búsqueda."
          }
        />
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
                <tr key={u.idUsuario} className="hover:bg-ink-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-800">{u.nombre}</p>
                    <p className="text-xs text-ink-400">
                      {u.usuario} {u.correo && `· ${u.correo}`}
                    </p>
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
                    <Badge tone={u.activo ? "green" : "gray"}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
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

      {showModal && (
        <NewUserModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NewUserModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewUserPayload>({
    nombre: "",
    usuario: "",
    password: "",
    rol: "INSPECTOR",
    correo: "",
    cargo: "",
    certificado: "",
  });

  function set<K extends keyof NewUserPayload>(key: K, value: NewUserPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await createRealUser(form);
      toast.success(`Usuario ${form.usuario} creado en la BD.`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof PreviewApiError ? err.message : "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Nuevo usuario</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <Field label="Nombre completo *">
          <input
            required
            value={form.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>
        <Field label="Usuario (login) *">
          <input
            required
            value={form.usuario}
            onChange={(e) => set("usuario", e.target.value.toLowerCase().trim())}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>
        <Field label="Contraseña * (mín. 8 caracteres)">
          <input
            required
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>
        <Field label="Rol *">
          <select
            value={form.rol}
            onChange={(e) => set("rol", e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          >
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="INSPECTOR">Inspector</option>
          </select>
        </Field>
        <Field label="Correo">
          <input
            type="email"
            value={form.correo}
            onChange={(e) => set("correo", e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>
        <Field label="Cargo">
          <input
            value={form.cargo}
            onChange={(e) => set("cargo", e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>
        <Field label="Certificado">
          <input
            value={form.certificado}
            onChange={(e) => set("certificado", e.target.value)}
            placeholder="Ej: MT Level II - SNT-TC-1A"
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>

        <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
          La firma se carga después desde AppSheet (columna tipo Signature) o desde el
          perfil del usuario cuando esté disponible.
        </p>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "Guardando en la BD..." : "Crear usuario"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}

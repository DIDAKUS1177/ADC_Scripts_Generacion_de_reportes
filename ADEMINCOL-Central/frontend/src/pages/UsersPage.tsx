import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Search, UserPlus, Ban, CheckCircle2, Signature, X, Loader2, Pencil, KeyRound, Upload } from "lucide-react";
import {
  createRealUser,
  fetchRealUsers,
  toggleRealUserActive,
  updateRealUser,
  updateRealUserFirma,
  PreviewApiError,
  type NewUserPayload,
  type RealUser,
  type UpdateUserPayload,
} from "../api/previewClient";
import type { Role } from "../types";
import { Spinner, ErrorState, EmptyState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import { ROLE_LABEL } from "../components/layout/navConfig";
import { useToast } from "../components/ui/Toast";
import { SignaturePad } from "../components/ui/SignaturePad";

const ROLE_TONE: Record<Role, "red" | "blue" | "green"> = {
  ADMINISTRADOR: "red",
  SUPERVISOR: "blue",
  INSPECTOR: "green",
};

// Página conectada a la BD REAL en Google Sheets (hoja "usuarios", decisión D11).
// La contraseña se hashea con bcrypt en el backend antes de escribirse.
// Solo visible para rol ADMINISTRADOR (protegido en App.tsx y navConfig.ts).
export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<RealUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "TODOS">("TODOS");
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<RealUser | null>(null);
  const [firmaUser, setFirmaUser] = useState<RealUser | null>(null);

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
            Cuentas con acceso a la plataforma
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
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-700"
                        title="Editar usuario"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setFirmaUser(u)}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-brand-700"
                        title="Cargar firma"
                      >
                        <Upload size={15} />
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

      {showModal && (
        <NewUserModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            load();
          }}
        />
      )}

      {firmaUser && (
        <FirmaModal
          user={firmaUser}
          onClose={() => setFirmaUser(null)}
          onSaved={() => {
            setFirmaUser(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ---- Modal: Editar usuario ----
function EditUserModal({
  user,
  onClose,
  onSaved,
}: {
  user: RealUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: user.nombre || "",
    correo: user.correo || "",
    rol: user.rol || "INSPECTOR",
    cargo: user.cargo || "",
    certificado: user.certificado || "",
    newPassword: "",
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.newPassword && form.newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const payload: UpdateUserPayload = {};
      if (form.nombre !== user.nombre) payload.nombre = form.nombre;
      if (form.correo !== (user.correo || "")) payload.correo = form.correo;
      if (form.rol !== user.rol) payload.rol = form.rol;
      if (form.cargo !== (user.cargo || "")) payload.cargo = form.cargo;
      if (form.certificado !== (user.certificado || "")) payload.certificado = form.certificado;
      if (form.newPassword) payload.newPassword = form.newPassword;

      if (Object.keys(payload).length === 0) {
        toast.error("No hay cambios que guardar.");
        setSaving(false);
        return;
      }

      await updateRealUser(user.usuario, payload);
      toast.success(`Usuario ${user.usuario} actualizado.`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof PreviewApiError ? err.message : "No se pudo actualizar.");
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
          <h2 className="text-lg font-bold text-ink-900">Editar usuario</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
          Usuario: <span className="font-semibold text-ink-700">{user.usuario}</span> (el login no se puede cambiar)
        </p>

        <Field label="Nombre completo">
          <input
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>
        <Field label="Correo">
          <input
            type="email"
            value={form.correo}
            onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>
        <Field label="Rol">
          <select
            value={form.rol}
            onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value as any }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          >
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="SUPERVISOR">Supervisor</option>
            <option value="INSPECTOR">Inspector</option>
          </select>
        </Field>
        <Field label="Cargo">
          <input
            value={form.cargo}
            onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>
        <Field label="Certificado">
          <input
            value={form.certificado}
            onChange={(e) => setForm((f) => ({ ...f, certificado: e.target.value }))}
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
        </Field>

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-800">
            <KeyRound size={14} /> Cambiar contraseña (opcional)
          </div>
          <input
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
            placeholder="Dejar vacío para no cambiar"
            className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600"
          />
          <p className="mt-1 text-xs text-amber-600">Mínimo 8 caracteres. Las contraseñas están hasheadas (bcrypt).</p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}

// ---- Modal: Cargar firma ----
function FirmaModal({
  user,
  onClose,
  onSaved,
}: {
  user: RealUser;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  async function handleSaveFirma(base64: string) {
    if (saving) return;
    setSaving(true);
    try {
      await updateRealUserFirma(user.usuario, base64);
      toast.success(`Firma de ${user.nombre} actualizada correctamente.`);
      onSaved();
    } catch (err) {
      toast.error(err instanceof PreviewApiError ? err.message : "No se pudo actualizar la firma.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">
            Firma de {user.nombre}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100 disabled:opacity-50" disabled={saving}>
            <X size={18} />
          </button>
        </div>
        
        <p className="mb-4 text-sm text-ink-600">
          Dibuja la firma en el recuadro abajo o sube una imagen con fondo blanco/transparente.
        </p>

        <div className="mb-2 rounded-lg border border-ink-100 bg-ink-50 p-2">
          {saving ? (
            <div className="flex flex-col items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-brand-600 mb-2" />
              <span className="text-sm text-ink-500">Guardando firma...</span>
            </div>
          ) : (
            <SignaturePad onSave={handleSaveFirma} onClear={() => {}} />
          )}
        </div>
      </div>
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
          La firma se puede cargar después desde el perfil del usuario.
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


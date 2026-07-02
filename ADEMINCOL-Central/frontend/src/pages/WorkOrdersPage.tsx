import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Plus, MapPin, User as UserIcon, X, Loader2 } from "lucide-react";
import {
  createRealOT,
  fetchRealOTs,
  fetchRealUsers,
  PreviewApiError,
  type NewOTPayload,
  type RealOT,
  type RealUser,
} from "../api/previewClient";
import { Spinner, EmptyState, ErrorState } from "../components/ui/States";
import { OTStatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";

// Página conectada a la BD REAL en Google Sheets (hoja "work_orders", decisión D11).
export function WorkOrdersPage() {
  const { user } = useAuth();
  const [ots, setOts] = useState<RealOT[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  function load() {
    setError(null);
    setOts(null);
    fetchRealOTs()
      .then(setOts)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "No se pudieron cargar las órdenes de trabajo.")
      );
  }

  useEffect(load, []);

  const canCreate = user?.rol === "ADMINISTRADOR" || user?.rol === "SUPERVISOR";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Órdenes de Trabajo</h1>
          <p className="text-sm text-ink-500">
            Base de datos real en Google Sheets — hoja "work_orders"
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Nueva OT
          </button>
        )}
      </div>

      {ots === null && !error && <Spinner label="Consultando la BD de OTs..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {ots !== null && ots.length === 0 && (
        <EmptyState
          title="No hay órdenes de trabajo"
          description="Crea la primera OT con el botón 'Nueva OT'."
        />
      )}

      {ots !== null && ots.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ots.map((ot) => (
            <div key={ot.idOt} className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-ink-900">{ot.numero}</p>
                  <p className="text-xs text-ink-400">{ot.contrato ?? "Sin contrato"}</p>
                </div>
                <OTStatusBadge status={ot.estado} />
              </div>

              <p className="mb-1 text-sm font-medium text-ink-800">{ot.cliente ?? "-"}</p>
              {ot.ubicacion && (
                <p className="mb-3 flex items-center gap-1 text-xs text-ink-500">
                  <MapPin size={12} /> {ot.ubicacion}
                </p>
              )}

              {ot.descripcion && <p className="mb-4 text-sm text-ink-600">{ot.descripcion}</p>}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500">
                <span className="flex items-center gap-1">
                  <UserIcon size={12} /> Sup: {ot.supervisorUsuario ?? "—"}
                </span>
                <span className="flex items-center gap-1">
                  <UserIcon size={12} /> Insp: {ot.inspectorUsuario ?? "—"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <NewOTModal
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

function NewOTModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [usuarios, setUsuarios] = useState<RealUser[]>([]);
  const [form, setForm] = useState<NewOTPayload>({
    numero: "",
    contrato: "",
    cliente: "",
    ubicacion: "",
    supervisorUsuario: "",
    inspectorUsuario: "",
    fechaInicio: "",
    fechaFin: "",
    estado: "PENDIENTE",
    descripcion: "",
  });

  useEffect(() => {
    fetchRealUsers()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

  const supervisores = usuarios.filter((u) => u.activo && u.rol !== "INSPECTOR");
  const inspectores = usuarios.filter((u) => u.activo && u.rol === "INSPECTOR");

  function set<K extends keyof NewOTPayload>(key: K, value: NewOTPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createRealOT(form);
      toast.success(`OT ${form.numero} creada en la BD.`);
      onCreated();
    } catch (err) {
      toast.error(err instanceof PreviewApiError ? err.message : "No se pudo crear la OT.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">Nueva Orden de Trabajo</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Número de OT *">
            <input
              required
              value={form.numero}
              onChange={(e) => set("numero", e.target.value)}
              placeholder="OT-2026-0145"
              className={inputCls}
            />
          </Field>
          <Field label="Contrato">
            <input
              value={form.contrato}
              onChange={(e) => set("contrato", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Cliente">
            <input
              value={form.cliente}
              onChange={(e) => set("cliente", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Ubicación">
            <input
              value={form.ubicacion}
              onChange={(e) => set("ubicacion", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Supervisor">
            <select
              value={form.supervisorUsuario}
              onChange={(e) => set("supervisorUsuario", e.target.value)}
              className={inputCls}
            >
              <option value="">— Sin asignar —</option>
              {supervisores.map((u) => (
                <option key={u.usuario} value={u.usuario}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Inspector">
            <select
              value={form.inspectorUsuario}
              onChange={(e) => set("inspectorUsuario", e.target.value)}
              className={inputCls}
            >
              <option value="">— Sin asignar —</option>
              {inspectores.map((u) => (
                <option key={u.usuario} value={u.usuario}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Fecha inicio">
            <input
              type="date"
              value={form.fechaInicio}
              onChange={(e) => set("fechaInicio", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Fecha fin">
            <input
              type="date"
              value={form.fechaFin}
              onChange={(e) => set("fechaFin", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Estado">
            <select
              value={form.estado}
              onChange={(e) => set("estado", e.target.value)}
              className={inputCls}
            >
              <option value="PENDIENTE">Pendiente</option>
              <option value="EN_CURSO">En curso</option>
              <option value="COMPLETADA">Completada</option>
              <option value="CANCELADA">Cancelada</option>
            </select>
          </Field>
        </div>

        <Field label="Descripción">
          <textarea
            value={form.descripcion}
            onChange={(e) => set("descripcion", e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "Guardando en la BD..." : "Crear OT"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-sm font-medium text-ink-700">{label}</span>
      {children}
    </label>
  );
}

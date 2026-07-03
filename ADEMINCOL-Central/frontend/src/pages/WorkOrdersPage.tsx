import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Plus, MapPin, User as UserIcon, X, Loader2, Wrench, ChevronDown, ChevronUp } from "lucide-react";
import {
  createRealOT,
  crearServicio,
  fetchRealOTs,
  fetchServicios,
  PreviewApiError,
  type NewOTPayload,
  type RealOT,
  type RealServicio,
  type Tecnica,
} from "../api/previewClient";
import { Spinner, EmptyState, ErrorState } from "../components/ui/States";
import { OTStatusBadge } from "../components/ui/StatusBadge";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";

const TECNICAS_DISPONIBLES: { value: Tecnica; label: string }[] = [
  { value: "MT", label: "Partículas Magnéticas (MT)" },
  { value: "PMI", label: "Caracterización de Materiales (PMI)" },
];

// Página conectada a la BD REAL en Google Sheets (hoja "work_orders" + "servicios").
// Decisión de la reunión 2026-07-03: el supervisor NUNCA se selecciona (es
// siempre quien crea la OT); el inspector tampoco se elige aquí — se asigna
// por servicio, y ese servicio lo autoasigna el inspector desde AppSheet.
export function WorkOrdersPage() {
  const { user } = useAuth();
  const [ots, setOts] = useState<RealOT[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [expandedOt, setExpandedOt] = useState<string | null>(null);

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

              <div className="flex items-center justify-between border-t border-ink-100 pt-3 text-xs text-ink-500">
                <span className="flex items-center gap-1">
                  <UserIcon size={12} /> Solicitó: {ot.supervisorUsuario ?? "—"}
                </span>
                <button
                  onClick={() => setExpandedOt(expandedOt === ot.idOt ? null : ot.idOt)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-brand-700 hover:bg-brand-50"
                >
                  <Wrench size={12} /> Servicios
                  {expandedOt === ot.idOt ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {expandedOt === ot.idOt && (
                <ServiciosDeOt idOt={ot.idOt} canCreate={!!canCreate} />
              )}
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

function ServiciosDeOt({ idOt, canCreate }: { idOt: string; canCreate: boolean }) {
  const toast = useToast();
  const [servicios, setServicios] = useState<RealServicio[] | null>(null);
  const [creando, setCreando] = useState<Tecnica | null>(null);

  function load() {
    fetchServicios(idOt)
      .then(setServicios)
      .catch(() => toast.error("No se pudieron cargar los servicios de esta OT."));
  }

  useEffect(load, [idOt]);

  async function handleGenerarServicio(tecnica: Tecnica) {
    setCreando(tecnica);
    try {
      await crearServicio(idOt, tecnica);
      toast.success(`Servicio ${tecnica} generado.`);
      load();
    } catch (e) {
      toast.error(e instanceof PreviewApiError ? e.message : "No se pudo generar el servicio.");
    } finally {
      setCreando(null);
    }
  }

  const tecnicasYaCreadas = new Set((servicios ?? []).map((s) => s.tecnica));

  return (
    <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3">
      {servicios === null && <p className="text-xs text-ink-400">Cargando servicios...</p>}
      {servicios !== null && servicios.length === 0 && (
        <p className="mb-2 text-xs text-ink-400">Sin servicios generados todavía.</p>
      )}
      {servicios !== null &&
        servicios.map((s) => (
          <div
            key={s.idServicio}
            className="mb-1.5 flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 text-xs"
          >
            <div className="flex items-center gap-2">
              <Badge tone="blue">{s.tecnica}</Badge>
              <span className="font-mono text-ink-500">{s.idServicio}</span>
            </div>
            <div className="flex items-center gap-2 text-ink-500">
              <span>{s.inspectorUsuario ?? "sin autoasignar"}</span>
              <OTStatusBadge status={s.estado} />
            </div>
          </div>
        ))}

      {canCreate && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TECNICAS_DISPONIBLES.filter((t) => !tecnicasYaCreadas.has(t.value)).map((t) => (
            <button
              key={t.value}
              onClick={() => handleGenerarServicio(t.value)}
              disabled={creando === t.value}
              className="rounded-md border border-dashed border-ink-300 px-2 py-1 text-[11px] font-medium text-ink-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
            >
              {creando === t.value ? "Generando..." : `+ Generar servicio ${t.value}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NewOTModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Omit<NewOTPayload, "supervisorUsuario">>({
    numero: "",
    contrato: "",
    cliente: "",
    ubicacion: "",
    fechaInicio: "",
    fechaFin: "",
    estado: "PENDIENTE",
    descripcion: "",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await createRealOT({ ...form, supervisorUsuario: user.usuario });
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

        <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
          Solicitante: <span className="font-semibold text-ink-700">{user?.nombre}</span> (tú).
          Los servicios (MT, PMI...) y el inspector se asignan después de crear la OT.
        </p>

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

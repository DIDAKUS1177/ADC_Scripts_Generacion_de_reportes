import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Search, X, Loader2, Wrench } from "lucide-react";
import {
  crearServicio,
  fetchRealOTs,
  fetchServicios,
  PreviewApiError,
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

// Página de Servicios (renombrada de "Órdenes de Trabajo" — pedido explícito
// 2026-07-10: "dejemos de hablar de OT, todo va a ser creación de
// servicio"). El flujo principal es crear un servicio: el supervisor
// solicitante se toma siempre del usuario autenticado (nunca un <select>) y
// el inspector se asigna después, desde AppSheet.
//
// La OT sigue existiendo por debajo (la hoja `work_orders` y su sync no se
// tocaron) y un servicio todavía puede vincularse a una si ya existe una —
// pero ya no es el concepto central de esta página: no hay grilla de OTs
// ni botón para crear una nueva, solo un listado plano de servicios con la
// OT (si tiene) como un dato secundario más en la fila.
export function WorkOrdersPage() {
  const { user } = useAuth();
  const [servicios, setServicios] = useState<RealServicio[] | null>(null);
  const [ots, setOts] = useState<RealOT[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showServicioModal, setShowServicioModal] = useState(false);
  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "CANCELADA">(
    "todos"
  );

  function load() {
    setError(null);
    setServicios(null);
    fetchServicios()
      .then(setServicios)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los servicios."));
  }

  // Solo para poblar el <select> "OT asociada (opcional)" del modal de
  // creación y para mostrar el número de OT en la tabla — la OT ya no tiene
  // vista propia en esta página.
  function loadOts() {
    fetchRealOTs()
      .then(setOts)
      .catch(() => setOts([]));
  }

  useEffect(load, []);
  useEffect(loadOts, []);

  const otPorId = useMemo(() => {
    const m: Record<string, RealOT> = {};
    for (const ot of ots) m[ot.idOt] = ot;
    return m;
  }, [ots]);

  const filtered = useMemo(() => {
    if (!servicios) return [];
    const q = query.trim().toLowerCase();
    return servicios.filter((s) => {
      if (filtroEstado !== "todos" && s.estado !== filtroEstado) return false;
      if (!q) return true;
      const ot = s.idOt ? otPorId[s.idOt] : null;
      return [s.idServicio, s.tecnica, s.supervisorUsuario, s.inspectorUsuario, ot?.numero, ot?.cliente]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [servicios, query, filtroEstado, otPorId]);

  const canCreate = user?.rol === "ADMINISTRADOR" || user?.rol === "SUPERVISOR";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Servicios</h1>
          <p className="text-sm text-ink-500">Creación y seguimiento de servicios de inspección</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowServicioModal(true)}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Wrench size={16} /> Nuevo Servicio
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ID, técnica, supervisor, inspector u OT..."
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
        >
          <option value="todos">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="EN_CURSO">En curso</option>
          <option value="COMPLETADA">Completada</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
      </div>

      {servicios === null && !error && <Spinner label="Cargando servicios..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {servicios !== null && filtered.length === 0 && (
        <EmptyState
          title="Sin servicios"
          description={
            servicios.length === 0
              ? "Crea el primer servicio con el botón 'Nuevo Servicio'."
              : "No hay servicios que coincidan con los filtros."
          }
        />
      )}

      {servicios !== null && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
              <tr>
                <th className="px-3 py-3">ID Servicio</th>
                <th className="px-3 py-3">Técnica</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Solicitó</th>
                <th className="px-3 py-3">Inspector</th>
                <th className="px-3 py-3">OT asociada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((s) => {
                const ot = s.idOt ? otPorId[s.idOt] : null;
                return (
                  <tr key={s.idServicio}>
                    <td className="px-3 py-2.5 font-mono text-xs text-ink-800">{s.idServicio}</td>
                    <td className="px-3 py-2.5">
                      <Badge tone="blue">{s.tecnica}</Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <OTStatusBadge status={s.estado} />
                    </td>
                    <td className="px-3 py-2.5 text-ink-600">{s.supervisorUsuario ?? "—"}</td>
                    <td className="px-3 py-2.5 text-ink-600">{s.inspectorUsuario ?? "sin autoasignar"}</td>
                    <td className="px-3 py-2.5 text-ink-500">
                      {ot ? (
                        <span title={ot.cliente ?? undefined}>{ot.numero}</span>
                      ) : (
                        <span className="text-ink-300">Sin OT</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showServicioModal && (
        <NewServicioModal
          ots={ots}
          onClose={() => setShowServicioModal(false)}
          onCreated={() => {
            setShowServicioModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// Mismo formato que un modal de creación estándar (grid 2 columnas). El
// id_servicio se genera automáticamente en el backend (no se pide acá) y
// la OT es OPCIONAL — un servicio no depende de tener una OT creada.
function NewServicioModal({
  ots,
  onClose,
  onCreated,
}: {
  ots: RealOT[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ tecnica: Tecnica; idOt: string }>({
    tecnica: "MT",
    idOt: "",
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { idServicio } = await crearServicio(form.tecnica, user.usuario, form.idOt || undefined);
      toast.success(
        form.idOt
          ? `Servicio ${idServicio} creado y vinculado a la OT.`
          : `Servicio ${idServicio} creado.`
      );
      onCreated();
    } catch (err) {
      toast.error(err instanceof PreviewApiError ? err.message : "No se pudo crear el servicio.");
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
          <h2 className="text-lg font-bold text-ink-900">Nuevo Servicio</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
          Solicitante: <span className="font-semibold text-ink-700">{user?.nombre}</span> (tú).
          El ID del servicio se genera automáticamente.
        </p>

        <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
          <Field label="Técnica a ejecutar *">
            <select
              required
              value={form.tecnica}
              onChange={(e) => setForm({ ...form, tecnica: e.target.value as Tecnica })}
              className={inputCls}
            >
              {TECNICAS_DISPONIBLES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          {ots.length > 0 && (
            <Field label="OT asociada (opcional)">
              <select
                value={form.idOt}
                onChange={(e) => setForm({ ...form, idOt: e.target.value })}
                className={inputCls}
              >
                <option value="">Sin OT asociada</option>
                {ots.map((ot) => (
                  <option key={ot.idOt} value={ot.idOt}>
                    {ot.numero} — {ot.cliente ?? "sin cliente"}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-ink-100 bg-ink-50 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Crear Servicio
          </button>
        </div>
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

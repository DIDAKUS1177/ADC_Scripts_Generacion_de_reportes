import { useEffect, useMemo, useState } from "react";
import {
  Award,
  X,
  Loader2,
  Plus,
  Trash2,
  Save,
  Wrench,
  Power,
  Clock,
  Sun,
  Moon,
} from "lucide-react";
import {
  fetchRealEquipos,
  crearEquipo,
  actualizarEquipo,
  borrarEquipo,
  fetchPersonalCertificados,
  crearCertificadoPersonal,
  actualizarCertificadoPersonal,
  borrarCertificadoPersonal,
  type RealEquipo,
  type PersonalCertificado,
  type NewPersonalCertificadoPayload,
} from "../api/previewClient";
import { Spinner, ErrorState, EmptyState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { ComboSelect } from "../components/ui/ComboSelect";
import { useTheme } from "../context/ThemeContext";

type Tab = "equipos" | "roster";

const TABS: { code: Tab; label: string; icon: typeof Wrench }[] = [
  { code: "equipos", label: "Equipos físicos", icon: Wrench },
  { code: "roster", label: "Certificados", icon: Award },
];

// Valor de filtro compartido por los selects de "Todos/Todas" en las tablas
// 100% editables de Equipos y Certificados (decisión 2026-07-08).
const FILTRO_TODOS = "__todos__";

// ---- Estado de una fecha de vencimiento (calibración de equipo o
// certificado) — compartido entre las tabs de Equipos y Certificados
// (pedido 2026-07-10: advertencia de "faltan N días" 2 meses antes, y
// distinguir explícitamente cuando NO hay fecha registrada — antes esos
// casos se veían "normales" en vez de advertir).
type EstadoFecha = "vencido" | "por_vencer" | "vigente" | "sin_fecha";

function estadoFechaVencimiento(fecha: string): { estado: EstadoFecha; dias: number | null } {
  const valor = (fecha || "").trim();
  if (!valor) return { estado: "sin_fecha", dias: null };
  const d = new Date(valor);
  if (isNaN(d.getTime())) return { estado: "sin_fecha", dias: null };
  const dias = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (dias < 0) return { estado: "vencido", dias };
  if (dias <= 60) return { estado: "por_vencer", dias }; // 2 meses antes
  return { estado: "vigente", dias };
}

function AvisoVencimiento({ fecha }: { fecha: string }) {
  const { estado, dias } = estadoFechaVencimiento(fecha);
  if (estado === "sin_fecha") {
    return <p className="mt-1 text-[11px] font-medium text-orange-500">Sin fecha registrada</p>;
  }
  if (estado === "vencido") {
    return (
      <p className="mt-1 text-[11px] font-medium text-red-600">
        Vencido hace {Math.abs(dias ?? 0)} día{Math.abs(dias ?? 0) === 1 ? "" : "s"}
      </p>
    );
  }
  if (estado === "por_vencer") {
    return (
      <p className="mt-1 text-[11px] font-medium text-amber-600">
        Faltan {dias} día{dias === 1 ? "" : "s"} para vencer
      </p>
    );
  }
  return null;
}

function RelojActual() {
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => {
    const id = window.setInterval(() => setAhora(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const fecha = ahora.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  const hora = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300">
      <Clock size={13} className="text-ink-400 dark:text-ink-500" />
      <span className="capitalize">{fecha}</span>
      <span className="font-mono text-ink-800 dark:text-ink-100">{hora}</span>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      className="flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
    >
      {theme === "light" ? <Moon size={13} /> : <Sun size={13} />}
      {theme === "light" ? "Modo oscuro" : "Modo claro"}
    </button>
  );
}

export function EquiposPage() {
  const [tab, setTab] = useState<Tab>("equipos");

  return (
    <div className="dark:text-ink-100">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-white">Equipos y Certificados</h1>
          <p className="text-sm text-ink-500 dark:text-ink-400">
            Usuarios de la plataforma, equipos físicos de ensayo y los certificados del
            personal de ADEMINCOL
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RelojActual />
          <ThemeToggle />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.code}
              onClick={() => setTab(t.code)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                tab === t.code
                  ? "bg-brand-600 text-white"
                  : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "equipos" && <EquiposFisicosTab />}
      {tab === "roster" && <CertificadosTab />}
    </div>
  );
}

// =====================================================================
// Tab 2: Equipos físicos — decisión D17 (2026-07-07), tabla 100%
// editable por celda + filtros (2026-07-08)
// =====================================================================
type EquipoEdit = Partial<
  Pick<
    RealEquipo,
    "categoria" | "equipo" | "serie" | "serialAdc" | "fechaCalibracion" | "fechaVencimientoCalibracion" | "observaciones"
  >
>;

function EquiposFisicosTab() {
  const toast = useToast();
  const [equipos, setEquipos] = useState<RealEquipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState(FILTRO_TODOS);
  const [filtroEquipo, setFiltroEquipo] = useState("");
  const [filtroSerie, setFiltroSerie] = useState("");
  const [filtroSerialAdc, setFiltroSerialAdc] = useState("");
  const [filtroVencimiento, setFiltroVencimiento] = useState<"todos" | EstadoFecha>("todos");
  const [filtroObservaciones, setFiltroObservaciones] = useState("");
  const [filtroActivo, setFiltroActivo] = useState<"todos" | "activo" | "inactivo">("todos");
  const [edits, setEdits] = useState<Record<string, EquipoEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);

  function load() {
    setError(null);
    setEquipos(null);
    fetchRealEquipos()
      .then(setEquipos)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar la BD de equipos."));
  }

  useEffect(load, []);

  const categorias = useMemo(() => {
    if (!equipos) return [];
    return Array.from(new Set(equipos.map((e) => (e.categoria || "").trim()).filter(Boolean))).sort();
  }, [equipos]);

  const equiposUnicos = useMemo(() => {
    if (!equipos) return [];
    return Array.from(new Set(equipos.map((e) => (e.equipo || "").trim()).filter(Boolean))).sort();
  }, [equipos]);

  const filtered = useMemo(() => {
    if (!equipos) return [];
    const qEquipo = filtroEquipo.trim().toLowerCase();
    const qSerie = filtroSerie.trim().toLowerCase();
    const qSerialAdc = filtroSerialAdc.trim().toLowerCase();
    const qObservaciones = filtroObservaciones.trim().toLowerCase();
    return equipos.filter((e) => {
      if (filtroCategoria !== FILTRO_TODOS && (e.categoria || "") !== filtroCategoria) return false;
      if (filtroActivo === "activo" && !e.activo) return false;
      if (filtroActivo === "inactivo" && e.activo) return false;
      if (qEquipo && !(e.equipo || "").toLowerCase().includes(qEquipo)) return false;
      if (qSerie && !(e.serie || "").toLowerCase().includes(qSerie)) return false;
      if (qSerialAdc && !(e.serialAdc || "").toLowerCase().includes(qSerialAdc)) return false;
      if (qObservaciones && !(e.observaciones || "").toLowerCase().includes(qObservaciones)) return false;
      if (filtroVencimiento !== "todos") {
        const { estado } = estadoFechaVencimiento(e.fechaVencimientoCalibracion || "");
        if (estado !== filtroVencimiento) return false;
      }
      return true;
    });
  }, [
    equipos,
    filtroCategoria,
    filtroEquipo,
    filtroSerie,
    filtroSerialAdc,
    filtroObservaciones,
    filtroVencimiento,
    filtroActivo,
  ]);

  function valorCampo(e: RealEquipo, campo: keyof EquipoEdit): string {
    const edit = edits[e.idEquipo];
    const val = edit && campo in edit ? edit[campo] : e[campo];
    return (val as string) ?? "";
  }

  function setCampo(idEquipo: string, campo: keyof EquipoEdit, valor: string) {
    setEdits((prev) => ({
      ...prev,
      [idEquipo]: { ...prev[idEquipo], [campo]: valor } as EquipoEdit,
    }));
  }

  function esDirty(idEquipo: string): boolean {
    return Boolean(edits[idEquipo] && Object.keys(edits[idEquipo]).length > 0);
  }

  async function guardar(idEquipo: string) {
    const cambios = edits[idEquipo];
    if (!cambios || Object.keys(cambios).length === 0) return;
    setSavingId(idEquipo);
    try {
      await actualizarEquipo(idEquipo, cambios);
      toast.success("Equipo actualizado.");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[idEquipo];
        return next;
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleActivo(equipo: RealEquipo) {
    try {
      await actualizarEquipo(equipo.idEquipo, { activo: !equipo.activo });
      toast.success(equipo.activo ? "Equipo desactivado." : "Equipo reactivado.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }

  async function handleBorrar(equipo: RealEquipo) {
    if (
      !window.confirm(
        `¿Borrar el equipo "${equipo.categoria || equipo.idEquipo}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await borrarEquipo(equipo.idEquipo);
      toast.success("Equipo borrado.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-2 self-start rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={15} /> Nuevo equipo
        </button>
      </div>

      {equipos === null && !error && <Spinner label="Cargando equipos..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {equipos !== null && filtered.length === 0 && (
        <EmptyState title="Sin equipos" description="No hay equipos que coincidan con los filtros." />
      )}

      {equipos !== null && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
              <tr>
                <th className="px-3 pt-3">Categoría</th>
                <th className="px-3 pt-3">Equipo</th>
                <th className="px-3 pt-3">Serie</th>
                <th className="px-3 pt-3">Serial ADC</th>
                <th className="px-3 pt-3">Última calibración</th>
                <th className="px-3 pt-3">Vencimiento</th>
                <th className="px-3 pt-3">Observaciones</th>
                <th className="px-3 pt-3">Estado</th>
                <th className="px-3 pt-3 text-right">Acciones</th>
              </tr>
              <tr>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <select
                    value={filtroCategoria}
                    onChange={(e) => setFiltroCategoria(e.target.value)}
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  >
                    <option value={FILTRO_TODOS}>Todas</option>
                    {categorias.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <input
                    value={filtroEquipo}
                    onChange={(e) => setFiltroEquipo(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  />
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <input
                    value={filtroSerie}
                    onChange={(e) => setFiltroSerie(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  />
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <input
                    value={filtroSerialAdc}
                    onChange={(e) => setFiltroSerialAdc(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  />
                </th>
                <th className="px-1.5 pb-2.5 pt-1"></th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <select
                    value={filtroVencimiento}
                    onChange={(e) => setFiltroVencimiento(e.target.value as "todos" | EstadoFecha)}
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  >
                    <option value="todos">Todos</option>
                    <option value="vigente">Vigente</option>
                    <option value="por_vencer">Por vencer</option>
                    <option value="vencido">Vencido</option>
                    <option value="sin_fecha">Sin fecha</option>
                  </select>
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <input
                    value={filtroObservaciones}
                    onChange={(e) => setFiltroObservaciones(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  />
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <select
                    value={filtroActivo}
                    onChange={(e) => setFiltroActivo(e.target.value as "todos" | "activo" | "inactivo")}
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  >
                    <option value="todos">Todos</option>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                  </select>
                </th>
                <th className="px-1.5 pb-2.5 pt-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((e) => {
                const dirty = esDirty(e.idEquipo);
                const { estado: estadoVencimiento } = estadoFechaVencimiento(
                  valorCampo(e, "fechaVencimientoCalibracion")
                );
                return (
                  <tr key={e.idEquipo} className={!e.activo ? "opacity-50" : ""}>
                    <td className="px-1.5 py-1.5 min-w-[120px]">
                      <ComboSelect
                        value={valorCampo(e, "categoria")}
                        options={categorias}
                        onChange={(val) => setCampo(e.idEquipo, "categoria", val)}
                        placeholder="Categoría..."
                        className="w-full"
                      />
                    </td>
                    <td className="px-1.5 py-1.5 min-w-[120px]">
                      <ComboSelect
                        value={valorCampo(e, "equipo")}
                        options={equiposUnicos}
                        onChange={(val) => setCampo(e.idEquipo, "equipo", val)}
                        placeholder="Equipo..."
                        className="w-full"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(e, "serie")}
                        onChange={(ev) => setCampo(e.idEquipo, "serie", ev.target.value)}
                        className="w-24 rounded border border-transparent px-2 py-1 font-mono text-xs text-ink-600 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(e, "serialAdc")}
                        onChange={(ev) => setCampo(e.idEquipo, "serialAdc", ev.target.value)}
                        className="w-24 rounded border border-transparent px-2 py-1 font-mono text-xs font-semibold text-brand-700 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        value={valorCampo(e, "fechaCalibracion")}
                        onChange={(ev) => setCampo(e.idEquipo, "fechaCalibracion", ev.target.value)}
                        className="rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        value={valorCampo(e, "fechaVencimientoCalibracion")}
                        onChange={(ev) => setCampo(e.idEquipo, "fechaVencimientoCalibracion", ev.target.value)}
                        className={`rounded border px-2 py-1 text-xs outline-none focus:border-brand-600 ${
                          estadoVencimiento === "por_vencer" || estadoVencimiento === "vencido"
                            ? "border-amber-400 bg-amber-50"
                            : estadoVencimiento === "sin_fecha"
                              ? "border-orange-300 bg-orange-50"
                              : "border-ink-200"
                        }`}
                      />
                      <AvisoVencimiento fecha={valorCampo(e, "fechaVencimientoCalibracion")} />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(e, "observaciones")}
                        onChange={(ev) => setCampo(e.idEquipo, "observaciones", ev.target.value)}
                        placeholder="—"
                        className="w-32 rounded border border-transparent px-2 py-1 text-xs text-ink-600 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={e.activo ? "green" : "gray"}>{e.activo ? "Activo" : "Inactivo"}</Badge>
                        {estadoVencimiento === "por_vencer" && <Badge tone="yellow">Por vencer</Badge>}
                        {estadoVencimiento === "vencido" && <Badge tone="red">Vencido</Badge>}
                        {estadoVencimiento === "sin_fecha" && <Badge tone="gray">Sin fecha</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {dirty && (
                          <button
                            onClick={() => guardar(e.idEquipo)}
                            disabled={savingId === e.idEquipo}
                            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                          >
                            {savingId === e.idEquipo ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Save size={12} />
                            )}
                            Guardar
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActivo(e)}
                          title={e.activo ? "Desactivar" : "Reactivar"}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        >
                          <Power size={14} />
                        </button>
                        <button
                          onClick={() => handleBorrar(e)}
                          title="Borrar equipo"
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <NuevoEquipoModal
          categorias={categorias}
          equiposUnicos={equiposUnicos}
          onClose={() => setShowNuevo(false)}
          onCreated={() => {
            setShowNuevo(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NuevoEquipoModal({
  categorias,
  equiposUnicos,
  onClose,
  onCreated,
}: {
  categorias: string[];
  equiposUnicos: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    categoria: "",
    equipo: "",
    serie: "",
    serialAdc: "",
    fechaCalibracion: "",
    fechaVencimientoCalibracion: "",
    observaciones: "",
  });

  async function handleSave() {
    if (!form.categoria.trim() || !form.serialAdc.trim()) {
      toast.error("Categoría y serial ADC son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await crearEquipo(form);
      toast.success("Equipo creado.");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el equipo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <h2 className="text-lg font-bold text-ink-900">Nuevo equipo</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Categoría *</label>
            <ComboSelect
              value={form.categoria}
              options={categorias}
              onChange={(val) => setForm((f) => ({ ...f, categoria: val }))}
              placeholder="Ej: MX2, PAUT VEO3, Espesores..."
              className="w-full rounded border border-ink-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Equipo</label>
            <ComboSelect
              value={form.equipo}
              options={equiposUnicos}
              onChange={(val) => setForm((f) => ({ ...f, equipo: val }))}
              placeholder="Dejar vacío para usar categoría"
              className="w-full rounded border border-ink-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Serie (fábrica)</label>
            <input
              value={form.serie}
              onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))}
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Serial ADC *</label>
            <input
              value={form.serialAdc}
              onChange={(e) => setForm((f) => ({ ...f, serialAdc: e.target.value }))}
              placeholder="Ej: ADC131"
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Última calibración</label>
              <input
                type="date"
                value={form.fechaCalibracion}
                onChange={(e) => setForm((f) => ({ ...f, fechaCalibracion: e.target.value }))}
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Vencimiento</label>
              <input
                type="date"
                value={form.fechaVencimientoCalibracion}
                onChange={(e) => setForm((f) => ({ ...f, fechaVencimientoCalibracion: e.target.value }))}
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-ink-100 bg-ink-50 p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Tab 3: Certificados (RRHH) — decisión D17 (2026-07-07), tabla plana
// editable por celda + filtros (2026-07-08). La técnica es texto libre (no
// un select cerrado): el personal de ADEMINCOL maneja 29+ técnicas
// distintas y solo 4 tienen reporte automatizado, así que restringir el
// campo perdería información real.
//
// 2026-07-10: "nombre" y "cc" dejan de ser editables en esta tabla (pedido
// explícito: "no debería de cambiar lo relacionado a nombre ni cédula, esto
// no debería de cambiar al menos en la tabla") — son la clave de identidad
// del roster, editarlas por accidente en una celda inline puede desligar
// certificados de la persona real. Siguen siendo editables al CREAR un
// certificado nuevo (NuevoCertificadoModal), solo no en la edición inline.
// =====================================================================
type CertificadoEdit = Partial<
  Pick<PersonalCertificado, "numeroCertificado" | "tecnica" | "nivel" | "fechaEmision" | "fechaVencimiento">
>;

function CertificadosTab() {
  const toast = useToast();
  const [certs, setCerts] = useState<PersonalCertificado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroCc, setFiltroCc] = useState("");
  const [filtroTecnica, setFiltroTecnica] = useState(FILTRO_TODOS);
  const [filtroNivel, setFiltroNivel] = useState("");
  const [filtroNumeroCertificado, setFiltroNumeroCertificado] = useState("");
  const [filtroEstado, setFiltroEstado] = useState(FILTRO_TODOS);
  const [edits, setEdits] = useState<Record<string, CertificadoEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);

  function load() {
    setError(null);
    setCerts(null);
    fetchPersonalCertificados()
      .then(setCerts)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el roster."));
  }

  useEffect(load, []);

  const tecnicas = useMemo(() => {
    if (!certs) return [];
    return Array.from(new Set(certs.map((c) => (c.tecnica || "").trim()).filter(Boolean))).sort();
  }, [certs]);

  const { nombresUnicos, nombreToCcMap } = useMemo(() => {
    if (!certs) return { nombresUnicos: [], nombreToCcMap: {} as Record<string, string> };
    const nameToCc: Record<string, string> = {};
    for (const c of certs) {
      const n = (c.nombre || "").trim();
      const cc = (c.cc || "").trim();
      if (n && cc && !nameToCc[n]) {
        nameToCc[n] = cc;
      }
    }
    return {
      nombresUnicos: Array.from(new Set(certs.map((c) => (c.nombre || "").trim()).filter(Boolean))).sort(),
      nombreToCcMap: nameToCc,
    };
  }, [certs]);

  const filtered = useMemo(() => {
    if (!certs) return [];
    const qNombre = filtroNombre.trim().toLowerCase();
    const qCc = filtroCc.trim().toLowerCase();
    const qNivel = filtroNivel.trim().toLowerCase();
    const qNumeroCertificado = filtroNumeroCertificado.trim().toLowerCase();
    return certs.filter((c) => {
      if (filtroTecnica !== FILTRO_TODOS && (c.tecnica || "") !== filtroTecnica) return false;
      if (filtroEstado !== FILTRO_TODOS && (c.estado || "") !== filtroEstado) return false;
      if (qNombre && !(c.nombre || "").toLowerCase().includes(qNombre)) return false;
      if (qCc && !(c.cc || "").toLowerCase().includes(qCc)) return false;
      if (qNivel && !(c.nivel || "").toLowerCase().includes(qNivel)) return false;
      if (qNumeroCertificado && !(c.numeroCertificado || "").toLowerCase().includes(qNumeroCertificado)) return false;
      return true;
    });
  }, [certs, filtroNombre, filtroCc, filtroTecnica, filtroNivel, filtroNumeroCertificado, filtroEstado]);

  function valorCampo(c: PersonalCertificado, campo: keyof CertificadoEdit): string {
    const edit = edits[c.idCertificado];
    const val = edit && campo in edit ? edit[campo] : c[campo];
    return (val as string) ?? "";
  }

  function setCampo(idCertificado: string, campo: keyof CertificadoEdit, valor: string) {
    setEdits((prev) => {
      const newEdits = { ...prev };
      if (!newEdits[idCertificado]) {
        newEdits[idCertificado] = {};
      }
      newEdits[idCertificado][campo] = valor;
      return newEdits;
    });
  }

  function esDirty(idCertificado: string): boolean {
    return Boolean(edits[idCertificado] && Object.keys(edits[idCertificado]).length > 0);
  }

  async function guardar(idCertificado: string) {
    const cambios = edits[idCertificado];
    if (!cambios || Object.keys(cambios).length === 0) return;
    setSavingId(idCertificado);
    try {
      await actualizarCertificadoPersonal(idCertificado, cambios);
      toast.success("Certificado actualizado.");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[idCertificado];
        return next;
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleBorrar(c: PersonalCertificado) {
    if (
      !window.confirm(
        `¿Borrar el certificado de "${c.nombre}" (${c.tecnica || "sin técnica"})? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await borrarCertificadoPersonal(c.idCertificado);
      toast.success("Certificado borrado.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  function estadoTone(estado: string | null): "green" | "red" | "gray" {
    if (estado === "VIGENTE") return "green";
    if (estado === "VENCIDA") return "red";
    return "gray";
  }

  return (
    <div>
      <p className="mb-4 text-xs text-ink-500">
        Listado maestro de RRHH, identificado por cédula (no por usuario de la webapp). Incluye
        personal que todavía no tiene login en la plataforma. La técnica es texto libre. El
        nombre y la cédula no se editan desde esta tabla.
      </p>
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-2 self-start rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={15} /> Nuevo certificado
        </button>
      </div>

      {certs === null && !error && <Spinner label="Cargando roster..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {certs !== null && filtered.length === 0 && (
        <EmptyState title="Sin resultados" description="No hay certificados que coincidan con los filtros." />
      )}

      {certs !== null && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
              <tr>
                <th className="px-3 pt-3">Nombre</th>
                <th className="px-3 pt-3">CC</th>
                <th className="px-3 pt-3">Técnica</th>
                <th className="px-3 pt-3">Nivel</th>
                <th className="px-3 pt-3"># Certificado</th>
                <th className="px-3 pt-3">Fecha emisión</th>
                <th className="px-3 pt-3">Fecha vencimiento</th>
                <th className="px-3 pt-3">Estado</th>
                <th className="px-3 pt-3 text-right">Acciones</th>
              </tr>
              <tr>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <input
                    value={filtroNombre}
                    onChange={(e) => setFiltroNombre(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full min-w-[130px] rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  />
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <input
                    value={filtroCc}
                    onChange={(e) => setFiltroCc(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  />
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <select
                    value={filtroTecnica}
                    onChange={(e) => setFiltroTecnica(e.target.value)}
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  >
                    <option value={FILTRO_TODOS}>Todas</option>
                    {tecnicas.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <input
                    value={filtroNivel}
                    onChange={(e) => setFiltroNivel(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  />
                </th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <input
                    value={filtroNumeroCertificado}
                    onChange={(e) => setFiltroNumeroCertificado(e.target.value)}
                    placeholder="Filtrar..."
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  />
                </th>
                <th className="px-1.5 pb-2.5 pt-1"></th>
                <th className="px-1.5 pb-2.5 pt-1"></th>
                <th className="px-1.5 pb-2.5 pt-1 font-normal normal-case">
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="w-full rounded border border-ink-200 bg-white px-2 py-1 text-xs outline-none focus:border-brand-600"
                  >
                    <option value={FILTRO_TODOS}>Todos</option>
                    <option value="VIGENTE">Vigente</option>
                    <option value="VENCIDA">Vencida</option>
                  </select>
                </th>
                <th className="px-1.5 pb-2.5 pt-1"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((c) => {
                const dirty = esDirty(c.idCertificado);
                return (
                  <tr key={c.idCertificado}>
                    <td className="px-3 py-2 min-w-[160px] text-sm text-ink-800" title="El nombre no se edita desde esta tabla">
                      {c.nombre || "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-600" title="La cédula no se edita desde esta tabla">
                      {c.cc || "—"}
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(c, "tecnica")}
                        onChange={(ev) => setCampo(c.idCertificado, "tecnica", ev.target.value)}
                        placeholder="Ej: API 570, MT, CWI..."
                        className="w-32 rounded border border-transparent px-2 py-1 text-sm outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(c, "nivel")}
                        onChange={(ev) => setCampo(c.idCertificado, "nivel", ev.target.value)}
                        placeholder="I / II / III"
                        className="w-16 rounded border border-transparent px-2 py-1 text-sm outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(c, "numeroCertificado")}
                        onChange={(ev) => setCampo(c.idCertificado, "numeroCertificado", ev.target.value)}
                        className="w-24 rounded border border-transparent px-2 py-1 text-xs text-ink-600 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        value={valorCampo(c, "fechaEmision")}
                        onChange={(ev) => setCampo(c.idCertificado, "fechaEmision", ev.target.value)}
                        className="rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        value={valorCampo(c, "fechaVencimiento")}
                        onChange={(ev) => setCampo(c.idCertificado, "fechaVencimiento", ev.target.value)}
                        className="rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
                      />
                      <AvisoVencimiento fecha={valorCampo(c, "fechaVencimiento")} />
                    </td>
                    <td className="px-3 py-2.5">{c.estado && <Badge tone={estadoTone(c.estado)}>{c.estado}</Badge>}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {dirty && (
                          <button
                            onClick={() => guardar(c.idCertificado)}
                            disabled={savingId === c.idCertificado}
                            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                          >
                            {savingId === c.idCertificado ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Save size={12} />
                            )}
                            Guardar
                          </button>
                        )}
                        <button
                          onClick={() => handleBorrar(c)}
                          title="Borrar certificado"
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <NuevoCertificadoModal
          nombresUnicos={nombresUnicos}
          nombreToCcMap={nombreToCcMap}
          onClose={() => setShowNuevo(false)}
          onCreated={() => {
            setShowNuevo(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NuevoCertificadoModal({
  nombresUnicos,
  nombreToCcMap,
  onClose,
  onCreated,
}: {
  nombresUnicos: string[];
  nombreToCcMap: Record<string, string>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewPersonalCertificadoPayload>({
    nombre: "",
    cc: "",
    tecnica: "",
    nivel: "",
    numeroCertificado: "",
    fechaEmision: "",
    fechaVencimiento: "",
  });

  async function handleSave() {
    if (!form.nombre.trim() || !form.tecnica.trim()) {
      toast.error("Nombre y técnica son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await crearCertificadoPersonal(form);
      toast.success("Certificado creado.");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el certificado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <h2 className="text-lg font-bold text-ink-900">Nuevo certificado</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Nombre *</label>
            <ComboSelect
              value={form.nombre}
              options={nombresUnicos}
              onChange={(val) => {
                const trimmed = val.trim();
                setForm((f) => ({
                  ...f,
                  nombre: val,
                  cc: nombreToCcMap[trimmed] || f.cc, // Auto-fill si existe
                }));
              }}
              placeholder="Nombre del personal..."
              className="w-full rounded border border-ink-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Cédula (cc)</label>
            <input
              value={form.cc}
              onChange={(e) => setForm((f) => ({ ...f, cc: e.target.value }))}
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Técnica *</label>
              <input
                value={form.tecnica}
                onChange={(e) => setForm((f) => ({ ...f, tecnica: e.target.value }))}
                placeholder="Ej: API 570, MT, CWI..."
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Nivel</label>
              <input
                value={form.nivel}
                onChange={(e) => setForm((f) => ({ ...f, nivel: e.target.value }))}
                placeholder="I / II / III"
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700"># Certificado</label>
            <input
              value={form.numeroCertificado}
              onChange={(e) => setForm((f) => ({ ...f, numeroCertificado: e.target.value }))}
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Fecha de emisión</label>
              <input
                type="date"
                value={form.fechaEmision}
                onChange={(e) => setForm((f) => ({ ...f, fechaEmision: e.target.value }))}
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Fecha de vencimiento</label>
              <input
                type="date"
                value={form.fechaVencimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-ink-100 bg-ink-50 p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

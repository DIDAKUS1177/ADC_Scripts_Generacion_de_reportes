import { useEffect, useMemo, useState } from "react";
import {
  ClipboardList, FileCheck2, Clock3, Users, AlertTriangle, Wrench,
  ArrowDownAZ, ArrowDownWideNarrow, X, ChevronDown, RotateCcw,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useAuth } from "../context/AuthContext";
import { fetchRealDashboard, type RealDashboardData } from "../api/previewClient";
import { Spinner, ErrorState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import { ROLE_LABEL } from "../components/layout/navConfig";

// Paleta categórica validada (8 pasos, orden fijo — ver skill de dataviz:
// "un 9no color nunca es un hue generado, se pliega en Otra/agrupado"). Con
// 9 técnicas reales hoy (MT/PMI/570/510/ESPESORES/SCANC_LINEAS/SCANC_RP/
// PIERNAS_MUERTAS/ACFM) se pliegan SCANC_LINEAS y SCANC_RP en una sola
// serie "SCANC" para estos gráficos (ver normalizarTecnica) — así entran
// justo en los 8 slots sin generar un color extra ni caer a gris genérico.
const TECNICA_COLORS: Record<string, string> = {
  MT: "#2a78d6",           // slot 1 — blue
  PMI: "#1baf7a",          // slot 2 — aqua
  "570": "#eda100",        // slot 3 — yellow
  "510": "#008300",        // slot 4 — green
  ESPESORES: "#4a3aa7",    // slot 5 — violet
  SCANC: "#e34948",        // slot 6 — red
  PIERNAS_MUERTAS: "#e87ba4", // slot 7 — magenta
  ACFM: "#eb6834",         // slot 8 — orange
};

// Colores por estado de OT — mismo criterio que OTStatusBadge (ver
// components/ui/StatusBadge.tsx: gray/blue/green/red), pero en hex para
// las barras de recharts.
const ESTADO_COLORS: Record<string, string> = {
  PENDIENTE: "#a8a29e",
  EN_CURSO: "#0ea5e9",
  COMPLETADA: "#10b981",
  CANCELADA: "#dc2626",
};

function normalizarTecnica(tecnica: string): string {
  return tecnica === "SCANC_LINEAS" || tecnica === "SCANC_RP" ? "SCANC" : tecnica;
}

function colorParaTecnica(tecnica: string): string {
  return TECNICA_COLORS[normalizarTecnica(tecnica)] || "#89877e";
}

function colorParaEstado(estado: string): string {
  return ESTADO_COLORS[estado] || "#89877e";
}

// Dashboard con datos REALES (BD Sheets + Sheets de MT/PMI/570), diferenciado
// por rol — ver decisión reunión 2026-07-03 ("mejora ese dashboard, ajustado
// para que el administrador mire los activos, los supervisores inspectores").
// Reemplaza el mock de mock/client.ts.
export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<RealDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!user) return;
    setError(null);
    setData(null);
    fetchRealDashboard(user.usuario, user.rol)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error desconocido"));
  }

  useEffect(load, [user]);

  if (!user) return null;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <Spinner label="Cargando indicadores reales..." />;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-ink-900">
        Hola, {user.nombre.split(" ")[0]}
      </h1>
      <p className="mb-6 text-sm text-ink-500">{ROLE_LABEL[user.rol]} · ADEMINCOL Central</p>

      {user.rol === "ADMINISTRADOR" && <AdminDashboard data={data} />}
      {user.rol === "SUPERVISOR" && <SupervisorDashboard data={data} />}
      {user.rol === "INSPECTOR" && <InspectorDashboard data={data} />}
    </div>
  );
}

// ---- Helpers para transformar datos cruzados en formato recharts ----

function buildGroupedBarData(
  dataMap: Record<string, Record<string, number>>
): { chartData: Array<Record<string, string | number>>; tecnicas: string[] } {
  // Orden fijo de la paleta categórica (no alfabético) — el orden de los
  // slots ES el mecanismo de seguridad CVD del skill de dataviz, alterarlo
  // (ej. con .sort()) puede juntar dos hues poco distinguibles.
  const ordenFijo = Object.keys(TECNICA_COLORS);
  const tecnicasSet = new Set<string>();
  for (const sub of Object.values(dataMap)) {
    for (const t of Object.keys(sub)) tecnicasSet.add(normalizarTecnica(t));
  }
  const tecnicas = ordenFijo.filter((t) => tecnicasSet.has(t));

  const chartData = Object.entries(dataMap).map(([name, tecMap]) => {
    const entry: Record<string, string | number> = { name };
    for (const t of tecnicas) entry[t] = 0;
    for (const [tecRaw, valor] of Object.entries(tecMap)) {
      const t = normalizarTecnica(tecRaw);
      entry[t] = (Number(entry[t]) || 0) + valor;
    }
    return entry;
  });

  return { chartData, tecnicas };
}

// ---- Gráfico de barras verticales, agrupado por técnica, con filtros
// reales — pedido explícito del usuario 2026-07-16/17: "quiero que ese
// gráfico se pueda ocultar cosas de la leyenda, que sean barras
// verticales, y que se pueda filtrar por nombre... si quiero comparar
// solo a los de MT, solo a 3 personas, cosas así" + "hazlo con ganas,
// bastante completo, con filtros de verdad, poder ordenarlo bien".
//
// Tres mecanismos de filtro, combinables:
// 1. Chips de técnica (clic para ocultar/mostrar) — cubre "solo los de
//    MT": al ocultar todas las demás técnicas, las filas que quedan en
//    cero desaparecen del todo (no se quedan como barras vacías).
// 2. Selector de personas (checklist) — cubre "solo a 3 personas": a
//    diferencia del filtro de texto (que solo sirve para UN patrón), este
//    permite elegir cualquier combinación exacta de nombres.
// 3. Filtro de texto libre — atajo rápido para buscar por coincidencia.
// Más orden (alfabético / de mayor a menor total visible).
function GroupedBarChart({
  chart,
  colorFn = colorParaTecnica,
}: {
  chart: { chartData: Array<Record<string, string | number>>; tecnicas: string[] };
  colorFn?: (clave: string) => string;
}) {
  const [filtroTexto, setFiltroTexto] = useState("");
  const [tecnicasOcultas, setTecnicasOcultas] = useState<Set<string>>(new Set());
  const [personasOcultas, setPersonasOcultas] = useState<Set<string>>(new Set());
  const [orden, setOrden] = useState<"total" | "alfabetico">("total");
  const [selectorAbierto, setSelectorAbierto] = useState(false);

  const todosLosNombres = useMemo(
    () => chart.chartData.map((d) => String(d.name)).sort((a, b) => a.localeCompare(b)),
    [chart.chartData]
  );

  function toggleTecnica(t: string) {
    setTecnicasOcultas((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  }

  function togglePersona(nombre: string) {
    setPersonasOcultas((prev) => {
      const next = new Set(prev);
      if (next.has(nombre)) next.delete(nombre);
      else next.add(nombre);
      return next;
    });
  }

  const hayFiltrosActivos =
    filtroTexto.trim() !== "" || tecnicasOcultas.size > 0 || personasOcultas.size > 0;

  function limpiarFiltros() {
    setFiltroTexto("");
    setTecnicasOcultas(new Set());
    setPersonasOcultas(new Set());
  }

  const datosFiltrados = useMemo(() => {
    const q = filtroTexto.trim().toLowerCase();
    const conTotal = chart.chartData.map((d) => ({
      ...d,
      __total: chart.tecnicas.reduce(
        (acc, t) => acc + (tecnicasOcultas.has(t) ? 0 : Number(d[t]) || 0),
        0
      ),
    }));
    const filtrados = conTotal.filter((d) => {
      if (personasOcultas.has(String(d.name))) return false;
      if (q && !String(d.name).toLowerCase().includes(q)) return false;
      // Si hay técnicas ocultas, las filas que quedaron en cero para las
      // técnicas visibles no aportan nada a la comparación — se omiten.
      if (tecnicasOcultas.size > 0 && d.__total === 0) return false;
      return true;
    });
    filtrados.sort((a, b) =>
      orden === "total"
        ? (b.__total as number) - (a.__total as number)
        : String(a.name).localeCompare(String(b.name))
    );
    return filtrados;
  }, [chart.chartData, chart.tecnicas, filtroTexto, tecnicasOcultas, personasOcultas, orden]);

  if (chart.chartData.length === 0) return <EmptyRow />;

  return (
    <div>
      {/* ---- Barra de filtros ---- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <input
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-52 rounded-lg border border-ink-200 py-1.5 pl-3 pr-7 text-xs outline-none focus:border-brand-600"
          />
          {filtroTexto && (
            <button
              onClick={() => setFiltroTexto("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
              aria-label="Limpiar búsqueda"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setSelectorAbierto((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-brand-300 hover:text-brand-700"
          >
            Personas
            {personasOcultas.size > 0 && (
              <Badge tone="blue">{todosLosNombres.length - personasOcultas.size}</Badge>
            )}
            <ChevronDown size={13} />
          </button>
          {selectorAbierto && (
            <div className="absolute left-0 top-full z-20 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-ink-200 bg-white p-2 shadow-lg">
              <div className="mb-1.5 flex items-center justify-between px-1">
                <button
                  onClick={() => setPersonasOcultas(new Set())}
                  className="text-[11px] font-medium text-brand-600 hover:underline"
                >
                  Marcar todas
                </button>
                <button
                  onClick={() => setPersonasOcultas(new Set(todosLosNombres))}
                  className="text-[11px] font-medium text-ink-400 hover:underline"
                >
                  Desmarcar todas
                </button>
              </div>
              {todosLosNombres.map((nombre) => (
                <label
                  key={nombre}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs text-ink-700 hover:bg-ink-50"
                >
                  <input
                    type="checkbox"
                    checked={!personasOcultas.has(nombre)}
                    onChange={() => togglePersona(nombre)}
                    className="h-3.5 w-3.5 accent-brand-600"
                  />
                  <span className="truncate">{nombre}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-ink-200 p-0.5">
          <button
            onClick={() => setOrden("total")}
            title="Ordenar de mayor a menor"
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              orden === "total" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-800"
            }`}
          >
            <ArrowDownWideNarrow size={13} /> Total
          </button>
          <button
            onClick={() => setOrden("alfabetico")}
            title="Ordenar alfabéticamente"
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              orden === "alfabetico" ? "bg-brand-50 text-brand-700" : "text-ink-500 hover:text-ink-800"
            }`}
          >
            <ArrowDownAZ size={13} /> A-Z
          </button>
        </div>

        {hayFiltrosActivos && (
          <button
            onClick={limpiarFiltros}
            className="flex items-center gap-1 text-[11px] font-medium text-ink-400 hover:text-brand-600"
          >
            <RotateCcw size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* ---- Chips de técnica: clic para aislar/ocultar (mismas señales
          que la leyenda del gráfico, pero visibles de entrada) ---- */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {chart.tecnicas.map((t) => {
          const oculta = tecnicasOcultas.has(t);
          return (
            <button
              key={t}
              onClick={() => toggleTecnica(t)}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-opacity"
              style={{
                borderColor: colorFn(t),
                color: oculta ? "#a8a29e" : colorFn(t),
                opacity: oculta ? 0.5 : 1,
                backgroundColor: oculta ? "transparent" : `${colorFn(t)}14`,
              }}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: oculta ? "#d6d3d1" : colorFn(t) }}
              />
              {t.replace(/_/g, " ")}
            </button>
          );
        })}
      </div>

      {datosFiltrados.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">
          Ningún dato coincide con los filtros actuales.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ minWidth: Math.max(560, datosFiltrados.length * 72) }}>
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={datosFiltrados} margin={{ top: 4, right: 12, left: 4, bottom: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  angle={-40}
                  textAnchor="end"
                  interval={0}
                  height={80}
                  tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 16) + "…" : v)}
                />
                <YAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8, cursor: "pointer" }}
                  onClick={(e) => toggleTecnica(String(e.dataKey))}
                  formatter={(value: string, entry: { dataKey?: string | number }) => (
                    <span style={{ opacity: tecnicasOcultas.has(String(entry.dataKey)) ? 0.35 : 1 }}>
                      {value}
                    </span>
                  )}
                />
                {chart.tecnicas.map((t) => (
                  <Bar
                    key={t}
                    dataKey={t}
                    name={t}
                    stackId="tecnica"
                    fill={colorFn(t)}
                    stroke="#fcfcfb"
                    strokeWidth={2}
                    barSize={28}
                    hide={tecnicasOcultas.has(t)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- ADMINISTRADOR: visión global del negocio ("los activos") ----
function AdminDashboard({ data }: { data: RealDashboardData }) {
  const totalReportes = Object.values(data.reportesPorTipo).reduce((a, r) => a + r.total, 0);
  const totalGenerados = Object.values(data.reportesPorTipo).reduce((a, r) => a + r.generados, 0);

  const supervisorChart = buildGroupedBarData(data.serviciosPorSupervisor ?? {});
  const inspectorChart = buildGroupedBarData(data.reportesPorInspector ?? {});

  const certsOrdenados = [...data.certificadosPorVencer].sort(
    (a, b) => diasParaVencer(a.fechaVencimiento) - diasParaVencer(b.fechaVencimiento)
  );

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Usuarios activos" value={data.usuariosActivos} tone="blue" />
        <StatCard icon={ClipboardList} label="Órdenes de trabajo" value={data.otsTotal} tone="blue" />
        <StatCard icon={Wrench} label="Servicios sin inspector asignado" value={data.serviciosPendientes} tone="yellow" />
        <StatCard icon={FileCheck2} label="Reportes generados" value={`${totalGenerados} / ${totalReportes}`} tone="green" />
      </div>

      {/* ---- Los dos gráficos más importantes: ancho completo ---- */}
      <div className="mt-8 space-y-6">
        <Panel title="Reportes generados por inspector" subtitle="Quién generó qué, y con qué técnica">
          <GroupedBarChart chart={inspectorChart} />
        </Panel>

        <Panel title="Servicios abiertos por supervisor" subtitle="Carga de trabajo solicitada, por técnica">
          <GroupedBarChart chart={supervisorChart} />
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="OTs por estado">
          {Object.entries(data.otsPorEstado).length === 0 ? (
            <EmptyRow />
          ) : (
            Object.entries(data.otsPorEstado).map(([estado, count]) => (
              <BarRow
                key={estado}
                label={estado}
                value={count}
                max={data.otsTotal || 1}
                color={colorParaEstado(estado)}
              />
            ))
          )}
        </Panel>

        <Panel title="Reportes por técnica" subtitle="Generados / total">
          {Object.entries(data.reportesPorTipo).map(([tipo, r]) => (
            <BarRow
              key={tipo}
              label={tipo}
              value={r.generados}
              max={r.total || 1}
              suffix={`${r.generados}/${r.total}`}
              color={colorParaTecnica(tipo)}
            />
          ))}
        </Panel>

        <Panel title="Servicios por técnica">
          {Object.entries(data.serviciosPorTecnica).length === 0 ? (
            <EmptyRow />
          ) : (
            Object.entries(data.serviciosPorTecnica).map(([tecnica, count]) => (
              <BarRow
                key={tecnica}
                label={tecnica}
                value={count}
                max={data.serviciosTotal || 1}
                color={colorParaTecnica(tecnica)}
              />
            ))
          )}
        </Panel>

        <Panel title="Certificados por vencer" subtitle={`Próximos 60 días — ${data.certificadosPorVencer.length}`}>
          {certsOrdenados.length === 0 ? (
            <p className="text-sm text-ink-400">Ningún certificado vence pronto.</p>
          ) : (
            <div className="space-y-2">
              {certsOrdenados.map((c, i) => {
                const dias = diasParaVencer(c.fechaVencimiento);
                const critico = dias <= 15;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                      critico ? "bg-brand-50" : "bg-amber-50"
                    }`}
                  >
                    <div>
                      <p className={`font-medium ${critico ? "text-brand-800" : "text-amber-800"}`}>
                        {c.usuario} · {c.tecnica}
                      </p>
                      <p className={critico ? "text-brand-600" : "text-amber-600"}>{c.nombreCertificado}</p>
                    </div>
                    <div className="text-right">
                      <Badge tone={critico ? "red" : "yellow"}>{c.fechaVencimiento}</Badge>
                      {Number.isFinite(dias) && (
                        <p className={`mt-0.5 text-[10px] ${critico ? "text-brand-500" : "text-amber-500"}`}>
                          {dias <= 0 ? "vencido" : `en ${dias} día${dias === 1 ? "" : "s"}`}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function diasParaVencer(fechaVencimiento: string): number {
  const fecha = new Date(fechaVencimiento);
  if (Number.isNaN(fecha.getTime())) return Infinity;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}

// ---- SUPERVISOR: sus propias OTs y servicios ----
function SupervisorDashboard({ data }: { data: RealDashboardData }) {
  const misOts = data.misOts ?? [];
  const misServicios = data.misServicios ?? [];
  const serviciosSinInspector = misServicios.filter((s) => s.estado === "PENDIENTE").length;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Mis órdenes de trabajo" value={misOts.length} tone="blue" />
        <StatCard icon={Wrench} label="Mis servicios generados" value={misServicios.length} tone="blue" />
        <StatCard icon={Clock3} label="Servicios sin inspector asignado" value={serviciosSinInspector} tone="yellow" />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Mis OTs">
          {misOts.length === 0 ? (
            <EmptyRow />
          ) : (
            <div className="space-y-1.5">
              {misOts.map((ot) => (
                <div key={ot.idOt} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-xs">
                  <span className="font-medium">{ot.numero} — {ot.cliente || "sin cliente"}</span>
                  <Badge tone={ot.estado === "COMPLETADA" ? "green" : "gray"}>{ot.estado}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Mis servicios">
          {misServicios.length === 0 ? (
            <EmptyRow />
          ) : (
            <div className="space-y-1.5">
              {misServicios.map((s) => (
                <div key={s.idServicio} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-xs">
                  <span className="font-medium">{s.tecnica} · {s.idOt}</span>
                  <Badge tone={s.estado === "COMPLETADA" ? "green" : "gray"}>{s.estado}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

// ---- INSPECTOR: sus servicios asignados y sus certificados ----
function InspectorDashboard({ data }: { data: RealDashboardData }) {
  const misServicios = data.misServicios ?? [];
  const misCertsPorVencer = data.misCertificadosPorVencer ?? [];
  const pendientes = misServicios.filter((s) => s.estado !== "COMPLETADA").length;

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Wrench} label="Servicios asignados" value={misServicios.length} tone="blue" />
        <StatCard icon={Clock3} label="Pendientes" value={pendientes} tone="yellow" />
        <StatCard icon={AlertTriangle} label="Mis certificados por vencer" value={misCertsPorVencer.length} tone={misCertsPorVencer.length > 0 ? "yellow" : "gray"} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Mis servicios asignados">
          {misServicios.length === 0 ? (
            <p className="text-sm text-ink-400">Aún no tienes servicios autoasignados.</p>
          ) : (
            <div className="space-y-1.5">
              {misServicios.map((s) => (
                <div key={s.idServicio} className="flex items-center justify-between rounded-lg bg-ink-50 px-3 py-2 text-xs">
                  <span className="font-medium">{s.tecnica} · {s.idOt}</span>
                  <Badge tone={s.estado === "COMPLETADA" ? "green" : "gray"}>{s.estado}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Mis certificados por vencer">
          {misCertsPorVencer.length === 0 ? (
            <p className="text-sm text-ink-400">Ningún certificado tuyo vence en los próximos 60 días.</p>
          ) : (
            <div className="space-y-2">
              {misCertsPorVencer.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs">
                  <span className="font-medium text-amber-800">{c.tecnica} — {c.nombreCertificado}</span>
                  <Badge tone="yellow">{c.fechaVencimiento}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-ink-800">{title}</h2>
        {subtitle && <p className="text-[11px] text-ink-400">{subtitle}</p>}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function EmptyRow() {
  return <p className="text-sm text-ink-400">Sin datos todavía.</p>;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number | string;
  tone: "blue" | "green" | "yellow" | "gray";
}) {
  const toneClasses = {
    blue: "bg-sky-50 text-sky-600",
    green: "bg-emerald-50 text-emerald-600",
    yellow: "bg-amber-50 text-amber-600",
    gray: "bg-ink-100 text-ink-500",
  }[tone];

  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5 shadow-sm">
      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneClasses}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-bold text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
  suffix,
  color,
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  color?: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-600">
        <span className="font-medium">{label.replace(/_/g, " ")}</span>
        <span>{suffix ?? value}</span>
      </div>
      <div className="h-2 rounded-full bg-ink-100">
        <div
          className="h-2 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color || "#dc2626" }}
        />
      </div>
    </div>
  );
}

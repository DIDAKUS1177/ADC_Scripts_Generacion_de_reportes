import { useEffect, useState } from "react";
import { ClipboardList, FileCheck2, Clock3, Users, AlertTriangle, Wrench } from "lucide-react";
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

function normalizarTecnica(tecnica: string): string {
  return tecnica === "SCANC_LINEAS" || tecnica === "SCANC_RP" ? "SCANC" : tecnica;
}

function colorParaTecnica(tecnica: string): string {
  return TECNICA_COLORS[normalizarTecnica(tecnica)] || "#89877e";
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

// Gráfico "Reportes generados por inspector" — pedido explícito del
// usuario 2026-07-16: barras verticales (antes horizontales, `layout=
// "vertical"` de recharts = barras que crecen hacia la derecha), poder
// ocultar técnicas de la leyenda con un clic (para comparar "solo los de
// MT", por ejemplo) y filtrar por nombre (para comparar "solo a 3
// personas"). El filtro de nombre reduce las FILAS que entran al
// gráfico; el clic en la leyenda oculta/muestra una serie completa (una
// técnica) sin perder el resto — ambos mecanismos se combinan.
function InspectorReportsChart({
  chart,
}: {
  chart: { chartData: Array<Record<string, string | number>>; tecnicas: string[] };
}) {
  const [filtroNombre, setFiltroNombre] = useState("");
  const [tecnicasOcultas, setTecnicasOcultas] = useState<Set<string>>(new Set());

  function toggleTecnica(dataKey: string) {
    setTecnicasOcultas((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) next.delete(dataKey);
      else next.add(dataKey);
      return next;
    });
  }

  const datosFiltrados = chart.chartData.filter((d) =>
    String(d.name).toLowerCase().includes(filtroNombre.trim().toLowerCase())
  );

  if (chart.chartData.length === 0) return <EmptyRow />;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={filtroNombre}
          onChange={(e) => setFiltroNombre(e.target.value)}
          placeholder="Filtrar por nombre de inspector..."
          className="w-full max-w-xs rounded-lg border border-ink-200 px-3 py-1.5 text-xs outline-none focus:border-brand-600"
        />
        {filtroNombre && (
          <button
            onClick={() => setFiltroNombre("")}
            className="text-xs font-medium text-ink-400 hover:text-ink-700"
          >
            Limpiar
          </button>
        )}
        <span className="text-[11px] text-ink-400">
          Clic en la leyenda para ocultar/mostrar una técnica
        </span>
      </div>

      {datosFiltrados.length === 0 ? (
        <EmptyRow />
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
                    fill={colorParaTecnica(t)}
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

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Usuarios activos" value={data.usuariosActivos} tone="blue" />
        <StatCard icon={ClipboardList} label="Órdenes de trabajo" value={data.otsTotal} tone="blue" />
        <StatCard icon={Wrench} label="Servicios sin inspector asignado" value={data.serviciosPendientes} tone="yellow" />
        <StatCard icon={FileCheck2} label="Reportes generados" value={`${totalGenerados} / ${totalReportes}`} tone="green" />
      </div>

      {/* ---- El gráfico más importante: ancho completo, arriba de todo lo demás ---- */}
      <div className="mt-8">
        <Panel title="Reportes generados por inspector">
          <InspectorReportsChart chart={inspectorChart} />
        </Panel>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="OTs por estado">
          {Object.entries(data.otsPorEstado).length === 0 ? (
            <EmptyRow />
          ) : (
            Object.entries(data.otsPorEstado).map(([estado, count]) => (
              <BarRow key={estado} label={estado} value={count} max={data.otsTotal || 1} />
            ))
          )}
        </Panel>

        <Panel title="Reportes por técnica (generados / total)">
          {Object.entries(data.reportesPorTipo).map(([tipo, r]) => (
            <BarRow key={tipo} label={tipo} value={r.generados} max={r.total || 1} suffix={`${r.generados}/${r.total}`} />
          ))}
        </Panel>

        <Panel title="Servicios por técnica">
          {Object.entries(data.serviciosPorTecnica).length === 0 ? (
            <EmptyRow />
          ) : (
            Object.entries(data.serviciosPorTecnica).map(([tecnica, count]) => (
              <BarRow key={tecnica} label={tecnica} value={count} max={data.serviciosTotal || 1} />
            ))
          )}
        </Panel>

        <Panel title={`Certificados por vencer (60 días) — ${data.certificadosPorVencer.length}`}>
          {data.certificadosPorVencer.length === 0 ? (
            <p className="text-sm text-ink-400">Ningún certificado vence pronto.</p>
          ) : (
            <div className="space-y-2">
              {data.certificadosPorVencer.map((c, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-xs">
                  <div>
                    <p className="font-medium text-amber-800">{c.usuario} · {c.tecnica}</p>
                    <p className="text-amber-600">{c.nombreCertificado}</p>
                  </div>
                  <Badge tone="yellow">{c.fechaVencimiento}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ---- Servicios abiertos por supervisor (segundo gráfico de barras) ---- */}
      <div className="mt-6">
        <Panel title="Servicios abiertos por supervisor">
          {supervisorChart.chartData.length === 0 ? (
            <EmptyRow />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, supervisorChart.chartData.length * 42)}>
              <BarChart
                data={supervisorChart.chartData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.length > 24 ? v.slice(0, 22) + "…" : v}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {supervisorChart.tecnicas.map((t) => (
                  <Bar
                    key={t}
                    dataKey={t}
                    name={t}
                    stackId="tecnica"
                    fill={colorParaTecnica(t)}
                    stroke="#fcfcfb"
                    strokeWidth={2}
                    barSize={18}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>
    </div>
  );
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

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-bold text-ink-800">{title}</h2>
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
    <div className="rounded-xl border border-ink-200 bg-white p-5">
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
}: {
  label: string;
  value: number;
  max: number;
  suffix?: string;
}) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-600">
        <span className="font-medium">{label.replace(/_/g, " ")}</span>
        <span>{suffix ?? value}</span>
      </div>
      <div className="h-2 rounded-full bg-ink-100">
        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

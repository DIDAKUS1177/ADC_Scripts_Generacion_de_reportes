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

// Paleta ADEMINCOL para las técnicas
const TECNICA_COLORS: Record<string, string> = {
  MT: "#dc2626",       // brand red
  PMI: "#0284c7",      // sky-600
  "570": "#059669",    // emerald-600
  "510": "#d97706",    // amber-600
  ESPESORES: "#7c3aed", // violet-600
  SCANC_LINEAS: "#0891b2", // cyan-600
  SCANC_RP: "#be185d",     // pink-700
};

function colorParaTecnica(tecnica: string): string {
  return TECNICA_COLORS[tecnica] || "#6b7280";
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
  const tecnicasSet = new Set<string>();
  for (const sub of Object.values(dataMap)) {
    for (const t of Object.keys(sub)) tecnicasSet.add(t);
  }
  const tecnicas = Array.from(tecnicasSet).sort();

  const chartData = Object.entries(dataMap).map(([name, tecMap]) => {
    const entry: Record<string, string | number> = { name };
    for (const t of tecnicas) {
      entry[t] = tecMap[t] || 0;
    }
    return entry;
  });

  return { chartData, tecnicas };
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
          {inspectorChart.chartData.length === 0 ? (
            <EmptyRow />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(240, inspectorChart.chartData.length * 42)}>
              <BarChart
                data={inspectorChart.chartData}
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
                {inspectorChart.tecnicas.map((t) => (
                  <Bar key={t} dataKey={t} fill={colorParaTecnica(t)} radius={[0, 4, 4, 0]} barSize={18} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
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
                  <Bar key={t} dataKey={t} fill={colorParaTecnica(t)} radius={[0, 4, 4, 0]} barSize={18} />
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

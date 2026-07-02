import { useEffect, useState } from "react";
import { ClipboardList, FileCheck2, Clock3, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import type { DashboardStats } from "../types";
import { fetchDashboard } from "../mock/client";
import { Spinner } from "../components/ui/States";
import { ROLE_LABEL } from "../components/layout/navConfig";

function timeAgo(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "hace instantes";
  if (diffMin < 60) return `hace ${diffMin} min`;
  return `hace ${Math.round(diffMin / 60)} h`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchDashboard(user.rol).then(setStats);
  }, [user]);

  if (!user) return null;
  if (!stats) return <Spinner label="Cargando indicadores..." />;

  const otsTotal = Object.values(stats.otsPorEstado).reduce((a, b) => a + b, 0);
  const pendientesTotal = Object.values(stats.inspeccionesPendientesPorTipo).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-ink-900">
        Hola, {user.nombre.split(" ")[0]}
      </h1>
      <p className="mb-6 text-sm text-ink-500">{ROLE_LABEL[user.rol]} · ADEMINCOL Central</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Órdenes de trabajo"
          value={otsTotal}
          tone="blue"
        />
        <StatCard
          icon={FileCheck2}
          label="Reportes este mes"
          value={stats.reportesGeneradosMes}
          tone="green"
        />
        <StatCard
          icon={Clock3}
          label="Inspecciones pendientes"
          value={pendientesTotal}
          tone="yellow"
        />
        <StatCard
          icon={RefreshCw}
          label="Última sincronización"
          value={timeAgo(stats.ultimaSincronizacion)}
          tone="gray"
          small
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-ink-800">OTs por estado</h2>
          <div className="space-y-3">
            {Object.entries(stats.otsPorEstado).map(([estado, count]) => (
              <BarRow key={estado} label={estado} value={count} max={otsTotal || 1} />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-ink-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-ink-800">
            Inspecciones pendientes por tipo
          </h2>
          <div className="space-y-3">
            {Object.entries(stats.inspeccionesPendientesPorTipo).map(([tipo, count]) => (
              <BarRow key={tipo} label={tipo} value={count} max={pendientesTotal || 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  small,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number | string;
  tone: "blue" | "green" | "yellow" | "gray";
  small?: boolean;
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
      <p className={`font-bold text-ink-900 ${small ? "text-base" : "text-2xl"}`}>{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}

function BarRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-ink-600">
        <span className="font-medium">{label.replace("_", " ")}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-ink-100">
        <div className="h-2 rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "../../context/AuthContext";
import { fetchRealDashboard } from "../../api/previewClient";

// Ventana flotante en la parte izquierda con la versión reducida de
// "Reportes generados por inspector" (pedido 2026-07-09: "en la parte
// izquierda como ventana flotante, saliera la ventana de Reportes
// generados por inspector el pequeño"). Persiste entre páginas (vive en
// AppShell) y se puede colapsar a una pestaña angosta para no tapar
// contenido. Suma todas las técnicas por inspector (a diferencia del
// gráfico grande del dashboard, que las desglosa por color) — acá el
// espacio es reducido y lo que importa es el total por persona.
export function FloatingInspectorChartWidget() {
  const { user } = useAuth();
  const [data, setData] = useState<{ name: string; total: number }[] | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!user || user.rol !== "ADMINISTRADOR") return;
    fetchRealDashboard(user.usuario, user.rol)
      .then((d) => {
        const rows = Object.entries(d.reportesPorInspector ?? {}).map(([name, tecMap]) => ({
          name,
          total: Object.values(tecMap).reduce((a, b) => a + b, 0),
        }));
        rows.sort((a, b) => b.total - a.total);
        setData(rows.slice(0, 8));
      })
      .catch(() => setData(null));
  }, [user]);

  if (!user || user.rol !== "ADMINISTRADOR" || !data || data.length === 0) return null;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        title="Mostrar reportes por inspector"
        className="fixed left-0 top-1/2 z-40 flex -translate-y-1/2 items-center gap-1 rounded-r-lg border border-l-0 border-ink-200 bg-white px-2 py-3 text-ink-500 shadow-md hover:bg-ink-50"
      >
        <BarChart3 size={16} />
        <ChevronRight size={14} />
      </button>
    );
  }

  return (
    <div className="fixed left-3 top-1/2 z-40 w-64 -translate-y-1/2 rounded-xl border border-ink-200 bg-white p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-500">
          <BarChart3 size={13} /> Por inspector
        </p>
        <button
          onClick={() => setCollapsed(true)}
          title="Ocultar"
          className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
        >
          <ChevronLeft size={14} />
        </button>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 26)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 9 }} height={16} />
          <YAxis
            type="category"
            dataKey="name"
            width={80}
            tick={{ fontSize: 9 }}
            tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 11) + "…" : v)}
          />
          <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
          <Bar dataKey="total" fill="#dc2626" radius={[0, 4, 4, 0]} barSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

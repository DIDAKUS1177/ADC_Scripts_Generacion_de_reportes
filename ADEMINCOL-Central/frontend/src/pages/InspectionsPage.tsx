import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles, Eye, Download, Link2, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";
import { ReportStatusBadge } from "../components/ui/StatusBadge";
import { Spinner, EmptyState, ErrorState } from "../components/ui/States";
import { fetchInspections, generateReport, runSync } from "../mock/client";
import type { InspectionListItem, ReportTypeCode } from "../types";
import { RealMtInspectionsPanel } from "../components/domain/RealMtInspectionsPanel";
import { RealPmiInspectionsPanel } from "../components/domain/RealPmiInspectionsPanel";

const TYPE_TABS: { code: ReportTypeCode | "TODOS"; label: string }[] = [
  { code: "TODOS", label: "Todos" },
  { code: "MT", label: "MT" },
  { code: "PMI", label: "PMI" },
  { code: "VT_SOLDADAS", label: "VT Soldadas" },
  { code: "UT_ESPESORES", label: "UT Espesores" },
];

export function InspectionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<InspectionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportTypeCode | "TODOS">("TODOS");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [generatingIds, setGeneratingIds] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);

  function load() {
    setError(null);
    setItems(null);
    fetchInspections()
      .then(setItems)
      .catch(() => setError("No se pudieron cargar las inspecciones."));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((i) => {
      const matchesTab = tab === "TODOS" || i.reportType === tab;
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || i.idInforme.toLowerCase().includes(q) || (i.cliente ?? "").toLowerCase().includes(q);
      return matchesTab && matchesQuery;
    });
  }, [items, tab, query]);

  async function handleGenerate(id: number) {
    setGeneratingIds((prev) => new Set(prev).add(id));
    setItems((prev) =>
      prev ? prev.map((i) => (i.id === id ? { ...i, estadoReporte: "GENERANDO" } : i)) : prev
    );
    try {
      await generateReport(id);
      toast.success("Reporte generado correctamente.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar el reporte.");
    } finally {
      setGeneratingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      load();
    }
  }

  async function handleBatchGenerate() {
    const ids = Array.from(selected);
    setSelected(new Set());
    for (const id of ids) {
      handleGenerate(id);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const run = await runSync();
      toast.success(`Sincronización completa: ${run.rowsUpserted} filas actualizadas.`);
      load();
    } catch {
      toast.error("Error al sincronizar con Google Sheets.");
    } finally {
      setSyncing(false);
    }
  }

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const canManage = user?.rol === "ADMINISTRADOR" || user?.rol === "SUPERVISOR";

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Inspecciones</h1>
          <p className="text-sm text-ink-500">
            Datos sincronizados desde Google Sheets (AppSheet)
          </p>
        </div>
        {tab !== "MT" && tab !== "PMI" && canManage && (
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 self-start rounded-lg border border-ink-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50 disabled:opacity-60"
          >
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {TYPE_TABS.map((t) => (
          <button
            key={t.code}
            onClick={() => setTab(t.code)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.code
                ? "bg-brand-600 text-white"
                : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "MT" ? (
        <RealMtInspectionsPanel />
      ) : tab === "PMI" ? (
        <RealPmiInspectionsPanel />
      ) : (
        <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por id_informe o cliente..."
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {canManage && selected.size > 0 && (
          <button
            onClick={handleBatchGenerate}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Sparkles size={15} />
            Generar seleccionados ({selected.size})
          </button>
        )}
      </div>

      {items === null && !error && <Spinner label="Cargando inspecciones..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {items !== null && !error && filtered.length === 0 && (
        <EmptyState
          title="No hay inspecciones"
          description="No se encontraron resultados con los filtros actuales."
        />
      )}

      {items !== null && !error && filtered.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
              <tr>
                {canManage && <th className="w-10 px-4 py-3"></th>}
                <th className="px-4 py-3">ID Informe</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">OT</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((insp) => (
                <tr key={insp.id} className="hover:bg-ink-50/60">
                  {canManage && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(insp.id)}
                        onChange={() => toggleSelect(insp.id)}
                        disabled={insp.estadoReporte === "GENERANDO"}
                        className="h-4 w-4 rounded accent-brand-600"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-mono font-medium text-ink-800">
                    {insp.idInforme}
                  </td>
                  <td className="px-4 py-3 text-ink-600">{insp.reportType}</td>
                  <td className="px-4 py-3 text-ink-600">{insp.cliente ?? "-"}</td>
                  <td className="px-4 py-3 text-ink-600">{insp.fecha ?? "-"}</td>
                  <td className="px-4 py-3">
                    {insp.workOrderNumero ? (
                      <span className="text-ink-600">{insp.workOrderNumero}</span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600">
                        <Link2 size={13} /> Sin vincular
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ReportStatusBadge status={insp.estadoReporte} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/inspecciones/${insp.id}`}
                        className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
                        title="Ver detalle"
                      >
                        <Eye size={16} />
                      </Link>
                      {canManage && insp.estadoReporte !== "GENERADO" && (
                        <button
                          onClick={() => handleGenerate(insp.id)}
                          disabled={generatingIds.has(insp.id)}
                          className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                        >
                          Generar
                        </button>
                      )}
                      {insp.estadoReporte === "GENERADO" && (
                        <button
                          onClick={() => toast.success("Descarga simulada iniciada.")}
                          className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                          title="Descargar"
                        >
                          <Download size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
}

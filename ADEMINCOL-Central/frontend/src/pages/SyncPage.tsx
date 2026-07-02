import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { fetchSyncRuns, runSync } from "../mock/client";
import type { SyncRun } from "../types";
import { Spinner, ErrorState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";

export function SyncPage() {
  const toast = useToast();
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  function load() {
    setError(null);
    setRuns(null);
    fetchSyncRuns()
      .then(setRuns)
      .catch(() => setError("No se pudo cargar el historial de sincronización."));
  }

  useEffect(load, []);

  async function handleRunNow() {
    setSyncing(true);
    try {
      await runSync();
      toast.success("Sincronización manual completada.");
      load();
    } catch {
      toast.error("Error al sincronizar.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Sincronización</h1>
          <p className="text-sm text-ink-500">
            Google Sheets → PostgreSQL, automática cada 5 minutos
          </p>
        </div>
        <button
          onClick={handleRunNow}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
          {syncing ? "Sincronizando..." : "Ejecutar ahora"}
        </button>
      </div>

      {runs === null && !error && <Spinner label="Cargando historial..." />}
      {error && <ErrorState message={error} onRetry={load} />}

      {runs !== null && (
        <div className="space-y-2">
          {runs.map((run) => (
            <div
              key={run.id}
              className="flex items-center justify-between rounded-xl border border-ink-200 bg-white p-4"
            >
              <div className="flex items-center gap-3">
                {run.status === "SUCCESS" && <CheckCircle2 size={18} className="text-emerald-600" />}
                {run.status === "ERROR" && <XCircle size={18} className="text-brand-600" />}
                {run.status === "RUNNING" && (
                  <Loader2 size={18} className="animate-spin text-amber-600" />
                )}
                <div>
                  <p className="text-sm font-medium text-ink-800">
                    {run.reportType} · {run.rowsUpserted} filas actualizadas
                  </p>
                  <p className="text-xs text-ink-400">
                    {new Date(run.startedAt).toLocaleString("es-CO")}
                    {run.errorDetail && (
                      <span className="ml-2 text-brand-600">— {run.errorDetail}</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

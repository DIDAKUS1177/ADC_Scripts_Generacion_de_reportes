import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { fetchSyncRunsReal, runSyncReal, PreviewApiError, type SyncRun } from "../api/previewClient";
import { Spinner, ErrorState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";

const NOMBRE_TABLA: Record<string, string> = {
  usuarios: "Usuarios",
  work_orders: "Órdenes de trabajo",
  servicios: "Servicios",
  equipos_ensayo: "Equipos",
  personal_certificados: "Certificados del personal",
  certificados_usuarios: "Certificados de usuarios",
  consecutivos_reportes: "Consecutivos de reportes",
};

export function SyncPage() {
  const toast = useToast();
  const [runs, setRuns] = useState<SyncRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [expandido, setExpandido] = useState<number | null>(null);

  function load() {
    setError(null);
    setRuns(null);
    fetchSyncRunsReal()
      .then(setRuns)
      .catch(() => setError("No se pudo cargar el historial de sincronización."));
  }

  useEffect(load, []);

  async function handleRunNow() {
    setSyncing(true);
    try {
      const resultado = await runSyncReal();
      if (resultado.huboError) {
        toast.error(`Sincronización con errores — ${resultado.totalFilas} filas actualizadas de todos modos.`);
      } else {
        toast.success(`Sincronización completa: ${resultado.totalFilas} filas actualizadas.`);
      }
      load();
    } catch (e) {
      toast.error(e instanceof PreviewApiError ? e.message : "Error al sincronizar.");
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
            Actualiza usuarios, órdenes de trabajo, servicios, equipos y certificados
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

      {runs !== null && runs.length === 0 && (
        <p className="text-sm text-ink-400">Todavía no se ha ejecutado ninguna sincronización.</p>
      )}

      {runs !== null && (
        <div className="space-y-2">
          {runs.map((run) => {
            const abierto = expandido === run.id;
            return (
              <div key={run.id} className="rounded-xl border border-ink-200 bg-white p-4">
                <button
                  onClick={() => setExpandido(abierto ? null : run.id)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    {run.status === "SUCCESS" && <CheckCircle2 size={18} className="text-emerald-600" />}
                    {run.status === "ERROR" && <XCircle size={18} className="text-brand-600" />}
                    <div>
                      <p className="text-sm font-medium text-ink-800">
                        {run.rowsUpserted} filas actualizadas
                        {run.status === "ERROR" && <span className="ml-2 text-xs text-brand-600">con errores</span>}
                      </p>
                      <p className="text-xs text-ink-400">
                        {new Date(run.startedAt).toLocaleString("es-CO")}
                      </p>
                    </div>
                  </div>
                  {abierto ? <ChevronUp size={16} className="text-ink-400" /> : <ChevronDown size={16} className="text-ink-400" />}
                </button>

                {abierto && (
                  <div className="mt-3 space-y-1 border-t border-ink-100 pt-3">
                    {Object.entries(run.detalle).map(([tabla, valor]) => (
                      <div key={tabla} className="flex items-center justify-between text-xs">
                        <span className="text-ink-500">{NOMBRE_TABLA[tabla] ?? tabla}</span>
                        {typeof valor === "number" ? (
                          <span className="font-medium text-ink-700">{valor} filas</span>
                        ) : (
                          <span className="max-w-[70%] truncate text-brand-600" title={valor}>{valor}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

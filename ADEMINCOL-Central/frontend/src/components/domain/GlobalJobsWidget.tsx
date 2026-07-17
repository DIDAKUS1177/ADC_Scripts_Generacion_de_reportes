import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { useJobs } from "../../context/JobsContext";

// Widget flotante GLOBAL de progreso de generación de reportes — se
// renderiza una sola vez en la raíz de la app (ver App.tsx), fuera del
// árbol de cada panel de Reportes, para que siga visible sin importar en
// qué página esté el usuario (pedido 2026-07-16). Posición bottom-LEFT
// (los toasts ya usan bottom-right, ver Toast.tsx) para no superponerse.
export function GlobalJobsWidget() {
  const { jobs, dismissJob } = useJobs();
  if (jobs.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 w-80 space-y-2">
      {jobs.map((job) => (
        <div key={job.jobId} className="rounded-xl border border-ink-200 bg-white p-3 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-ink-800">
              {job.estado === "RUNNING" && <Loader2 size={13} className="shrink-0 animate-spin text-brand-600" />}
              {job.estado === "DONE" && <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />}
              {job.estado === "ERROR" && <AlertCircle size={13} className="shrink-0 text-red-600" />}
              <span className="truncate">{job.label}</span>
            </span>
            <button
              onClick={() => dismissJob(job.jobId)}
              className="shrink-0 text-ink-400 hover:text-ink-700"
              aria-label="Cerrar"
            >
              <X size={14} />
            </button>
          </div>
          {job.estado === "ERROR" ? (
            <p className="text-[11px] text-red-600">{job.error}</p>
          ) : (
            <>
              <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-ink-500">
                <span className="truncate">{job.etapa}</span>
                <span className="shrink-0">{job.pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    job.estado === "DONE" ? "bg-emerald-500" : "bg-brand-600"
                  }`}
                  style={{ width: `${job.pct}%` }}
                />
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

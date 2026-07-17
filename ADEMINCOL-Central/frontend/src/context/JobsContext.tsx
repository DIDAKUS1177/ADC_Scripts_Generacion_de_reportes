import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getJobStatus, downloadJobResult, type ReportKind } from "../api/previewClient";
import { useToast } from "../components/ui/Toast";

export interface TrackedJob {
  jobId: string;
  tipo: ReportKind;
  idInforme: string;
  label: string;
  pct: number;
  etapa: string;
  estado: "RUNNING" | "DONE" | "ERROR";
  error: string | null;
}

interface JobsContextValue {
  jobs: TrackedJob[];
  startJob: (jobId: string, tipo: ReportKind, idInforme: string, label: string) => void;
  dismissJob: (jobId: string) => void;
}

const JobsContext = createContext<JobsContextValue | undefined>(undefined);

// Seguimiento GLOBAL de generación de reportes (pedido del usuario
// 2026-07-16: "si cambio de pestaña, ¿hay manera que no pare de
// generarse?"). La generación en sí YA corre en el backend y nunca se
// detenía al cambiar de página — lo que se perdía era el seguimiento: la
// barra de progreso vivía dentro de cada panel (Real570InspectionsPanel,
// etc.), así que al desmontarse (navegar a Equipos, Dashboard...) el
// polling se cortaba y, aunque el reporte terminara bien en el servidor,
// nunca se descargaba. Este contexto vive en la raíz de la app (ver
// App.tsx) y sigue el polling sin importar en qué página esté el usuario;
// el widget flotante (GlobalJobsWidget) se renderiza una sola vez, fuera
// del árbol de cada panel.
export function JobsProvider({ children }: { children: ReactNode }) {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const intervalsRef = useRef<Map<string, number>>(new Map());
  const toast = useToast();

  const stopPolling = useCallback((jobId: string) => {
    const intervalId = intervalsRef.current.get(jobId);
    if (intervalId) {
      window.clearInterval(intervalId);
      intervalsRef.current.delete(jobId);
    }
  }, []);

  const startJob = useCallback(
    (jobId: string, tipo: ReportKind, idInforme: string, label: string) => {
      setJobs((prev) => [
        ...prev.filter((j) => j.jobId !== jobId),
        { jobId, tipo, idInforme, label, pct: 0, etapa: "Iniciando...", estado: "RUNNING", error: null },
      ]);

      const intervalId = window.setInterval(async () => {
        try {
          const status = await getJobStatus(jobId);
          if (status.estado === "RUNNING") {
            setJobs((prev) =>
              prev.map((j) => (j.jobId === jobId ? { ...j, pct: status.pct, etapa: status.etapa } : j))
            );
            return;
          }
          stopPolling(jobId);
          if (status.estado === "DONE") {
            setJobs((prev) =>
              prev.map((j) => (j.jobId === jobId ? { ...j, pct: 100, etapa: "Descargando..." } : j))
            );
            await downloadJobResult(jobId, tipo, idInforme);
            setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, estado: "DONE" } : j)));
            toast.success(`${label}: reporte generado y descargado.`);
            status.warnings.forEach((w) => toast.error(`⚠️ ${w}`));
            window.setTimeout(() => {
              setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
            }, 5000);
          } else {
            setJobs((prev) =>
              prev.map((j) => (j.jobId === jobId ? { ...j, estado: "ERROR", error: status.error } : j))
            );
            toast.error(`${label}: ${status.error || "Error al generar el reporte."}`);
          }
        } catch {
          stopPolling(jobId);
          setJobs((prev) =>
            prev.map((j) =>
              j.jobId === jobId ? { ...j, estado: "ERROR", error: "Se perdió la conexión con el backend." } : j
            )
          );
        }
      }, 800);
      intervalsRef.current.set(jobId, intervalId);
    },
    [stopPolling, toast]
  );

  const dismissJob = useCallback(
    (jobId: string) => {
      stopPolling(jobId);
      setJobs((prev) => prev.filter((j) => j.jobId !== jobId));
    },
    [stopPolling]
  );

  useEffect(() => {
    const intervals = intervalsRef.current;
    return () => {
      intervals.forEach((id) => window.clearInterval(id));
    };
  }, []);

  return <JobsContext.Provider value={{ jobs, startJob, dismissJob }}>{children}</JobsContext.Provider>;
}

export function useJobs(): JobsContextValue {
  const ctx = useContext(JobsContext);
  if (!ctx) throw new Error("useJobs debe usarse dentro de JobsProvider");
  return ctx;
}

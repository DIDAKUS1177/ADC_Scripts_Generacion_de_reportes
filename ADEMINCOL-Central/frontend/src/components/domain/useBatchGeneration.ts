import { useRef, useState } from "react";
import {
  downloadBatchResult,
  getJobStatus,
  startBatchReportJob,
  PreviewApiError,
  type BatchDetalleItem,
  type ReportKind,
} from "../../api/previewClient";
import { useToast } from "../ui/Toast";

// Selección + generación MASIVA de reportes (reunión 2026-07-05: "que se
// puedan realizar reportes de manera masiva"). Un solo hook reutilizado por
// los 4 paneles (MT, PMI, 570, 510) — cada uno solo necesita renderizar los
// checkboxes y el botón, la lógica de cola/polling/descarga vive aquí.
export function useBatchGeneration(tipo: ReportKind) {
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState<{
    detalle: BatchDetalleItem[];
    pct: number;
    etapa: string;
    corriendo: boolean;
  } | null>(null);
  const pollRef = useRef<number | null>(null);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll(ids: string[]) {
    setSelected((prev) => (prev.size === ids.length && ids.every((i) => prev.has(i)) ? new Set() : new Set(ids)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function startBatch(overrides: Record<string, string> = {}) {
    const ids = Array.from(selected);
    if (!ids.length) {
      toast.error("Selecciona al menos un informe.");
      return;
    }
    setBatch({
      detalle: ids.map((id) => ({ id, estado: "PENDIENTE", error: null })),
      pct: 0,
      etapa: "Iniciando lote...",
      corriendo: true,
    });

    try {
      const jobId = await startBatchReportJob(tipo, ids, overrides);
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await getJobStatus(jobId);
          if (status.estado === "RUNNING") {
            setBatch({ detalle: status.detalleLote, pct: status.pct, etapa: status.etapa, corriendo: true });
            return;
          }
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          if (status.estado === "DONE") {
            setBatch({ detalle: status.detalleLote, pct: 100, etapa: "Descargando .zip...", corriendo: true });
            await downloadBatchResult(jobId);
            const exitosos = status.detalleLote.filter((d) => d.estado === "OK").length;
            toast.success(`Lote generado: ${exitosos}/${status.detalleLote.length} reportes exitosos.`);
            status.warnings.forEach((w) => toast.error(`⚠️ ${w}`));
            setBatch({ detalle: status.detalleLote, pct: 100, etapa: `Completado (${exitosos}/${status.detalleLote.length})`, corriendo: false });
          } else {
            toast.error(status.error || "Error al generar el lote.");
            setBatch((prev) => (prev ? { ...prev, corriendo: false } : prev));
          }
          setSelected(new Set());
        } catch {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setBatch((prev) => (prev ? { ...prev, corriendo: false } : prev));
          toast.error("Se perdió la conexión con el backend.");
        }
      }, 900);
    } catch (e) {
      setBatch(null);
      toast.error(e instanceof PreviewApiError ? e.message : "Error al iniciar la generación por lote.");
    }
  }

  function closeBatch() {
    if (pollRef.current) window.clearInterval(pollRef.current);
    pollRef.current = null;
    setBatch(null);
  }

  return { selected, toggleSelect, toggleSelectAll, clearSelection, batch, startBatch, closeBatch };
}

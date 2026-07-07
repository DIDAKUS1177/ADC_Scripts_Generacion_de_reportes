import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import type { BatchDetalleItem } from "../../api/previewClient";

// Panel de progreso de la generación masiva — compartido por los 4 paneles
// de reportes (MT, PMI, 570, 510). Ver useBatchGeneration.ts.
export function BatchGenerationStatus({
  detalle,
  pct,
  etapa,
  corriendo,
  onClose,
}: {
  detalle: BatchDetalleItem[];
  pct: number;
  etapa: string;
  corriendo: boolean;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-brand-700">
        <span>{etapa}</span>
        <div className="flex items-center gap-2">
          <span>{pct}%</span>
          {!corriendo && (
            <button onClick={onClose} className="rounded p-0.5 hover:bg-brand-100" title="Cerrar">
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-brand-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="max-h-32 space-y-1 overflow-y-auto">
        {detalle.map((d) => (
          <div key={d.id} className="flex items-center gap-2 text-[11px]">
            {d.estado === "OK" && <CheckCircle2 size={12} className="shrink-0 text-emerald-600" />}
            {d.estado === "ERROR" && <XCircle size={12} className="shrink-0 text-red-500" />}
            {d.estado === "GENERANDO" && <Loader2 size={12} className="shrink-0 animate-spin text-brand-600" />}
            {d.estado === "PENDIENTE" && <span className="ml-0.5 h-2 w-2 shrink-0 rounded-full bg-ink-200" />}
            <span className="truncate font-mono text-ink-700">{d.id}</span>
            {d.error && <span className="truncate text-red-500">— {d.error}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

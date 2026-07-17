import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, Layers, PencilLine } from "lucide-react";
import {
  downloadJobResult,
  fetchRealMtInspectionDetail,
  fetchRealMtInspections,
  getJobStatus,
  startReportJob,
  PreviewApiError,
  type MtPreviewDetail,
  type MtPreviewItem,
} from "../../api/previewClient";
import { Spinner, EmptyState, ErrorState } from "../ui/States";
import { Badge } from "../ui/Badge";
import { AdvertenciasCell } from "../ui/AdvertenciasCell";
import { PhotoGallery } from "../ui/PhotoGallery";
import { useToast } from "../ui/Toast";
import { useBatchGeneration } from "./useBatchGeneration";
import { BatchGenerationStatus } from "./BatchGenerationStatus";

// Panel de datos REALES de MT (Google Sheets, sin BD, sin auth). Los datos
// generales son editables antes de generar: los cambios se aplican SOLO al
// reporte generado (no se escriben de vuelta al Sheet). La generación es
// asíncrona con barra de progreso (polling del job cada 700 ms).
export function RealMtInspectionsPanel() {
  const toast = useToast();
  const [items, setItems] = useState<MtPreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<MtPreviewDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [job, setJob] = useState<{ pct: number; etapa: string } | null>(null);
  const pollRef = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const batchGen = useBatchGeneration("mt");

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => {
      return (
        String(it.idInforme || "").toLowerCase().includes(q) ||
        String(it.cliente || "").toLowerCase().includes(q) ||
        String(it.reporteN || "").toLowerCase().includes(q) ||
        String(it.sistema || "").toLowerCase().includes(q) ||
        String(it.inspector || "").toLowerCase().includes(q) ||
        String(it.fecha || "").toLowerCase().includes(q)
      );
    });
  }, [items, query]);

  function load() {
    setError(null);
    setItems(null);
    fetchRealMtInspections()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Error desconocido"));
  }

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function openDetail(idInforme: string) {
    setSelected(idInforme);
    setDetail(null);
    setDetailError(null);
    setEdits({});
    fetchRealMtInspectionDetail(idInforme)
      .then(setDetail)
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Error desconocido"));
  }

  async function handleGenerar() {
    if (!selected || job) return;
    setJob({ pct: 0, etapa: "Iniciando..." });
    try {
      const jobId = await startReportJob("mt", selected, edits);
      pollRef.current = window.setInterval(async () => {
        try {
          const status = await getJobStatus(jobId);
          if (status.estado === "RUNNING") {
            setJob({ pct: status.pct, etapa: status.etapa });
            return;
          }
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          if (status.estado === "DONE") {
            setJob({ pct: 100, etapa: "Descargando..." });
            await downloadJobResult(jobId, "mt", selected);
            toast.success("Reporte generado y descargado.");
            // Advertencias no bloqueantes (ej. inspector sin certificado de
            // esta técnica) — ver decisión reunión 2026-07-03.
            status.warnings.forEach((w) => toast.error(`⚠️ ${w}`));
          } else {
            toast.error(status.error || "Error al generar el reporte.");
          }
          setJob(null);
        } catch {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setJob(null);
          toast.error("Se perdió la conexión con el backend.");
        }
      }, 700);
    } catch (e) {
      setJob(null);
      toast.error(e instanceof PreviewApiError ? e.message : "Error al iniciar la generación.");
    }
  }

  if (items === null && !error) return <Spinner label="Cargando informes..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (items !== null && items.length === 0) {
    return (
      <EmptyState title="Sin informes" description="La hoja general no tiene id_informe con datos." />
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-6 ${selected ? "lg:grid-cols-2" : ""}`}>
      <div className="max-h-[70vh] flex flex-col rounded-xl border border-ink-200 bg-white">
        <div className="border-b border-ink-200 p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ID, cliente, sistema, inspector, fecha..."
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {batchGen.selected.size > 0 && (
          <div className="flex items-center justify-between gap-2 border-b border-brand-100 bg-brand-50 px-3 py-2">
            <span className="text-xs font-medium text-brand-700">{batchGen.selected.size} seleccionados</span>
            <button
              onClick={() => batchGen.startBatch()}
              disabled={!!batchGen.batch?.corriendo}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <Layers size={13} /> Generar seleccionados (.zip)
            </button>
          </div>
        )}
        {batchGen.batch && (
          <div className="border-b border-ink-100 p-3">
            <BatchGenerationStatus
              detalle={batchGen.batch.detalle}
              pct={batchGen.batch.pct}
              etapa={batchGen.batch.etapa}
              corriendo={batchGen.batch.corriendo}
              onClose={batchGen.closeBatch}
            />
          </div>
        )}
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500 shadow-sm">
              <tr>
                <th className="w-9 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={!!filtered?.length && filtered.every((it) => batchGen.selected.has(it.idInforme))}
                    onChange={() => batchGen.toggleSelectAll(filtered?.map((it) => it.idInforme) ?? [])}
                    className="h-3.5 w-3.5 accent-brand-600"
                  />
                </th>
                <th className="px-4 py-2.5">ID Informe</th>
                <th className="px-4 py-2.5">Cliente</th>
                <th className="px-4 py-2.5">Fecha</th>
                <th className="px-4 py-2.5">Sistema</th>
                <th className="px-4 py-2.5">Inspector</th>
                <th className="px-4 py-2.5">Estado</th>
                <th className="px-4 py-2.5">Advertencias</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered?.map((it) => (
                <tr
                  key={it.id}
                  className={`cursor-pointer hover:bg-ink-50/60 ${
                    selected === it.idInforme ? "bg-brand-50" : ""
                  }`}
                  onClick={() => openDetail(it.idInforme)}
                >
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={batchGen.selected.has(it.idInforme)}
                      onChange={() => batchGen.toggleSelect(it.idInforme)}
                      className="h-3.5 w-3.5 accent-brand-600"
                    />
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-800">{it.idInforme}</td>
                  <td className="max-w-[100px] truncate px-4 py-2.5 text-ink-600" title={it.cliente || ""}>
                    {it.cliente ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{it.fecha ?? "-"}</td>
                  <td className="max-w-[100px] truncate px-4 py-2.5 text-ink-600" title={it.sistema || ""}>
                    {it.sistema ?? "-"}
                  </td>
                  <td className="max-w-[100px] truncate px-4 py-2.5 text-ink-600" title={it.inspector || ""}>
                    {it.inspector ?? "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={it.estadoReporte === "GENERADO" ? "green" : "gray"}>
                      {it.estadoReporte === "GENERADO" ? "Generado" : "Pendiente"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <AdvertenciasCell advertencias={it.advertencias} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-400">
                    <Eye size={14} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-xl border border-ink-200 bg-white p-5">
        {!selected && (
          <p className="py-10 text-center text-sm text-ink-400">
            Selecciona un informe de la lista para ver sus datos reales.
          </p>
        )}
        {selected && !detail && !detailError && <Spinner label="Cargando detalle..." />}
        {detailError && <ErrorState message={detailError} />}
        {detail && (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-ink-900">{detail.idInforme}</p>
                <p className="text-xs text-ink-400">
                  {detail.cliente} · {detail.fecha} · {detail.reporteN}
                </p>
              </div>
              {!job && (
                <button
                  onClick={handleGenerar}
                  className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  <Download size={14} />
                  Generar reporte (.xlsx)
                </button>
              )}
            </div>

            {job && (
              <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-brand-700">
                  <span>{job.etapa}</span>
                  <span>{job.pct}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-brand-100">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-500"
                    style={{ width: `${job.pct}%` }}
                  />
                </div>
              </div>
            )}

            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-400">
              Datos generales
              <span className="flex items-center gap-1 rounded bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium normal-case text-ink-500">
                <PencilLine size={10} /> editables — solo afectan el reporte generado
              </span>
            </p>
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {Object.entries(detail.datosGenerales).map(([k, v]) => (
                <div key={k}>
                  <p className="mb-0.5 text-ink-400">{k.replace(/_/g, " ")}</p>
                  <input
                    value={edits[k] ?? (v || "")}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [k]: e.target.value }))}
                    className={`w-full rounded border px-1.5 py-1 text-xs outline-none focus:border-brand-600 ${
                      edits[k] !== undefined && edits[k] !== (v || "")
                        ? "border-amber-400 bg-amber-50"
                        : "border-ink-200"
                    }`}
                  />
                </div>
              ))}
            </div>

            <p className="mb-2 text-xs font-semibold uppercase text-ink-400">
              Resultados ({detail.resultados.length})
            </p>
            <div className="mb-4 space-y-1">
              {detail.resultados.map((r, i) => (
                <div key={i} className="rounded-lg bg-ink-50 px-3 py-2 text-xs">
                  <span className="font-medium">{r.identificacion}</span> — {r.evaluacion}
                  {r.observaciones && <span className="text-ink-500"> · {r.observaciones}</span>}
                </div>
              ))}
              {detail.resultados.length === 0 && (
                <p className="text-xs text-ink-400">Sin resultados registrados.</p>
              )}
            </div>

            <p className="mb-2 text-xs font-semibold uppercase text-ink-400">
              Fotos ({detail.fotos.length})
            </p>
            <PhotoGallery fotos={detail.fotos} />
          </div>
        )}
      </div>
    </div>
  );
}

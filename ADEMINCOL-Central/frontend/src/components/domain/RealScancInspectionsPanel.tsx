import { useEffect, useMemo, useState } from "react";
import { Download, Eye, ImageIcon, Layers } from "lucide-react";
import {
  downloadJobResult,
  fetchRealScancInspectionDetail,
  fetchRealScancInspections,
  getJobStatus,
  startReportJob,
  PreviewApiError,
  type ScancPreviewDetail,
  type ScancPreviewItem,
  type ScancVariante,
} from "../../api/previewClient";
import { Spinner, EmptyState, ErrorState } from "../ui/States";
import { Badge } from "../ui/Badge";
import { AdvertenciasCell } from "../ui/AdvertenciasCell";
import { PhotoGallery } from "../ui/PhotoGallery";
import { useToast } from "../ui/Toast";
import { useBatchGeneration } from "./useBatchGeneration";
import { BatchGenerationStatus } from "./BatchGenerationStatus";

// Panel de datos REALES de SCAN C (Ultrasonido tipo C-Scan). Un solo
// componente sirve para las 2 variantes (líneas / recipientes a presión) —
// comparten exactamente la misma forma de datos, solo cambia qué
// spreadsheet consulta el backend (ver report_engine_scanc.py). A
// diferencia de Espesores, aquí hay DOS tablas de datos (reporte de
// escaneo + información de ensayo) además de las fotos.
export function RealScancInspectionsPanel({ variante }: { variante: ScancVariante }) {
  const toast = useToast();
  const [items, setItems] = useState<ScancPreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<ScancPreviewDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [job, setJob] = useState<{ pct: number; etapa: string } | null>(null);
  const [query, setQuery] = useState("");
  const [showLoteModal, setShowLoteModal] = useState(false);
  const batchGen = useBatchGeneration(variante);

  // Cambiar de pestaña (líneas <-> RP) resetea la selección: son
  // spreadsheets distintos, un id_general de uno no existe en el otro.
  useEffect(() => {
    setSelected(null);
    setDetail(null);
  }, [variante]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      [it.idInforme, it.cliente, it.workOrderNumero, it.sistema, it.inspector, it.fecha]
        .some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [items, query]);

  function load() {
    setError(null);
    setItems(null);
    fetchRealScancInspections(variante)
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Error desconocido"));
  }

  useEffect(load, [variante]);

  function openDetail(idGeneral: string) {
    setSelected(idGeneral);
    setDetail(null);
    setDetailError(null);
    fetchRealScancInspectionDetail(variante, idGeneral)
      .then(setDetail)
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Error desconocido"));
  }

  async function handleGenerar() {
    if (!selected || job) return;
    setJob({ pct: 0, etapa: "Iniciando..." });
    try {
      const jobId = await startReportJob(variante, selected, {});
      const poll = window.setInterval(async () => {
        try {
          const status = await getJobStatus(jobId);
          if (status.estado === "RUNNING") {
            setJob({ pct: status.pct, etapa: status.etapa });
            return;
          }
          window.clearInterval(poll);
          if (status.estado === "DONE") {
            setJob({ pct: 100, etapa: "Descargando..." });
            await downloadJobResult(jobId, variante, selected);
            toast.success("Reporte generado y descargado.");
            status.warnings.forEach((w) => toast.error(`⚠️ ${w}`));
          } else {
            toast.error(status.error || "Error al generar el reporte.");
          }
          setJob(null);
        } catch {
          window.clearInterval(poll);
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
    return <EmptyState title="Sin informes" description="La hoja 1.0_general no tiene id_general con datos." />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="max-h-[70vh] flex flex-col rounded-xl border border-ink-200 bg-white">
        <div className="border-b border-ink-200 p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por ID, cliente, OT, sistema, fecha..."
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
        {batchGen.selected.size > 0 && (
          <div className="flex items-center justify-between gap-2 border-b border-brand-100 bg-brand-50 px-3 py-2">
            <span className="text-xs font-medium text-brand-700">{batchGen.selected.size} seleccionados</span>
            <button
              onClick={() => setShowLoteModal(true)}
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
                  <td className="max-w-[120px] truncate px-4 py-2.5 text-ink-600" title={it.cliente ?? ""}>
                    {it.cliente ?? "-"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{it.fecha ?? "-"}</td>
                  <td className="px-4 py-2.5 max-w-[140px] truncate text-ink-600" title={it.sistema ?? ""}>
                    {it.sistema ?? "-"}
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
                  {detail.cliente} · {detail.fecha || "sin fecha"} · {detail.workOrderNumero || "sin OT"}
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

            <p className="mb-2 text-xs font-semibold uppercase text-ink-400">Datos generales</p>
            <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {Object.entries(detail.datosGenerales)
                .filter(([k, v]) => v && !["firma", "link_firma", "link_reporte", "id_general"].includes(k))
                .map(([k, v]) => (
                  <div key={k}>
                    <p className="text-ink-400">{k.replace(/_/g, " ")}</p>
                    <p className="truncate font-medium text-ink-700" title={String(v)}>{String(v)}</p>
                  </div>
                ))}
            </div>

            <p className="mb-2 text-xs font-semibold uppercase text-ink-400">
              Reporte de escaneo ({detail.totalReporteDatos})
            </p>
            {detail.reporteDatos.length === 0 ? (
              <p className="mb-4 text-xs text-ink-400">Sin puntos registrados.</p>
            ) : (
              <div className="mb-4 overflow-x-auto rounded-lg border border-ink-100">
                <table className="w-full text-[11px]">
                  <thead className="bg-ink-50 text-left uppercase text-ink-400">
                    <tr>
                      <th className="px-2 py-1.5">ID</th>
                      <th className="px-2 py-1.5">CML</th>
                      <th className="px-2 py-1.5">Ø (in)</th>
                      <th className="px-2 py-1.5">Espesor nom.</th>
                      <th className="px-2 py-1.5">Espesor prom.</th>
                      <th className="px-2 py-1.5">Espesor mín.</th>
                      <th className="px-2 py-1.5">% pérdida (mín)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {detail.reporteDatos.map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 text-ink-700">{r.id_punto}</td>
                        <td className="px-2 py-1 text-ink-600">{r.cml}</td>
                        <td className="px-2 py-1 text-ink-600">{r.diametro_in}</td>
                        <td className="px-2 py-1 text-ink-600">{r.espesor_nominal_mm}</td>
                        <td className="px-2 py-1 text-ink-600">{r.espesor_promedio_mm}</td>
                        <td className="px-2 py-1 text-ink-600">{r.espesor_minimo_mm}</td>
                        <td className="px-2 py-1 text-ink-600">{r.perdida_basada_en_minimo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mb-2 text-xs font-semibold uppercase text-ink-400">
              Información de ensayo ({detail.totalEnsayoDatos})
            </p>
            {detail.ensayoDatos.length === 0 ? (
              <p className="mb-4 text-xs text-ink-400">Sin anomalías registradas.</p>
            ) : (
              <div className="mb-4 overflow-x-auto rounded-lg border border-ink-100">
                <table className="w-full text-[11px]">
                  <thead className="bg-ink-50 text-left uppercase text-ink-400">
                    <tr>
                      <th className="px-2 py-1.5">ID</th>
                      <th className="px-2 py-1.5">CML</th>
                      <th className="px-2 py-1.5">Tipo anomalía</th>
                      <th className="px-2 py-1.5">% pérdida</th>
                      <th className="px-2 py-1.5">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {detail.ensayoDatos.map((r, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 text-ink-700">{r.id_punto}</td>
                        <td className="px-2 py-1 text-ink-600">{r.cml}</td>
                        <td className="px-2 py-1 text-ink-600">{r.tipo_anomalia}</td>
                        <td className="px-2 py-1 text-ink-600">{r.porcentaje_perdida}</td>
                        <td className="max-w-[160px] truncate px-2 py-1 text-ink-600" title={r.observaciones}>
                          {r.observaciones}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-400">
              <ImageIcon size={12} /> Fotos ({detail.totalFotos})
            </p>
            <PhotoGallery fotos={detail.fotos.map((f) => ({ url: f.url, descripcion: f.descripcion }))} />
          </div>
        )}
      </div>

      {showLoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-2xl">
            <h2 className="mb-2 text-lg font-bold text-ink-900">
              Generar {batchGen.selected.size} reportes
            </h2>
            <p className="mb-4 text-sm text-ink-500">
              Se generarán todos los reportes seleccionados y se descargarán juntos en un .zip.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowLoteModal(false)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowLoteModal(false);
                  batchGen.startBatch({});
                }}
                className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Layers size={14} />
                Generar lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, ImageIcon, Layers, Loader2, PencilLine, Signature, X } from "lucide-react";
import {
  downloadJobResult,
  fetchRealEspesoresInspectionDetail,
  fetchRealEspesoresInspections,
  fetchRealUsers,
  getJobStatus,
  startReportJob,
  PreviewApiError,
  type EspesoresPreviewDetail,
  type EspesoresPreviewItem,
  type RealUser,
} from "../../api/previewClient";
import { Spinner, EmptyState, ErrorState } from "../ui/States";
import { Badge } from "../ui/Badge";
import { AdvertenciasCell } from "../ui/AdvertenciasCell";
import { PhotoGallery } from "../ui/PhotoGallery";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { useBatchGeneration } from "./useBatchGeneration";
import { BatchGenerationStatus } from "./BatchGenerationStatus";

// Panel de datos REALES de Medición de Espesores (UT). A diferencia de
// 570/510 no hay secciones — UNA sola tabla de lecturas + fotos, así que el
// detalle sí puede mostrar la tabla completa (como MT/PMI) en vez de un
// resumen por sección. Igual que PMI: firma de "Revisado por" automática
// (usuario autenticado) o manual para un lote completo.
export function RealEspesoresInspectionsPanel() {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<EspesoresPreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<EspesoresPreviewDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [job, setJob] = useState<{ pct: number; etapa: string } | null>(null);
  const pollRef = useRef<number | null>(null);
  const [query, setQuery] = useState("");
  const [showLoteModal, setShowLoteModal] = useState(false);
  const batchGen = useBatchGeneration("espesores");

  // Bloques "Revisado por" (P40-44) y "Aprobado por" (AC40-44) — pedido
  // explícito del usuario 2026-07-14: libertad de elegir, entre los usuarios
  // registrados en la plataforma, quién revisa y quién aprueba cada
  // reporte (antes "Revisado por" quedaba fijo en el usuario autenticado).
  const [usuarios, setUsuarios] = useState<RealUser[]>([]);
  const [revisorUsuario, setRevisorUsuario] = useState("");
  const [aprobadorUsuario, setAprobadorUsuario] = useState("");
  useEffect(() => {
    fetchRealUsers()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);
  useEffect(() => {
    if (user?.usuario && !revisorUsuario) setRevisorUsuario(user.usuario);
  }, [user, revisorUsuario]);

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
    fetchRealEspesoresInspections()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Error desconocido"));
  }

  useEffect(() => {
    load();
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  function openDetail(idGeneral: string) {
    setSelected(idGeneral);
    setDetail(null);
    setDetailError(null);
    setEdits({});
    fetchRealEspesoresInspectionDetail(idGeneral)
      .then(setDetail)
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Error desconocido"));
  }

  async function handleGenerar() {
    if (!selected || job) return;
    setJob({ pct: 0, etapa: "Iniciando..." });
    try {
      const jobId = await startReportJob("espesores", selected, {
        ...edits,
        supervisor_usuario: revisorUsuario || user?.usuario || "",
        aprobador_usuario: aprobadorUsuario,
      });
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
            await downloadJobResult(jobId, "espesores", selected);
            toast.success("Reporte generado y descargado.");
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
    return <EmptyState title="Sin informes" description="La hoja 1_general no tiene id_general con datos." />;
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
                <div className="flex shrink-0 items-end gap-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-ink-500">Revisor</span>
                    <select
                      value={revisorUsuario}
                      onChange={(e) => setRevisorUsuario(e.target.value)}
                      className="rounded-lg border border-ink-200 px-2 py-1.5 text-xs outline-none focus:border-brand-600"
                    >
                      <option value="">— Ninguno —</option>
                      {usuarios.map((u) => (
                        <option key={u.usuario} value={u.usuario}>
                          {u.nombre}
                          {u.usuario === user?.usuario ? " (tú)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-ink-500">Aprobador</span>
                    <select
                      value={aprobadorUsuario}
                      onChange={(e) => setAprobadorUsuario(e.target.value)}
                      className="rounded-lg border border-ink-200 px-2 py-1.5 text-xs outline-none focus:border-brand-600"
                    >
                      <option value="">— Ninguno —</option>
                      {usuarios.map((u) => (
                        <option key={u.usuario} value={u.usuario}>
                          {u.nombre}
                          {u.usuario === user?.usuario ? " (tú)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={handleGenerar}
                    className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    <Download size={14} />
                    Generar reporte (.xlsx)
                  </button>
                </div>
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
                    value={edits[k] ?? (v != null ? String(v) : "")}
                    onChange={(e) => setEdits((prev) => ({ ...prev, [k]: e.target.value }))}
                    className={`w-full rounded border px-1.5 py-1 text-xs outline-none focus:border-brand-600 ${
                      edits[k] !== undefined && edits[k] !== (v != null ? String(v) : "")
                        ? "border-amber-400 bg-amber-50"
                        : "border-ink-200"
                    }`}
                  />
                </div>
              ))}
            </div>

            <p className="mb-2 text-xs font-semibold uppercase text-ink-400">
              Lecturas ({detail.totalLecturas})
            </p>
            {detail.lecturas.length === 0 ? (
              <p className="mb-4 text-xs text-ink-400">Sin lecturas registradas.</p>
            ) : (
              <div className="mb-4 overflow-x-auto rounded-lg border border-ink-100">
                <table className="w-full text-[11px]">
                  <thead className="bg-ink-50 text-left uppercase text-ink-400">
                    <tr>
                      <th className="px-2 py-1.5">Item</th>
                      <th className="px-2 py-1.5">Componente</th>
                      <th className="px-2 py-1.5">CML</th>
                      <th className="px-2 py-1.5">Ø</th>
                      <th className="px-2 py-1.5">t Nom</th>
                      <th className="px-2 py-1.5">Med. 1</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {detail.lecturas.map((l, i) => (
                      <tr key={i}>
                        <td className="px-2 py-1 text-ink-700">{l.item}</td>
                        <td className="px-2 py-1 text-ink-600">{l.componente}</td>
                        <td className="px-2 py-1 text-ink-600">{l.cml}</td>
                        <td className="px-2 py-1 text-ink-600">{l.diametro}</td>
                        <td className="px-2 py-1 text-ink-600">{l.t_nominal}</td>
                        <td className="px-2 py-1 text-ink-600">{l.med1}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-400">
              <ImageIcon size={12} /> Fotos ({detail.totalFotos})
            </p>
            <PhotoGallery fotos={detail.fotos} />
          </div>
        )}
      </div>

      {showLoteModal && (
        <ConfigurarLoteModal
          cantidad={batchGen.selected.size}
          nombreUsuario={user?.usuario ?? ""}
          onClose={() => setShowLoteModal(false)}
          onConfirmar={(overrides) => {
            setShowLoteModal(false);
            batchGen.startBatch(overrides);
          }}
        />
      )}
    </div>
  );
}

// Modal para aplicar la MISMA firma/nombre/cargo (bloque "Revisado por") a
// todos los reportes de un lote — mismo patrón ya establecido en PMI
// (decisión 2026-07-08). Si se deja en blanco, cada reporte usa la firma
// del usuario autenticado (comportamiento individual de siempre).
function ConfigurarLoteModal({
  cantidad,
  nombreUsuario,
  onClose,
  onConfirmar,
}: {
  cantidad: number;
  nombreUsuario: string;
  onClose: () => void;
  onConfirmar: (overrides: Record<string, string>) => void;
}) {
  const toast = useToast();
  const [nombre, setNombre] = useState("");
  const [cargo, setCargo] = useState("");
  const [firmaBase64, setFirmaBase64] = useState<string | null>(null);
  const [firmaNombreArchivo, setFirmaNombreArchivo] = useState<string | null>(null);
  const [loadingFirma, setLoadingFirma] = useState(false);

  function handleFirmaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoadingFirma(true);
    const reader = new FileReader();
    reader.onload = () => {
      setFirmaBase64(reader.result as string);
      setFirmaNombreArchivo(file.name);
      setLoadingFirma(false);
    };
    reader.onerror = () => {
      toast.error("No se pudo leer la imagen.");
      setLoadingFirma(false);
    };
    reader.readAsDataURL(file);
  }

  function handleConfirmar() {
    const overrides: Record<string, string> = { supervisor_usuario: nombreUsuario };
    if (nombre.trim()) overrides.supervisor_nombre_manual = nombre.trim();
    if (cargo.trim()) overrides.supervisor_cargo_manual = cargo.trim();
    if (firmaBase64) overrides.supervisor_firma_manual = firmaBase64;
    onConfirmar(overrides);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Generar {cantidad} reportes</h2>
            <p className="text-sm text-ink-500">
              Firma/nombre/cargo para el bloque "Revisado por" — se aplica a todos
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <p className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-500">
            Déjalo en blanco para usar tu propia firma de perfil en cada reporte, o llénalo
            para que TODOS los reportes del lote queden firmados con estos mismos datos.
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Nombre</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Diego Alejandro Hernández"
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Cargo</label>
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Ej: Coordinador QA"
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Firma (imagen)</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 px-4 py-3 text-sm text-ink-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700">
              {loadingFirma ? <Loader2 size={16} className="animate-spin" /> : <Signature size={16} />}
              {firmaNombreArchivo ? firmaNombreArchivo : "Subir imagen de firma"}
              <input type="file" accept="image/*" onChange={handleFirmaChange} className="hidden" />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-ink-100 bg-ink-50 p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Layers size={14} />
            Generar lote
          </button>
        </div>
      </div>
    </div>
  );
}

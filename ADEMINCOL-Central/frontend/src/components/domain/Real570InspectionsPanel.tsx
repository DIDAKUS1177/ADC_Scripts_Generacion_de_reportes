import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Eye, ImageIcon, Layers, PencilLine, X } from "lucide-react";
import {
  fetchReal570InspectionDetail,
  fetchReal570Inspections,
  fetchRealUsers,
  startReportJob,
  PreviewApiError,
  type RealUser,
  type Sh570PreviewDetail,
  type Sh570PreviewItem,
} from "../../api/previewClient";
import { Spinner, EmptyState, ErrorState } from "../ui/States";
import { Badge } from "../ui/Badge";
import { AdvertenciasCell } from "../ui/AdvertenciasCell";
import { useToast } from "../ui/Toast";
import { useAuth } from "../../context/AuthContext";
import { useJobs } from "../../context/JobsContext";
import { useBatchGeneration } from "./useBatchGeneration";
import { BatchGenerationStatus } from "./BatchGenerationStatus";
import { FotosPorSeccion } from "./FotosPorSeccion";
import { FirmaSelector, type FirmaSelectorHandle } from "./FirmaSelector";

// Panel de datos REALES de API 570 (Inspección Visual de Tubería). A
// diferencia de MT/PMI, el reporte tiene 15 secciones independientes con
// cientos de registros/fotos posibles — en vez de mostrar cada sección
// completa en el visualizador (poco práctico), se muestra un resumen de
// conteos por sección. Los datos generales sí son editables, igual que en
// MT/PMI. `ot` es texto libre (no requiere OT creada en la plataforma).
export function Real570InspectionsPanel() {
  const toast = useToast();
  const { user } = useAuth();
  const { startJob } = useJobs();
  const [items, setItems] = useState<Sh570PreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Sh570PreviewDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const batchGen = useBatchGeneration("570");
  const [showLoteModal, setShowLoteModal] = useState(false);

  // Bloques "Revisado por" (Y165-169) y "Aprobado por" (AN165-169) — pedido
  // explícito del usuario 2026-07-14: libertad de elegir, entre los usuarios
  // registrados en la plataforma, quién revisa y quién aprueba cada
  // reporte. Vacío = no se llena ese bloque en el .xlsx. 2026-07-16: además
  // del selector, libertad de colocar nombre/cargo/certificado/firma
  // manualmente (ver FirmaSelector) — ambas vías conviven, no una en vez
  // de la otra.
  const [usuarios, setUsuarios] = useState<RealUser[]>([]);
  const revisorRef = useRef<FirmaSelectorHandle>(null);
  const aprobadorRef = useRef<FirmaSelectorHandle>(null);
  useEffect(() => {
    fetchRealUsers()
      .then(setUsuarios)
      .catch(() => setUsuarios([]));
  }, []);

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
    fetchReal570Inspections()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Error desconocido"));
  }

  useEffect(() => {
    load();
  }, []);

  function openDetail(idApi570: string) {
    setSelected(idApi570);
    setDetail(null);
    setDetailError(null);
    setEdits({});
    fetchReal570InspectionDetail(idApi570)
      .then(setDetail)
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Error desconocido"));
  }

  async function handleGenerar() {
    if (!selected) return;
    const idInforme = selected;
    try {
      const jobId = await startReportJob("570", idInforme, {
        ...edits,
        ...(revisorRef.current?.getOverrides() ?? {}),
        ...(aprobadorRef.current?.getOverrides() ?? {}),
      });
      // El seguimiento vive en JobsContext (widget flotante global) para
      // que siga corriendo aunque el usuario cambie de página — pedido
      // 2026-07-16: "si cambio de pestaña, ¿hay manera que no pare de
      // generarse?". La generación en sí ya corría en el backend sin
      // detenerse; lo que se perdía era este seguimiento local.
      startJob(jobId, "570", idInforme, `570 · ${idInforme}`);
      toast.success("Generación iniciada — sigue el progreso en la esquina inferior izquierda.");
    } catch (e) {
      toast.error(e instanceof PreviewApiError ? e.message : "Error al iniciar la generación.");
    }
  }

  if (items === null && !error) return <Spinner label="Cargando informes..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (items !== null && items.length === 0) {
    return (
      <EmptyState title="Sin informes" description="La hoja #1_informaciongeneral no tiene id_api570 con datos." />
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-6 ${selected ? "lg:grid-cols-2" : ""}`}>
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
                <th className="px-4 py-2.5">OT</th>
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
                  <td className="px-4 py-2.5 max-w-[140px] truncate text-ink-600" title={it.workOrderNumero ?? ""}>
                    {it.workOrderNumero ?? "-"}
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
        {selected && !detail && !detailError && <Spinner label="Cargando detalle (15 secciones)..." />}
        {detailError && <ErrorState message={detailError} />}
        {detail && (
          <div>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-ink-900">{detail.idInforme}</p>
                <p className="text-xs text-ink-400">
                  {detail.cliente} · {detail.fecha || "sin fecha"} · OT: {detail.workOrderNumero || "sin OT"}
                </p>
              </div>
              <div className="flex shrink-0 items-start gap-2">
                <FirmaSelector
                  ref={revisorRef}
                  label="Revisor"
                  prefijo="revisor"
                  usuarios={usuarios}
                  usuarioActual={user?.usuario}
                  defaultUsuario={user?.usuario}
                />
                <FirmaSelector
                  ref={aprobadorRef}
                  label="Aprobador"
                  prefijo="aprobador"
                  usuarios={usuarios}
                  usuarioActual={user?.usuario}
                />
                <button
                  onClick={handleGenerar}
                  className="mt-[19px] flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
                >
                  <Download size={14} />
                  Generar reporte (.xlsx)
                </button>
              </div>
            </div>

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

            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-400">
              <ImageIcon size={12} /> Secciones ({detail.secciones.filter((s) => s.registros > 0).length} con datos · {detail.totalFotos} fotos totales)
            </p>
            <div className="space-y-1">
              {detail.secciones.map((s) => (
                <div
                  key={s.key}
                  className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-xs ${
                    s.registros > 0 ? "bg-ink-50" : "bg-ink-50/40 text-ink-400"
                  }`}
                >
                  <span className="font-medium">{s.sheet.replace(/^#\d+_/, "").replace(/_/g, " ")}</span>
                  <span>
                    {s.registros} registro{s.registros !== 1 ? "s" : ""} · {s.fotos} foto{s.fotos !== 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>

            <p className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-semibold uppercase text-ink-400">
              <ImageIcon size={12} /> Fotos ({detail.totalFotos})
            </p>
            <FotosPorSeccion fotos={detail.fotos} />
          </div>
        )}
      </div>

      {showLoteModal && (
        <ConfigurarLoteModal570
          cantidad={batchGen.selected.size}
          nombreUsuario={user?.usuario ?? ""}
          usuarios={usuarios}
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

// Modal para elegir revisor/aprobador (bloques Y165-169/AN165-169) aplicados
// a TODOS los reportes de un lote — el flujo individual ya tenía estos
// selects (arriba), pero "Generar seleccionados (.zip)" no tenía forma de
// elegirlos (pedido del usuario 2026-07-16: "no me da la opción de colocar
// las firmas... de quién revisó y quién aprobó" — se refería al lote).
function ConfigurarLoteModal570({
  cantidad,
  nombreUsuario,
  usuarios,
  onClose,
  onConfirmar,
}: {
  cantidad: number;
  nombreUsuario: string;
  usuarios: RealUser[];
  onClose: () => void;
  onConfirmar: (overrides: Record<string, string>) => void;
}) {
  const revisorRef = useRef<FirmaSelectorHandle>(null);
  const aprobadorRef = useRef<FirmaSelectorHandle>(null);

  function handleConfirmar() {
    onConfirmar({
      ...(revisorRef.current?.getOverrides() ?? {}),
      ...(aprobadorRef.current?.getOverrides() ?? {}),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Generar {cantidad} reportes</h2>
            <p className="text-sm text-ink-500">Revisor y aprobador — se aplica a todos</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <FirmaSelector
            ref={revisorRef}
            label="Revisor"
            prefijo="revisor"
            usuarios={usuarios}
            usuarioActual={nombreUsuario}
            defaultUsuario={nombreUsuario}
            className="w-full"
          />
          <FirmaSelector
            ref={aprobadorRef}
            label="Aprobador"
            prefijo="aprobador"
            usuarios={usuarios}
            usuarioActual={nombreUsuario}
            className="w-full"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-ink-100 p-4">
          <button
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-xs font-semibold text-ink-500 hover:bg-ink-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmar}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-700"
          >
            <Download size={14} />
            Generar lote
          </button>
        </div>
      </div>
    </div>
  );
}

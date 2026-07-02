import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, RadioTower } from "lucide-react";
import {
  fetchRealMtInspectionDetail,
  fetchRealMtInspections,
  type MtPreviewDetail,
  type MtPreviewItem,
} from "../api/previewClient";
import { Spinner, EmptyState, ErrorState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";

// Página temporal: prueba en vivo de la conexión real a Google Sheets (sin BD,
// sin auth). Se retira cuando la Fase 3 (sync a PostgreSQL) esté lista y las
// pantallas normales (InspectionsPage) consuman datos reales vía el backend
// completo en vez de este preview directo.
export function RealMtPreviewPage() {
  const [items, setItems] = useState<MtPreviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<MtPreviewDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  function load() {
    setError(null);
    setItems(null);
    fetchRealMtInspections()
      .then(setItems)
      .catch((e) => setError(e instanceof Error ? e.message : "Error desconocido"));
  }

  useEffect(load, []);

  function openDetail(idInforme: string) {
    setSelected(idInforme);
    setDetail(null);
    setDetailError(null);
    fetchRealMtInspectionDetail(idInforme)
      .then(setDetail)
      .catch((e) => setDetailError(e instanceof Error ? e.message : "Error desconocido"));
  }

  return (
    <div>
      <Link
        to="/inspecciones"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-brand-600"
      >
        <ArrowLeft size={15} /> Volver a inspecciones
      </Link>

      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <RadioTower size={18} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Datos reales — Google Sheets (MT)</h1>
          <p className="text-sm text-ink-500">
            Lectura en vivo del spreadsheet de Partículas Magnéticas. Sin base de datos, sin
            caché — cada carga consulta el Sheet directamente.
          </p>
        </div>
      </div>

      {items === null && !error && <Spinner label="Consultando Google Sheets..." />}
      {error && (
        <ErrorState
          message={error}
          onRetry={load}
        />
      )}
      {items !== null && items.length === 0 && (
        <EmptyState title="Sin informes" description="La hoja general no tiene id_informe con datos." />
      )}

      {items !== null && items.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-2.5">ID Informe</th>
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">Reporte N°</th>
                  <th className="px-4 py-2.5">Estado</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {items.map((it) => (
                  <tr
                    key={it.id}
                    className={`cursor-pointer hover:bg-ink-50/60 ${
                      selected === it.idInforme ? "bg-brand-50" : ""
                    }`}
                    onClick={() => openDetail(it.idInforme)}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs text-ink-800">{it.idInforme}</td>
                    <td className="px-4 py-2.5 text-ink-600">{it.cliente ?? "-"}</td>
                    <td className="px-4 py-2.5 text-ink-600">{it.reporteN ?? "-"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={it.estadoReporte === "GENERADO" ? "green" : "gray"}>
                        {it.estadoReporte === "GENERADO" ? "Generado" : "Pendiente"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-400">
                      <Eye size={14} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-ink-200 bg-white p-5">
            {!selected && (
              <p className="py-10 text-center text-sm text-ink-400">
                Selecciona un informe de la lista para ver sus datos reales.
              </p>
            )}
            {selected && !detail && !detailError && <Spinner label="Cargando detalle..." />}
            {detailError && <ErrorState message={detailError} />}
            {detail && (
              <div>
                <p className="mb-1 font-mono text-sm font-bold text-ink-900">{detail.idInforme}</p>
                <p className="mb-4 text-xs text-ink-400">
                  {detail.cliente} · {detail.fecha} · {detail.reporteN}
                </p>

                <p className="mb-2 text-xs font-semibold uppercase text-ink-400">Datos generales</p>
                <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {Object.entries(detail.datosGenerales).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-ink-400">{k.replace(/_/g, " ")}</p>
                      <p className="truncate text-ink-800">{v || "—"}</p>
                    </div>
                  ))}
                </div>

                <p className="mb-2 text-xs font-semibold uppercase text-ink-400">
                  Resultados ({detail.resultados.length})
                </p>
                <div className="space-y-1">
                  {detail.resultados.map((r, i) => (
                    <div key={i} className="rounded-lg bg-ink-50 px-3 py-2 text-xs">
                      <span className="font-medium">{r.identificacion}</span> — {r.evaluacion}
                      {r.observaciones && (
                        <span className="text-ink-500"> · {r.observaciones}</span>
                      )}
                    </div>
                  ))}
                  {detail.resultados.length === 0 && (
                    <p className="text-xs text-ink-400">Sin resultados registrados.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

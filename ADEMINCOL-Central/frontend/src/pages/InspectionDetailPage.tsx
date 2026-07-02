import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, ImageIcon } from "lucide-react";
import { fetchInspectionDetail } from "../mock/client";
import type { InspectionDetail } from "../types";
import { Spinner, ErrorState } from "../components/ui/States";
import { ReportStatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/Toast";

export function InspectionDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"generales" | "resultados" | "indicaciones" | "fotos" | "historial">(
    "generales"
  );

  function load() {
    if (!id) return;
    setError(null);
    setDetail(null);
    fetchInspectionDetail(Number(id))
      .then(setDetail)
      .catch(() => setError("No se pudo cargar el detalle de la inspección."));
  }

  useEffect(load, [id]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <Spinner label="Cargando inspección..." />;

  const tabs = [
    { key: "generales" as const, label: "Datos generales" },
    { key: "resultados" as const, label: `Resultados (${detail.resultados.length})` },
    { key: "indicaciones" as const, label: `Indicaciones (${detail.indicaciones.length})` },
    { key: "fotos" as const, label: `Fotos (${detail.fotos.length})` },
    { key: "historial" as const, label: `Historial (${detail.historialReportes.length})` },
  ];

  return (
    <div>
      <Link
        to="/inspecciones"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-brand-600"
      >
        <ArrowLeft size={15} /> Volver a inspecciones
      </Link>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-ink-900">{detail.idInforme}</h1>
          <p className="text-sm text-ink-500">
            {detail.reportType} · {detail.cliente} · {detail.fecha}
          </p>
        </div>
        <ReportStatusBadge status={detail.estadoReporte} />
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b border-ink-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "generales" && (
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-xl border border-ink-200 bg-white p-6 sm:grid-cols-2">
          {Object.entries(detail.datosGenerales).map(([key, value]) => (
            <div key={key}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                {key.replace(/_/g, " ")}
              </p>
              <p className="text-sm text-ink-800">{value ?? "-"}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "resultados" && (
        <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
              <tr>
                <th className="px-4 py-2.5">Item</th>
                <th className="px-4 py-2.5">Identificación</th>
                <th className="px-4 py-2.5">Evaluación</th>
                <th className="px-4 py-2.5">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {detail.resultados.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5">{r.item}</td>
                  <td className="px-4 py-2.5 font-mono">{r.identificacion}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        r.evaluacion === "ACEPTADO"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-brand-100 text-brand-700"
                      }`}
                    >
                      {r.evaluacion}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{r.observaciones}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "indicaciones" &&
        (detail.indicaciones.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-400">
            Sin indicaciones registradas.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
                <tr>
                  <th className="px-4 py-2.5">Resultado</th>
                  <th className="px-4 py-2.5">Tipo</th>
                  <th className="px-4 py-2.5">Longitud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {detail.indicaciones.map((ind, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2.5">{ind.id_resultado}</td>
                    <td className="px-4 py-2.5">{ind.tipo}</td>
                    <td className="px-4 py-2.5">{ind.long}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "fotos" && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {detail.fotos.map((foto, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-ink-200 bg-white">
              <img src={foto.url} alt={foto.descripcion} className="h-32 w-full object-cover" />
              <p className="flex items-center gap-1 px-3 py-2 text-xs text-ink-600">
                <ImageIcon size={12} /> {foto.descripcion}
              </p>
            </div>
          ))}
        </div>
      )}

      {tab === "historial" &&
        (detail.historialReportes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink-200 bg-white p-8 text-center text-sm text-ink-400">
            Aún no se ha generado ningún reporte para esta inspección.
          </p>
        ) : (
          <div className="space-y-2">
            {detail.historialReportes.map((rep) => (
              <div
                key={rep.id}
                className="flex items-center justify-between rounded-xl border border-ink-200 bg-white p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-800">{rep.fileName}</p>
                    <p className="text-xs text-ink-400">
                      Generado por {rep.generadoPor} · {new Date(rep.createdAt).toLocaleString("es-CO")}{" "}
                      · {rep.sizeKb} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toast.success("Descarga simulada iniciada.")}
                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-100 hover:text-brand-600"
                >
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

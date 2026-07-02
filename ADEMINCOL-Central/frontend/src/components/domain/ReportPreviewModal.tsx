import { X, PenLine } from "lucide-react";
import type { InspectionDetail } from "../../types";

// Maqueta visual del layout del reporte MT (ver ADEMINCOL-Central/docs/04_GENERACION_REPORTES.md,
// sección MT_CONFIG). NO es el Excel real — es una aproximación en HTML para validar el
// contenido y la disposición antes de construir el motor openpyxl (Fase 4).
export function ReportPreviewModal({
  detail,
  onClose,
}: {
  detail: InspectionDetail;
  onClose: () => void;
}) {
  const g = detail.datosGenerales;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-3">
          <div>
            <p className="text-sm font-bold text-ink-900">Vista previa del reporte</p>
            <p className="text-xs text-ink-400">
              Maqueta aproximada — el Excel real se genera en la Fase 4 con openpyxl
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6">
          {/* Hoja simulada */}
          <div className="mx-auto max-w-2xl border border-ink-300 bg-white text-[11px] leading-tight text-ink-800 shadow-sm">
            {/* Encabezado */}
            <div className="flex items-center justify-between border-b-2 border-ink-900 px-4 py-3">
              <span className="text-sm font-extrabold italic">ADEMINCOL</span>
              <span className="text-center text-xs font-bold">
                REPORTE DE INSPECCIÓN
                <br />
                PARTÍCULAS MAGNÉTICAS (MT)
              </span>
              <span className="text-right text-[10px]">
                N° {detail.reporteN ?? "—"}
                <br />
                {detail.fecha}
              </span>
            </div>

            {/* Datos generales — grid tipo celdas de Excel */}
            <div className="grid grid-cols-4 border-b border-ink-300 text-[10px]">
              <PreviewCell label="Cliente" value={g.cliente} span={2} />
              <PreviewCell label="Contrato" value={g.contrato} span={2} />
              <PreviewCell label="OT" value={g.ot} />
              <PreviewCell label="Fecha actividad" value={g.fecha_actividad} />
              <PreviewCell label="Zona" value={g.zona} span={2} />
              <PreviewCell label="Sistema" value={g.sistema} />
              <PreviewCell label="Material" value={g.material} />
              <PreviewCell label="Espesor" value={g.espesor} />
              <PreviewCell label="Diámetro" value={g.diametro} />
              <PreviewCell label="Procedimiento N°" value={g.procedimiento_n} />
              <PreviewCell label="Técnica magnetización" value={g.tecnica_magnetizacion} span={3} />
            </div>

            {/* Tabla de resultados */}
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-ink-100">
                  <th className="border border-ink-300 px-2 py-1">Item</th>
                  <th className="border border-ink-300 px-2 py-1">Identificación</th>
                  <th className="border border-ink-300 px-2 py-1">Indicaciones</th>
                  <th className="border border-ink-300 px-2 py-1">Evaluación</th>
                  <th className="border border-ink-300 px-2 py-1">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {detail.resultados.map((r, i) => {
                  const inds = detail.indicaciones.filter(
                    (ind) => ind.id_resultado === r.item || String(ind.id_resultado) === String(r.item)
                  );
                  return (
                    <tr key={i}>
                      <td className="border border-ink-300 px-2 py-1 text-center">{r.item}</td>
                      <td className="border border-ink-300 px-2 py-1 font-mono">{r.identificacion}</td>
                      <td className="border border-ink-300 px-2 py-1">
                        {inds.length
                          ? inds.map((ind, j) => (
                              <span key={j}>
                                {ind.tipo} ({ind.long})
                                {j < inds.length - 1 ? ", " : ""}
                              </span>
                            ))
                          : "—"}
                      </td>
                      <td
                        className={`border border-ink-300 px-2 py-1 text-center font-semibold ${
                          r.evaluacion === "ACEPTADO" ? "text-emerald-700" : "text-brand-700"
                        }`}
                      >
                        {r.evaluacion}
                      </td>
                      <td className="border border-ink-300 px-2 py-1">{r.observaciones}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Fotos */}
            {detail.fotos.length > 0 && (
              <div className="border-t border-ink-300 p-3">
                <p className="mb-2 text-[10px] font-bold uppercase">Registro fotográfico</p>
                <div className="grid grid-cols-2 gap-2">
                  {detail.fotos.map((foto, i) => (
                    <div key={i} className="border border-ink-300 p-1 text-center">
                      <img src={foto.url} alt={foto.descripcion} className="mx-auto h-20 w-full object-cover" />
                      <p className="mt-1 text-[9px] text-ink-600">{foto.descripcion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Firma */}
            <div className="flex items-center gap-4 border-t border-ink-300 p-3">
              <div className="flex h-14 w-28 items-center justify-center border border-dashed border-ink-300 text-ink-300">
                <PenLine size={16} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-ink-800">{g.inspector ?? "—"}</p>
                <p className="text-[9px] text-ink-500">Inspector responsable</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewCell({
  label,
  value,
  span = 1,
}: {
  label: string;
  value: string | number | null | undefined;
  span?: number;
}) {
  return (
    <div
      className="border-b border-r border-ink-200 px-2 py-1.5"
      style={{ gridColumn: `span ${span} / span ${span}` }}
    >
      <p className="text-[8px] font-semibold uppercase text-ink-400">{label}</p>
      <p className="truncate text-ink-800">{value ?? "—"}</p>
    </div>
  );
}

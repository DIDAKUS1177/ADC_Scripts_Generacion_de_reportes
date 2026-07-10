import { AlertTriangle } from "lucide-react";

// Columna "Advertencias" en las tablas de listado de informes (2026-07-10,
// pedido explícito: "en la tabla de reporte y generar debe salir una
// columna con advertencias de que ese inspector tiene un certificado
// vencido o de hecho no tiene certificado, y que los equipos no están
// actualizados"). Antes esta señal (`_advertencias_generacion` en el
// backend) solo se veía como toast DESPUÉS de generar el reporte.
export function AdvertenciasCell({ advertencias }: { advertencias: string[] }) {
  if (!advertencias || advertencias.length === 0) {
    return <span className="text-ink-300">—</span>;
  }
  return (
    <div className="flex flex-col gap-0.5" title={advertencias.join("\n")}>
      {advertencias.map((a, i) => (
        <span key={i} className="flex items-center gap-1 text-[11px] font-medium text-amber-600">
          <AlertTriangle size={11} className="shrink-0" />
          {a}
        </span>
      ))}
    </div>
  );
}

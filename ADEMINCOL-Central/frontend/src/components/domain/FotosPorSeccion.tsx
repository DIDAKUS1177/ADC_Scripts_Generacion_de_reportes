import { useMemo } from "react";
import { PhotoGallery } from "../ui/PhotoGallery";
import type { MtPreviewFoto } from "../../api/previewClient";

/**
 * Agrupa `fotos` (con `.seccion` opcional) por sección y muestra una
 * PhotoGallery por cada una. Usado en 570/510, que a diferencia de
 * MT/PMI/Espesores/SCAN C tienen muchas secciones (hasta 15) — mezclar
 * todas las fotos en una sola grilla sin agrupar perdía el contexto de a
 * qué parte del recipiente/tubería pertenece cada una.
 */
export function FotosPorSeccion({ fotos }: { fotos: MtPreviewFoto[] }) {
  const grupos = useMemo(() => {
    const porSeccion = new Map<string, MtPreviewFoto[]>();
    for (const foto of fotos) {
      const key = foto.seccion || "General";
      if (!porSeccion.has(key)) porSeccion.set(key, []);
      porSeccion.get(key)!.push(foto);
    }
    return Array.from(porSeccion.entries());
  }, [fotos]);

  if (fotos.length === 0) {
    return <p className="text-xs text-ink-400">Sin fotos registradas.</p>;
  }

  return (
    <div className="space-y-4">
      {grupos.map(([seccion, fotosSeccion]) => (
        <div key={seccion}>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            {seccion} ({fotosSeccion.length})
          </p>
          <PhotoGallery fotos={fotosSeccion.map((f) => ({ url: f.url, descripcion: f.descripcion }))} />
        </div>
      ))}
    </div>
  );
}

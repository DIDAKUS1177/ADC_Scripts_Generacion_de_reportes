import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ImageIcon, X, ZoomIn } from "lucide-react";

export interface GalleryPhoto {
  url: string;
  descripcion?: string | null;
}

const FOTOS_POR_PAGINA = 12;

/**
 * Grid de miniaturas + lightbox a pantalla completa con navegación
 * anterior/siguiente (click, flechas del teclado, Escape para cerrar).
 *
 * Paginado (2026-07-09): 570/510 pueden traer cientos de fotos en una sola
 * sección (una prueba real llegó a 347 en "recubrimiento", 670 en total) —
 * intentar renderizar todas esas <img> a la vez congelaba el navegador y el
 * usuario veía la sección simplemente vacía. Se muestran de a
 * `FOTOS_POR_PAGINA` con controles de página; el lightbox, una vez abierto,
 * sigue navegando sobre TODAS las fotos (no se queda encerrado en la página
 * actual) — es más útil que cortar la navegación cada 12 fotos.
 */
export function PhotoGallery({ fotos }: { fotos: GalleryPhoto[] }) {
  const [indiceAbierto, setIndiceAbierto] = useState<number | null>(null);
  const [pagina, setPagina] = useState(0);

  const totalPaginas = Math.max(1, Math.ceil(fotos.length / FOTOS_POR_PAGINA));
  const fotosPagina = useMemo(() => {
    const inicio = pagina * FOTOS_POR_PAGINA;
    return fotos.slice(inicio, inicio + FOTOS_POR_PAGINA);
  }, [fotos, pagina]);

  // Si `fotos` cambia (ej. se abrió otro informe) y la página actual queda
  // fuera de rango, volver a la primera.
  useEffect(() => {
    if (pagina >= totalPaginas) setPagina(0);
  }, [totalPaginas, pagina]);

  useEffect(() => {
    if (indiceAbierto === null) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIndiceAbierto(null);
      if (e.key === "ArrowRight") setIndiceAbierto((i) => (i === null ? null : Math.min(i + 1, fotos.length - 1)));
      if (e.key === "ArrowLeft") setIndiceAbierto((i) => (i === null ? null : Math.max(i - 1, 0)));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [indiceAbierto, fotos.length]);

  if (fotos.length === 0) {
    return <p className="text-xs text-ink-400">Sin fotos registradas.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {fotosPagina.map((foto, i) => {
          const indiceAbsoluto = pagina * FOTOS_POR_PAGINA + i;
          return (
            <button
              key={indiceAbsoluto}
              onClick={() => setIndiceAbierto(indiceAbsoluto)}
              className="group relative overflow-hidden rounded-lg border border-ink-200 text-left"
            >
              <img
                src={foto.url}
                alt={foto.descripcion ?? ""}
                loading="lazy"
                className="h-24 w-full object-cover transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                <ZoomIn size={20} className="text-white drop-shadow" />
              </div>
              {foto.descripcion && (
                <p className="flex items-center gap-1 truncate bg-white px-1.5 py-1 text-[10px] text-ink-600">
                  <ImageIcon size={10} className="shrink-0" />
                  <span className="truncate">{foto.descripcion}</span>
                </p>
              )}
            </button>
          );
        })}
      </div>

      {totalPaginas > 1 && (
        <div className="mt-2 flex items-center justify-between text-xs text-ink-500">
          <button
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-ink-100 disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Anterior
          </button>
          <span>
            Página {pagina + 1} de {totalPaginas} · {fotos.length} fotos
          </span>
          <button
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            disabled={pagina >= totalPaginas - 1}
            className="flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-ink-100 disabled:opacity-30"
          >
            Siguiente <ChevronRight size={14} />
          </button>
        </div>
      )}

      {indiceAbierto !== null && (
        <Lightbox
          fotos={fotos}
          indice={indiceAbierto}
          onClose={() => setIndiceAbierto(null)}
          onNavegar={(i) => {
            setIndiceAbierto(i);
            setPagina(Math.floor(i / FOTOS_POR_PAGINA));
          }}
        />
      )}
    </>
  );
}

function Lightbox({
  fotos,
  indice,
  onClose,
  onNavegar,
}: {
  fotos: GalleryPhoto[];
  indice: number;
  onClose: () => void;
  onNavegar: (i: number) => void;
}) {
  const foto = fotos[indice];
  const hayAnterior = indice > 0;
  const haySiguiente = indice < fotos.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        title="Cerrar (Esc)"
      >
        <X size={22} />
      </button>

      <p className="absolute top-4 left-4 rounded-full bg-white/10 px-3 py-1 text-sm text-white">
        {indice + 1} / {fotos.length}
      </p>

      {hayAnterior && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavegar(indice - 1);
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-4"
          title="Anterior (←)"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {haySiguiente && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavegar(indice + 1);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-4"
          title="Siguiente (→)"
        >
          <ChevronRight size={24} />
        </button>
      )}

      <img
        src={foto.url}
        alt={foto.descripcion ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
      />
      {foto.descripcion && (
        <p
          onClick={(e) => e.stopPropagation()}
          className="mt-3 max-w-[80vw] rounded-lg bg-white/10 px-4 py-2 text-center text-sm text-white"
        >
          {foto.descripcion}
        </p>
      )}
    </div>
  );
}

// Cliente contra el backend de PREVIEW (temporal, sin auth ni BD) definido en
// backend/app/main.py. Lee datos reales de Google Sheets. Se reemplaza por la
// API completa (con auth y PostgreSQL) en las Fases 1-4.
//
// Usa tipos propios (no los de src/types/index.ts) porque el Sheet real usa
// IDs de texto (id_informe), mientras que los tipos de la app espejan la
// futura API con IDs numéricos de PostgreSQL.

const PREVIEW_API_BASE = "http://localhost:8000";

export class PreviewApiError extends Error {}

export interface MtPreviewItem {
  id: string;
  reportType: "MT";
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderNumero: string | null;
  estadoReporte: "GENERADO" | "PENDIENTE";
}

export interface MtPreviewResultado {
  item: string;
  identificacion: string;
  evaluacion: string;
  observaciones: string;
}

export interface MtPreviewIndicacion {
  id_resultado: string;
  tipo: string;
  long: string;
}

export interface MtPreviewDetail extends MtPreviewItem {
  datosGenerales: Record<string, string | null>;
  resultados: MtPreviewResultado[];
  indicaciones: MtPreviewIndicacion[];
}

export async function fetchRealMtInspections(): Promise<MtPreviewItem[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/mt`);
  if (!res.ok) {
    throw new PreviewApiError(
      "No se pudo conectar con el backend de preview. ¿Está corriendo en el puerto 8000?"
    );
  }
  return res.json();
}

export async function fetchRealMtInspectionDetail(idInforme: string): Promise<MtPreviewDetail> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/mt/${encodeURIComponent(idInforme)}`);
  if (!res.ok) {
    throw new PreviewApiError("No se pudo cargar el detalle real de esta inspección.");
  }
  return res.json();
}

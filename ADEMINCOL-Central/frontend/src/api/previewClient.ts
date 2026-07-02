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

export interface MtPreviewFoto {
  url: string;
  descripcion: string;
}

export interface MtPreviewDetail extends MtPreviewItem {
  datosGenerales: Record<string, string | null>;
  resultados: MtPreviewResultado[];
  indicaciones: MtPreviewIndicacion[];
  fotos: MtPreviewFoto[];
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

async function leerDetalleError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body.detail || fallback;
  } catch {
    return fallback;
  }
}

// ---- Generación asíncrona con progreso ----

export interface JobStatus {
  estado: "RUNNING" | "DONE" | "ERROR";
  pct: number;
  etapa: string;
  error: string | null;
}

export async function startReportJob(
  idInforme: string,
  overrides: Record<string, string>
): Promise<string> {
  const res = await fetch(
    `${PREVIEW_API_BASE}/api/preview/mt/${encodeURIComponent(idInforme)}/generar-reporte`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overrides }),
    }
  );
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo iniciar la generación."));
  const body = await res.json();
  return body.jobId;
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/jobs/${jobId}`);
  if (!res.ok) throw new PreviewApiError("No se pudo consultar el progreso.");
  return res.json();
}

export async function downloadJobResult(jobId: string, idInforme: string): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/jobs/${jobId}/descargar`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo descargar el reporte."));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Reporte_MT_${idInforme}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Usuarios (BD real en Sheets) ----

export interface RealUser {
  idUsuario: string;
  nombre: string;
  usuario: string;
  correo: string | null;
  rol: "ADMINISTRADOR" | "SUPERVISOR" | "INSPECTOR";
  cargo: string | null;
  certificado: string | null;
  tieneFirma: boolean;
  activo: boolean;
  createdAt: string | null;
}

export interface NewUserPayload {
  nombre: string;
  usuario: string;
  password: string;
  rol: string;
  correo?: string;
  cargo?: string;
  certificado?: string;
}

export async function fetchRealUsers(): Promise<RealUser[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/usuarios`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo leer la BD de usuarios."));
  return res.json();
}

export async function createRealUser(payload: NewUserPayload): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo crear el usuario."));
}

export async function toggleRealUserActive(usuario: string, activo: boolean): Promise<void> {
  const res = await fetch(
    `${PREVIEW_API_BASE}/api/preview/usuarios/${encodeURIComponent(usuario)}/activo`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    }
  );
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo actualizar el usuario."));
}

// ---- Órdenes de Trabajo (BD real en Sheets) ----

export interface RealOT {
  idOt: string;
  numero: string;
  contrato: string | null;
  cliente: string | null;
  ubicacion: string | null;
  supervisorUsuario: string | null;
  inspectorUsuario: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";
  descripcion: string | null;
  observaciones: string | null;
}

export interface NewOTPayload {
  numero: string;
  contrato?: string;
  cliente?: string;
  ubicacion?: string;
  supervisorUsuario?: string;
  inspectorUsuario?: string;
  fechaInicio?: string;
  fechaFin?: string;
  estado?: string;
  descripcion?: string;
  observaciones?: string;
}

export async function fetchRealOTs(): Promise<RealOT[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/ots`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo leer la BD de OTs."));
  return res.json();
}

export async function createRealOT(payload: NewOTPayload): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/ots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo crear la OT."));
}

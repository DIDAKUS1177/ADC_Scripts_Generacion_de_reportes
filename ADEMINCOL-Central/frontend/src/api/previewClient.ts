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
  sistema: string | null;
  inspector: string | null;
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

// ---- PMI: Caracterización de Materiales ----

export interface PmiPreviewItem {
  id: string;
  reportType: "PMI";
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderNumero: string | null;
  estadoReporte: "GENERADO" | "PENDIENTE";
  sistema: string | null;
  inspector: string | null;
}

export interface PmiPreviewQuimica {
  Elemento: string;
  Valor: string;
}

export interface PmiPreviewDureza {
  Dureza: string;
  ksi: string;
}

export interface PmiPreviewDetail extends PmiPreviewItem {
  datosGenerales: Record<string, string | number | null>;
  quimica: PmiPreviewQuimica[];
  durezas: PmiPreviewDureza[];
  fotos: MtPreviewFoto[];
}

export async function fetchRealPmiInspections(): Promise<PmiPreviewItem[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/pmi`);
  if (!res.ok) {
    throw new PreviewApiError(
      "No se pudo conectar con el backend de preview. ¿Está corriendo en el puerto 8000?"
    );
  }
  return res.json();
}

export async function fetchRealPmiInspectionDetail(idGeneral: string): Promise<PmiPreviewDetail> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/pmi/${encodeURIComponent(idGeneral)}`);
  if (!res.ok) {
    throw new PreviewApiError("No se pudo cargar el detalle real de esta caracterización.");
  }
  return res.json();
}

// ---- API 570: Inspección Visual de Tubería ----
// No pasa por el modelo OT/Servicio: `ot` en el Sheet es texto libre, nunca
// fue una FK (ver decisión reunión 2026-07-03 — la OT no es obligatoria).

export interface Sh570PreviewItem {
  id: string;
  reportType: "570";
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderNumero: string | null;
  estadoReporte: "GENERADO" | "PENDIENTE";
  sistema: string | null;
  inspector: string | null;
}

export interface Sh570SeccionResumen {
  key: string;
  sheet: string;
  registros: number;
  fotos: number;
}

export interface Sh570PreviewDetail extends Sh570PreviewItem {
  datosGenerales: Record<string, string | null>;
  secciones: Sh570SeccionResumen[];
  totalFotos: number;
  fotos: MtPreviewFoto[];
}

export async function fetchReal570Inspections(): Promise<Sh570PreviewItem[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/570`);
  if (!res.ok) {
    throw new PreviewApiError(
      "No se pudo conectar con el backend de preview. ¿Está corriendo en el puerto 8000?"
    );
  }
  return res.json();
}

export async function fetchReal570InspectionDetail(idApi570: string): Promise<Sh570PreviewDetail> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/570/${encodeURIComponent(idApi570)}`);
  if (!res.ok) {
    throw new PreviewApiError("No se pudo cargar el detalle real de esta inspección.");
  }
  return res.json();
}

// ---- API 510: Inspección Visual de Recipientes a Presión ----
// Igual que 570: no pasa por el modelo OT/Servicio, `ot` es texto libre.

export interface Sh510PreviewItem {
  id: string;
  reportType: "510";
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderNumero: string | null;
  estadoReporte: "GENERADO" | "PENDIENTE";
  sistema: string | null;
  inspector: string | null;
}

export interface Sh510PreviewDetail extends Sh510PreviewItem {
  datosGenerales: Record<string, string | null>;
  secciones: Sh570SeccionResumen[];
  totalFotos: number;
  fotos: MtPreviewFoto[];
}

export async function fetchReal510Inspections(): Promise<Sh510PreviewItem[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/510`);
  if (!res.ok) {
    throw new PreviewApiError(
      "No se pudo conectar con el backend de preview. ¿Está corriendo en el puerto 8000?"
    );
  }
  return res.json();
}

export async function fetchReal510InspectionDetail(pvid: string): Promise<Sh510PreviewDetail> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/510/${encodeURIComponent(pvid)}`);
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
  warnings: string[];
}

export type ReportKind = "mt" | "pmi" | "570" | "510";

export async function startReportJob(
  tipo: ReportKind,
  idInforme: string,
  overrides: Record<string, string>
): Promise<string> {
  const res = await fetch(
    `${PREVIEW_API_BASE}/api/preview/${tipo}/${encodeURIComponent(idInforme)}/generar-reporte`,
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

export async function downloadJobResult(
  jobId: string,
  tipo: ReportKind,
  idInforme: string
): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/jobs/${jobId}/descargar`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo descargar el reporte."));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Reporte_${tipo.toUpperCase()}_${idInforme}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---- Usuarios (BD real en Sheets) ----

export interface RealUser {
  idUsuario: string;
  nombre: string;
  usuario: string; // login
  correo: string | null;
  rol: "ADMINISTRADOR" | "SUPERVISOR" | "INSPECTOR";
  cargo: string | null;
  certificado: string | null; // Obsoleto, usar UserCertificate
  tieneFirma: boolean;
  activo: boolean;
  createdAt: string | null;
}

export type Tecnica = "MT" | "PMI" | "570" | "510";

export interface UserCertificate {
  idCertificado?: string;
  usuario: string;
  tecnica: Tecnica | "";
  nombreCertificado: string;
  entidadEmisora: string;
  fechaEmision: string;
  fechaVencimiento: string;
  linkPdf: string;
  createdAt?: string;
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

export async function updateRealUserFirma(usuario: string, firmaBase64: string): Promise<void> {
  const res = await fetch(
    `${PREVIEW_API_BASE}/api/preview/usuarios/${encodeURIComponent(usuario)}/firma`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firmaBase64 }),
    }
  );
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo actualizar la firma."));
}

export async function fetchUserCertificates(usuario: string): Promise<UserCertificate[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/usuarios/${encodeURIComponent(usuario)}/certificados`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudieron cargar los certificados."));
  return res.json();
}

export async function updateUserCertificates(usuario: string, certificados: UserCertificate[]): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/usuarios/${encodeURIComponent(usuario)}/certificados`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ certificados }),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudieron actualizar los certificados."));
}

// ---- Órdenes de Trabajo (BD real en Sheets) ----

export interface RealOT {
  idOt: string;
  numero: string;
  contrato: string | null;
  cliente: string | null;
  ubicacion: string | null;
  // El supervisor SIEMPRE es quien crea la OT (ver decisión reunión
  // 2026-07-03) — no existe selección manual de supervisor ni inspector
  // a nivel de OT. El inspector se asigna por servicio (ver RealServicio).
  supervisorUsuario: string | null;
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
  supervisorUsuario: string; // obligatorio: se toma del usuario autenticado, no de un <select>
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

export async function createRealOT(payload: NewOTPayload): Promise<{ idOt: string }> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/ots`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo crear la OT."));
  return res.json();
}

// ---- Servicios (una técnica dentro de una OT — ver decisión reunión 2026-07-03) ----

export interface RealServicio {
  idServicio: string;
  idOt: string;
  tecnica: Tecnica;
  estado: "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";
  inspectorUsuario: string | null; // se autoasigna en AppSheet, no aquí
  fechaCreacion: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  duracionMin: number | null;
  idInformeGenerado: string | null;
}

export async function fetchServicios(idOt?: string): Promise<RealServicio[]> {
  const qs = idOt ? `?id_ot=${encodeURIComponent(idOt)}` : "";
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/servicios${qs}`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo leer los servicios."));
  return res.json();
}

export async function crearServicio(idOt: string, tecnica: Tecnica): Promise<{ idServicio: string }> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/servicios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idOt, tecnica }),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo crear el servicio."));
  return res.json();
}

// ---- Dashboard (agregados reales — ver decisión reunión 2026-07-03) ----

export interface DashboardReporteTipo {
  total: number;
  generados: number;
  pendientes: number;
}

export interface DashboardCertificadoPorVencer {
  usuario: string;
  tecnica: string;
  nombreCertificado: string;
  fechaVencimiento: string;
}

export interface DashboardMiOt {
  idOt: string;
  numero: string;
  cliente: string | null;
  estado: string;
}

export interface DashboardMiServicio {
  idServicio: string;
  idOt: string;
  tecnica: string;
  estado: string;
}

export interface RealDashboardData {
  usuariosActivos: number;
  otsTotal: number;
  otsPorEstado: Record<string, number>;
  serviciosTotal: number;
  serviciosPorTecnica: Record<string, number>;
  serviciosPendientes: number;
  certificadosPorVencer: DashboardCertificadoPorVencer[];
  reportesPorTipo: Record<string, DashboardReporteTipo>;
  misOts?: DashboardMiOt[];
  misServicios?: DashboardMiServicio[];
  misCertificadosPorVencer?: DashboardCertificadoPorVencer[];
}

export async function fetchRealDashboard(usuario: string, rol: string): Promise<RealDashboardData> {
  const res = await fetch(
    `${PREVIEW_API_BASE}/api/preview/dashboard?usuario=${encodeURIComponent(usuario)}&rol=${encodeURIComponent(rol)}`
  );
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo cargar el dashboard."));
  return res.json();
}

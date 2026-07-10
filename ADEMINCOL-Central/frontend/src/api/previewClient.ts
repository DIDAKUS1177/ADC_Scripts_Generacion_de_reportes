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
  seccion?: string; // solo viene poblado en 570/510, que tienen múltiples secciones
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
  elementosDisponibles: string[];
  tieneImagenManualGrafico: boolean;
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

// El gráfico Tensión vs Punto (durezas) — antes se generaba corriendo un
// script en R y subiendo el PNG a mano. Este endpoint devuelve el PNG
// generado en el momento para el `elemento` elegido (TUBERIA por defecto),
// puramente de lectura — se usa solo para previsualizar (ver decisión
// 2026-07-05). El endpoint devuelve la imagen directamente, así que basta
// con usar la URL como `src` de un <img>.
export function pmiGraficoDurezasUrl(idGeneral: string, elemento: string): string {
  return `${PREVIEW_API_BASE}/api/preview/pmi/${encodeURIComponent(idGeneral)}/grafico-durezas?elemento=${encodeURIComponent(elemento)}`;
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

// ---- APP009 Piernas Muertas UT — jerarquía Sistema -> PM, DISTINTA de los
// demás tipos (no es un listado plano). Sin OT, sin inspector/firma en el
// Sheet (el GAS original nunca los escribe) y sin link_reporte (el estado
// siempre es PENDIENTE, ver backend/app/main.py).

export interface PiernasMuertasPreviewItem {
  id: string;
  reportType: "PIERNAS_MUERTAS";
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderNumero: string | null;
  estadoReporte: "GENERADO" | "PENDIENTE";
  sistema: string | null;
  idSistema: string | null;
  inspector: string | null;
}

export interface PiernasMuertasPreviewDetail extends PiernasMuertasPreviewItem {
  datosGenerales: Record<string, string | null>;
  secciones: Sh570SeccionResumen[];
  totalFotos: number;
  fotos: MtPreviewFoto[];
}

export async function fetchRealPiernasMuertasInspections(): Promise<PiernasMuertasPreviewItem[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/piernas_muertas`);
  if (!res.ok) {
    throw new PreviewApiError(
      "No se pudo conectar con el backend de preview. ¿Está corriendo en el puerto 8000?"
    );
  }
  return res.json();
}

export async function fetchRealPiernasMuertasInspectionDetail(
  idPm: string
): Promise<PiernasMuertasPreviewDetail> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/piernas_muertas/${encodeURIComponent(idPm)}`);
  if (!res.ok) {
    throw new PreviewApiError("No se pudo cargar el detalle real de este PM.");
  }
  return res.json();
}

// ---- APP015 Insp ACFM — 2 secciones (datosACFM con fotos propias +
// fotosGenerales, un segundo bloque de fotos sin datos propios, ancladas a
// la fila general). A diferencia de Piernas Muertas, SÍ tiene OT, inspector
// y link_reporte reales en el Sheet.

export interface AcfmPreviewItem {
  id: string;
  reportType: "ACFM";
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderNumero: string | null;
  estadoReporte: "GENERADO" | "PENDIENTE";
  sistema: string | null;
  inspector: string | null;
}

export interface AcfmPreviewDetail extends AcfmPreviewItem {
  datosGenerales: Record<string, string | null>;
  secciones: Sh570SeccionResumen[];
  totalFotos: number;
  fotos: MtPreviewFoto[];
}

export async function fetchRealAcfmInspections(): Promise<AcfmPreviewItem[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/acfm`);
  if (!res.ok) {
    throw new PreviewApiError(
      "No se pudo conectar con el backend de preview. ¿Está corriendo en el puerto 8000?"
    );
  }
  return res.json();
}

export async function fetchRealAcfmInspectionDetail(idGeneral: string): Promise<AcfmPreviewDetail> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/acfm/${encodeURIComponent(idGeneral)}`);
  if (!res.ok) {
    throw new PreviewApiError("No se pudo cargar el detalle real de esta inspección.");
  }
  return res.json();
}

// ---- Medición de Espesores (UT) — igual que 570/510, `ot` es texto libre.
// A diferencia de 570/510 no hay secciones: UNA sola tabla de lecturas.

export interface EspesoresPreviewItem {
  id: string;
  reportType: "ESPESORES";
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderNumero: string | null;
  estadoReporte: "GENERADO" | "PENDIENTE";
  sistema: string | null;
  inspector: string | null;
}

export interface EspesoresLectura {
  item: string;
  componente: string;
  cml: string;
  diametro: string;
  t_nominal: string;
  observaciones: string;
  [medicion: string]: string; // med1..med16
}

export interface EspesoresPreviewDetail extends EspesoresPreviewItem {
  datosGenerales: Record<string, string | null>;
  lecturas: EspesoresLectura[];
  totalLecturas: number;
  fotos: MtPreviewFoto[];
  totalFotos: number;
}

export async function fetchRealEspesoresInspections(): Promise<EspesoresPreviewItem[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/espesores`);
  if (!res.ok) {
    throw new PreviewApiError(
      "No se pudo conectar con el backend de preview. ¿Está corriendo en el puerto 8000?"
    );
  }
  return res.json();
}

export async function fetchRealEspesoresInspectionDetail(idGeneral: string): Promise<EspesoresPreviewDetail> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/espesores/${encodeURIComponent(idGeneral)}`);
  if (!res.ok) {
    throw new PreviewApiError("No se pudo cargar el detalle real de esta inspección.");
  }
  return res.json();
}

// ---- SCAN C (Ultrasonido C-Scan) — dos variantes reales (líneas y
// recipientes a presión), MISMA forma de datos, cada una con su propio
// spreadsheet. Dos tablas de datos (reporte_datos, ensayo_datos) + fotos,
// a diferencia de Espesores que solo tiene una tabla.

export type ScancVariante = "scanc_lineas" | "scanc_rp";

export interface ScancPreviewItem {
  id: string;
  reportType: "SCANC_LINEAS" | "SCANC_RP";
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderNumero: string | null;
  estadoReporte: "GENERADO" | "PENDIENTE";
  sistema: string | null;
  inspector: string | null;
}

export interface ScancReporteDato {
  id_punto: string;
  sistema_o_linea: string;
  cml: string;
  diametro_in: string;
  tipo_accesorio: string;
  tipo_evaluacion: string;
  espesor_nominal_mm: string;
  espesor_promedio_mm: string;
  espesor_minimo_mm: string;
  perdida_basada_en_minimo: string;
  perdida_basada_en_promedio: string;
  observaciones: string;
  [campo: string]: string;
}

export interface ScancEnsayoDato {
  id_punto: string;
  cml: string;
  diametro_in: string;
  tipo_anomalia: string;
  porcentaje_perdida: string;
  observaciones: string;
  [campo: string]: string;
}

export interface ScancPreviewDetail extends ScancPreviewItem {
  datosGenerales: Record<string, string | null>;
  reporteDatos: ScancReporteDato[];
  totalReporteDatos: number;
  ensayoDatos: ScancEnsayoDato[];
  totalEnsayoDatos: number;
  fotos: MtPreviewFoto[];
  totalFotos: number;
}

export async function fetchRealScancInspections(variante: ScancVariante): Promise<ScancPreviewItem[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/${variante}`);
  if (!res.ok) {
    throw new PreviewApiError(
      "No se pudo conectar con el backend de preview. ¿Está corriendo en el puerto 8000?"
    );
  }
  return res.json();
}

export async function fetchRealScancInspectionDetail(
  variante: ScancVariante,
  idGeneral: string
): Promise<ScancPreviewDetail> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/${variante}/${encodeURIComponent(idGeneral)}`);
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

export interface BatchDetalleItem {
  id: string;
  estado: "PENDIENTE" | "GENERANDO" | "OK" | "ERROR";
  error: string | null;
}

export interface JobStatus {
  estado: "RUNNING" | "DONE" | "ERROR";
  pct: number;
  etapa: string;
  error: string | null;
  warnings: string[];
  detalleLote: BatchDetalleItem[];
}

export type ReportKind = "mt" | "pmi" | "570" | "510" | "espesores" | "scanc_lineas" | "scanc_rp" | "piernas_muertas" | "acfm";

// ---- Sincronización real Sheets -> Postgres (2026-07-09) — reemplaza el
// mock que había en mock/client.ts (runSync generaba un número aleatorio,
// nunca tocaba nada real). Cubre las 7 tablas de soporte, ver sync_service.py.

export interface SyncRun {
  id: number;
  status: "SUCCESS" | "ERROR" | "RUNNING";
  startedAt: string;
  finishedAt: string | null;
  rowsUpserted: number;
  errorDetail: string | null;
  detalle: Record<string, number | string>;
}

export interface SyncResultado {
  detalle: Record<string, number | string>;
  totalFilas: number;
  huboError: boolean;
}

export async function fetchSyncRunsReal(): Promise<SyncRun[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/sync/runs`);
  if (!res.ok) throw new PreviewApiError("No se pudo cargar el historial de sincronización.");
  return res.json();
}

export async function runSyncReal(): Promise<SyncResultado> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/sync`, { method: "POST" });
  if (!res.ok) throw new PreviewApiError("No se pudo ejecutar la sincronización.");
  return res.json();
}

// ---- Exportación de la BD a Excel (solo ADMINISTRADOR, 2026-07-09).
// Cada tabla es una hoja del .xlsx; se pueden seleccionar filas por ID.

export interface AdminTablaMeta {
  key: string;
  label: string;
  grupo: string; // "General" | "PMI" | ... — el backend decide los grupos, ver admin_export.py
  idColumn: string;
  columnas: string[];
  totalFilas: number;
}

export interface AdminTablaDatos extends AdminTablaMeta {
  filas: Record<string, string | number | boolean | null>[];
}

export interface ExportSeleccion {
  key: string;
  ids?: string[]; // vacío/ausente = todas las filas de esa tabla
}

export async function fetchAdminTablas(): Promise<AdminTablaMeta[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/admin/tablas`);
  if (!res.ok) throw new PreviewApiError("No se pudo cargar la lista de tablas.");
  return res.json();
}

export async function fetchAdminTablaDatos(key: string): Promise<AdminTablaDatos> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/admin/tabla/${encodeURIComponent(key)}`);
  if (!res.ok) throw new PreviewApiError("No se pudo cargar la tabla.");
  return res.json();
}

export async function exportarBD(tablas: ExportSeleccion[]): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/admin/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tablas }),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo generar el Excel."));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const cd = res.headers.get("Content-Disposition") || "";
  const match = cd.match(/filename="?([^"]+)"?/);
  a.download = match ? match[1] : "ADEMINCOL_BD.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

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

// ---- Generación MASIVA (por lote) — reunión 2026-07-05 ----
// Empaqueta todos los reportes seleccionados en un único .zip (evita que el
// navegador bloquee descargas múltiples automáticas).

export async function startBatchReportJob(
  tipo: ReportKind,
  ids: string[],
  overrides: Record<string, string> = {}
): Promise<string> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/${tipo}/generar-lote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, overrides }),
  });
  if (!res.ok) {
    throw new PreviewApiError(await leerDetalleError(res, "No se pudo iniciar la generación por lote."));
  }
  const body = await res.json();
  return body.jobId;
}

export async function downloadBatchResult(jobId: string): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/jobs/${jobId}/descargar`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo descargar el lote."));
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const nombre = match ? match[1] : `Reportes_lote_${Date.now()}.zip`;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
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

export type Tecnica = "MT" | "PMI" | "570" | "510" | "ESPESORES" | "SCANC_LINEAS" | "SCANC_RP" | "PIERNAS_MUERTAS" | "ACFM";

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

export interface UpdateUserPayload {
  nombre?: string;
  correo?: string;
  rol?: string;
  cargo?: string;
  certificado?: string;
  newPassword?: string;
}

export async function updateRealUser(usuario: string, payload: UpdateUserPayload): Promise<void> {
  const res = await fetch(
    `${PREVIEW_API_BASE}/api/preview/usuarios/${encodeURIComponent(usuario)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
  // Quién solicitó el servicio (2026-07-10, columna nueva en la hoja real)
  // — siempre el usuario autenticado que lo crea, nunca un <select>, mismo
  // criterio que work_orders.supervisorUsuario.
  supervisorUsuario: string | null;
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

// idOt es OPCIONAL (pedido 2026-07-10: "no es obligatoria la ot") — un
// servicio se puede crear suelto, sin OT asociada. supervisorUsuario es
// obligatorio ("es importante que salga el supervisor que solicitó el
// servicio") — el llamador siempre debe pasar el usuario autenticado.
export async function crearServicio(
  tecnica: Tecnica,
  supervisorUsuario: string,
  idOt?: string
): Promise<{ idServicio: string }> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/servicios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idOt: idOt || undefined, tecnica, supervisorUsuario }),
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
  serviciosPorSupervisor: Record<string, Record<string, number>>;
  reportesPorInspector: Record<string, Record<string, number>>;
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

// ---- Equipos de ensayo (físicos) — decisión D17 (2026-07-07) ----

export interface RealEquipo {
  idEquipo: string;
  categoria: string | null;
  equipo: string | null;
  serie: string | null;
  serialAdc: string | null;
  fechaCalibracion: string | null;
  fechaVencimientoCalibracion: string | null;
  activo: boolean;
  observaciones: string | null;
}

export interface NewEquipoPayload {
  categoria: string;
  equipo?: string;
  serie?: string;
  serialAdc: string;
  fechaCalibracion?: string;
  fechaVencimientoCalibracion?: string;
  observaciones?: string;
}

export async function fetchRealEquipos(): Promise<RealEquipo[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/equipos`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo leer la BD de equipos."));
  return res.json();
}

export async function crearEquipo(payload: NewEquipoPayload): Promise<{ idEquipo: string }> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/equipos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo crear el equipo."));
  return res.json();
}

// Tabla 100% editable (decisión 2026-07-08): actualiza cualquier
// subconjunto de campos de un equipo en una sola llamada.
export async function actualizarEquipo(idEquipo: string, cambios: Partial<Omit<RealEquipo, "idEquipo">>): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/equipos/${encodeURIComponent(idEquipo)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cambios),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo actualizar el equipo."));
}

export async function borrarEquipo(idEquipo: string): Promise<void> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/equipos/${encodeURIComponent(idEquipo)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo borrar el equipo."));
}

// ---- Roster de certificados de personal (RRHH) — decisión D17 (2026-07-07),
// tabla plana 100% editable (decisión 2026-07-08). Distinto de
// UserCertificate/certificados_usuarios: este roster cubre a TODO el
// personal de ADEMINCOL identificado por cédula (`cc`), tenga o no usuario
// en la webapp, y la técnica es texto LIBRE (29+ técnicas reales, no solo
// las 4 con reporte automatizado).

export interface PersonalCertificado {
  idCertificado: string;
  nombre: string;
  cc: string | null;
  numeroCertificado: string | null;
  tecnica: string | null;
  nivel: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  estado: string | null;
}

export interface NewPersonalCertificadoPayload {
  nombre: string;
  cc?: string;
  numeroCertificado?: string;
  tecnica: string;
  nivel?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
}

export async function fetchPersonalCertificados(): Promise<PersonalCertificado[]> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/personal-certificados`);
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo leer el roster de certificados."));
  return res.json();
}

export async function crearCertificadoPersonal(payload: NewPersonalCertificadoPayload): Promise<{ idCertificado: string }> {
  const res = await fetch(`${PREVIEW_API_BASE}/api/preview/personal-certificados`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo crear el certificado."));
  return res.json();
}

export async function actualizarCertificadoPersonal(
  idCertificado: string,
  cambios: Partial<Omit<PersonalCertificado, "idCertificado" | "estado">>
): Promise<void> {
  const res = await fetch(
    `${PREVIEW_API_BASE}/api/preview/personal-certificados/certificado/${encodeURIComponent(idCertificado)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cambios),
    }
  );
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo actualizar el certificado."));
}

export async function borrarCertificadoPersonal(idCertificado: string): Promise<void> {
  const res = await fetch(
    `${PREVIEW_API_BASE}/api/preview/personal-certificados/certificado/${encodeURIComponent(idCertificado)}`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new PreviewApiError(await leerDetalleError(res, "No se pudo borrar el certificado."));
}

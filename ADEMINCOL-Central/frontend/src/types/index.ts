// Tipos espejo de los futuros schemas Pydantic (backend/app/schemas).
// Ver ADEMINCOL-Central/docs/01_BASE_DE_DATOS.md y 02_BACKEND_FASTAPI.md

export type Role = "ADMINISTRADOR" | "SUPERVISOR" | "INSPECTOR";

export type OTStatus = "PENDIENTE" | "EN_CURSO" | "COMPLETADA" | "CANCELADA";

export type ReportStatus = "PENDIENTE" | "GENERANDO" | "GENERADO" | "ERROR";

export type ReportTypeCode = "MT" | "PMI" | "VT_SOLDADAS" | "UT_ESPESORES";

export interface User {
  id: number;
  nombre: string;
  usuario: string;
  correo: string | null;
  rol: Role;
  cargo: string | null;
  certificado: string | null;
  tieneFirma: boolean;
  activo: boolean;
  createdAt: string;
}

export interface WorkOrder {
  id: number;
  numero: string;
  contrato: string | null;
  cliente: string | null;
  ubicacion: string | null;
  supervisorId: number | null;
  supervisorNombre: string | null;
  inspectorId: number | null;
  inspectorNombre: string | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  estado: OTStatus;
  descripcion: string | null;
  observaciones: string | null;
  inspeccionesCount: number;
}

export interface ReportType {
  id: number;
  codigo: ReportTypeCode;
  nombre: string;
}

export interface InspectionListItem {
  id: number;
  reportType: ReportTypeCode;
  idInforme: string;
  cliente: string | null;
  fecha: string | null;
  reporteN: string | null;
  workOrderId: number | null;
  workOrderNumero: string | null;
  estadoReporte: ReportStatus;
  syncedAt: string;
}

export interface InspectionDetail extends InspectionListItem {
  datosGenerales: Record<string, string | number | null>;
  resultados: Record<string, string | number | null>[];
  indicaciones: Record<string, string | number | null>[];
  fotos: { url: string; descripcion: string }[];
  historialReportes: GeneratedReport[];
}

export interface GeneratedReport {
  id: number;
  generadoPor: string;
  fileName: string;
  createdAt: string;
  sizeKb: number;
}

export interface DashboardStats {
  otsPorEstado: Record<OTStatus, number>;
  reportesGeneradosMes: number;
  inspeccionesPendientesPorTipo: Record<ReportTypeCode, number>;
  ultimaSincronizacion: string;
}

export interface SyncRun {
  id: number;
  reportType: ReportTypeCode | "TODOS";
  status: "RUNNING" | "SUCCESS" | "ERROR";
  startedAt: string;
  finishedAt: string | null;
  rowsUpserted: number;
  errorDetail: string | null;
}

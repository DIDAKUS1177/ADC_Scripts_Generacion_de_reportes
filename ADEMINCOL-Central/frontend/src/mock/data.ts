// Datos simulados para el primer mockup (sin conexión real a backend/BD).
// Cuando exista la API real (Fase 2-4), este archivo se reemplaza por
// llamadas axios en src/api/*.ts sin tocar los componentes (mismos tipos).
import type {
  DashboardStats,
  GeneratedReport,
  InspectionDetail,
  InspectionListItem,
  Role,
  SyncRun,
  User,
  WorkOrder,
} from "../types";

export interface MockAccount {
  usuario: string;
  password: string;
  user: User;
}

export const MOCK_USERS: User[] = [
  {
    id: 1,
    nombre: "Diego Alejandro Hernández",
    usuario: "admin",
    correo: "diego.hernandez@ademincol.com",
    rol: "ADMINISTRADOR",
    cargo: "Director de Operaciones",
    certificado: "ASNT NDT Level III",
    tieneFirma: true,
    activo: true,
    createdAt: "2025-01-15T08:00:00Z",
  },
  {
    id: 2,
    nombre: "Carlos Andrés Rojas",
    usuario: "crojas",
    correo: "carlos.rojas@ademincol.com",
    rol: "SUPERVISOR",
    cargo: "Supervisor END",
    certificado: "MT Level II - SNT-TC-1A",
    tieneFirma: true,
    activo: true,
    createdAt: "2025-02-01T08:00:00Z",
  },
  {
    id: 3,
    nombre: "María Fernanda Ortiz",
    usuario: "mortiz",
    correo: "maria.ortiz@ademincol.com",
    rol: "SUPERVISOR",
    cargo: "Supervisora END",
    certificado: "PMI Level II",
    tieneFirma: false,
    activo: true,
    createdAt: "2025-02-10T08:00:00Z",
  },
  {
    id: 4,
    nombre: "Jorge Luis Pérez",
    usuario: "jperez",
    correo: "jorge.perez@ademincol.com",
    rol: "INSPECTOR",
    cargo: "Inspector MT/PT",
    certificado: "MT Level I - SNT-TC-1A",
    tieneFirma: true,
    activo: true,
    createdAt: "2025-03-01T08:00:00Z",
  },
  {
    id: 5,
    nombre: "Laura Camila Torres",
    usuario: "ltorres",
    correo: "laura.torres@ademincol.com",
    rol: "INSPECTOR",
    cargo: "Inspectora PMI",
    certificado: "PMI Level I",
    tieneFirma: false,
    activo: true,
    createdAt: "2025-03-15T08:00:00Z",
  },
  {
    id: 6,
    nombre: "Andrés Felipe Gómez",
    usuario: "agomez",
    correo: "andres.gomez@ademincol.com",
    rol: "INSPECTOR",
    cargo: "Inspector MT",
    certificado: "MT Level II",
    tieneFirma: true,
    activo: false,
    createdAt: "2025-01-20T08:00:00Z",
  },
];

// Contraseña simulada única para todas las cuentas demo.
export const MOCK_ACCOUNTS: MockAccount[] = MOCK_USERS.filter((u) => u.activo).map(
  (user) => ({ usuario: user.usuario, password: "Demo2026*", user })
);

export const MOCK_WORK_ORDERS: WorkOrder[] = [
  {
    id: 1,
    numero: "OT-2026-0142",
    contrato: "CT-ECP-2025-118",
    cliente: "Ecopetrol S.A. - GRB",
    ubicacion: "Campo Rubiales, Meta",
    supervisorId: 2,
    supervisorNombre: "Carlos Andrés Rojas",
    inspectorId: 4,
    inspectorNombre: "Jorge Luis Pérez",
    fechaInicio: "2026-06-15",
    fechaFin: "2026-07-15",
    estado: "EN_CURSO",
    descripcion: "Inspección MT de uniones soldadas en línea de flujo",
    observaciones: null,
    inspeccionesCount: 3,
  },
  {
    id: 2,
    numero: "OT-2026-0143",
    contrato: "CT-ECP-2025-118",
    cliente: "Ecopetrol S.A. - GRB",
    ubicacion: "Estación Castilla",
    supervisorId: 3,
    supervisorNombre: "María Fernanda Ortiz",
    inspectorId: 5,
    inspectorNombre: "Laura Camila Torres",
    fechaInicio: "2026-06-20",
    fechaFin: "2026-07-01",
    estado: "COMPLETADA",
    descripcion: "Caracterización de materiales PMI en válvulas de proceso",
    observaciones: "Entregado a cliente el 2026-07-01",
    inspeccionesCount: 2,
  },
  {
    id: 3,
    numero: "OT-2026-0144",
    contrato: "CT-FRO-2026-004",
    cliente: "Frontera Energy",
    ubicacion: "Campo Quifa",
    supervisorId: 2,
    supervisorNombre: "Carlos Andrés Rojas",
    inspectorId: 4,
    inspectorNombre: "Jorge Luis Pérez",
    fechaInicio: "2026-07-01",
    fechaFin: null,
    estado: "PENDIENTE",
    descripcion: "Inspección MT programada en soportería",
    observaciones: null,
    inspeccionesCount: 0,
  },
];

const nombresPersonal = (n: number) =>
  n === 4 ? "Jorge Luis Pérez" : n === 5 ? "Laura Camila Torres" : "Andrés Felipe Gómez";

// Nota: MT ya NO tiene entradas simuladas aquí — se conectó a datos reales
// de Google Sheets (ver RealMtInspectionsPanel.tsx). PMI/VT/UT siguen mock
// hasta que se conecten en las próximas iteraciones.
export const MOCK_INSPECTIONS: InspectionListItem[] = [
  {
    id: 105,
    reportType: "PMI",
    idInforme: "PMI-2026-0087",
    cliente: "Ecopetrol S.A. - GRB",
    fecha: "2026-06-22",
    reporteN: "RPT-0087",
    workOrderId: 2,
    workOrderNumero: "OT-2026-0143",
    estadoReporte: "GENERADO",
    syncedAt: "2026-07-02T13:05:00Z",
  },
  {
    id: 106,
    reportType: "PMI",
    idInforme: "PMI-2026-0088",
    cliente: "Ecopetrol S.A. - GRB",
    fecha: "2026-06-23",
    reporteN: "RPT-0088",
    workOrderId: 2,
    workOrderNumero: "OT-2026-0143",
    estadoReporte: "GENERADO",
    syncedAt: "2026-07-02T13:05:00Z",
  },
];

const MOCK_DETAILS: Record<number, InspectionDetail> = Object.fromEntries(
  MOCK_INSPECTIONS.map((insp) => {
    const inspectorNombre = insp.workOrderId
      ? nombresPersonal(MOCK_WORK_ORDERS.find((w) => w.id === insp.workOrderId)?.inspectorId ?? 4)
      : "Sin asignar";

    const historial: GeneratedReport[] =
      insp.estadoReporte === "GENERADO"
        ? [
            {
              id: insp.id * 10,
              generadoPor: "Carlos Andrés Rojas",
              fileName: `Reporte_${insp.reportType}_${insp.idInforme}.xlsx`,
              createdAt: "2026-07-01T16:20:00Z",
              sizeKb: 842,
            },
          ]
        : [];

    const detail: InspectionDetail = {
      ...insp,
      datosGenerales: {
        cliente: insp.cliente,
        contrato: "CT-ECP-2025-118",
        ot: insp.workOrderNumero ?? "-",
        fecha_actividad: insp.fecha,
        zona: "Línea de flujo 12\"",
        sistema: "Transporte",
        material: "ASTM A106 Gr. B",
        espesor: "9.5 mm",
        diametro: "12 in",
        procedimiento_n: "PR-MT-001",
        tecnica_magnetizacion: "Yugo magnético",
        inspector: inspectorNombre,
      },
      resultados: [
        { item: 1, identificacion: "J-01", evaluacion: "ACEPTADO", observaciones: "Sin indicaciones" },
        { item: 2, identificacion: "J-02", evaluacion: "ACEPTADO", observaciones: "Sin indicaciones" },
        { item: 3, identificacion: "J-03", evaluacion: "RECHAZADO", observaciones: "Indicación lineal 8mm" },
      ],
      indicaciones: [
        { id_resultado: 3, tipo: "Lineal", long: "8 mm" },
      ],
      fotos: [
        { url: "https://placehold.co/400x300/dc2626/ffffff?text=Foto+1", descripcion: "Vista general junta J-03" },
        { url: "https://placehold.co/400x300/1e293b/ffffff?text=Foto+2", descripcion: "Detalle indicación" },
      ],
      historialReportes: historial,
    };
    return [insp.id, detail];
  })
);

export const MOCK_SYNC_RUNS: SyncRun[] = [
  {
    id: 1,
    reportType: "TODOS",
    status: "SUCCESS",
    startedAt: "2026-07-02T13:00:00Z",
    finishedAt: "2026-07-02T13:00:42Z",
    rowsUpserted: 18,
    errorDetail: null,
  },
  {
    id: 2,
    reportType: "MT",
    status: "SUCCESS",
    startedAt: "2026-07-02T12:55:00Z",
    finishedAt: "2026-07-02T12:55:11Z",
    rowsUpserted: 4,
    errorDetail: null,
  },
];

export function getDashboardStats(role: Role): DashboardStats {
  return {
    otsPorEstado: { PENDIENTE: 1, EN_CURSO: 1, COMPLETADA: 1, CANCELADA: 0 },
    reportesGeneradosMes: role === "INSPECTOR" ? 1 : 14,
    // MT ya no usa conteo simulado: se muestra con datos reales en Inspecciones → MT.
    inspeccionesPendientesPorTipo: { MT: 0, PMI: 0, VT_SOLDADAS: 0, UT_ESPESORES: 0 },
    ultimaSincronizacion: "2026-07-02T13:05:00Z",
  };
}

export function getInspectionDetail(id: number): InspectionDetail | undefined {
  return MOCK_DETAILS[id];
}

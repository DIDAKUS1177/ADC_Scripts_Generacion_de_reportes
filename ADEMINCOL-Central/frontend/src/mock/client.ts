// Simula latencia de red + forma de respuesta de la futura API FastAPI.
// Ver docs/02_BACKEND_FASTAPI.md — cuando exista el backend real, src/api/*.ts
// reemplaza estas funciones por llamadas axios manteniendo la misma forma.
import type {
  DashboardStats,
  GeneratedReport,
  InspectionDetail,
  InspectionListItem,
  ReportStatus,
  Role,
  SyncRun,
  User,
  WorkOrder,
} from "../types";
import type { MockAccount } from "./data";
import {
  MOCK_ACCOUNTS,
  MOCK_INSPECTIONS,
  MOCK_SYNC_RUNS,
  MOCK_USERS,
  MOCK_WORK_ORDERS,
  getDashboardStats,
  getInspectionDetail,
} from "./data";

function delay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ---- Auth ----
export async function loginMock(usuario: string, password: string): Promise<User> {
  await delay(null, 700);
  const account = MOCK_ACCOUNTS.find((a: MockAccount) => a.usuario === usuario);
  if (!account || account.password !== password) {
    throw new ApiError("Usuario o contraseña incorrectos", 401);
  }
  return account.user;
}

// ---- Dashboard ----
export async function fetchDashboard(role: Role): Promise<DashboardStats> {
  return delay(getDashboardStats(role), 400);
}

// ---- Users ----
let usersState: User[] = [...MOCK_USERS];

export async function fetchUsers(): Promise<User[]> {
  return delay([...usersState], 400);
}

export async function toggleUserActive(id: number): Promise<User> {
  await delay(null, 350);
  usersState = usersState.map((u) => (u.id === id ? { ...u, activo: !u.activo } : u));
  const updated = usersState.find((u) => u.id === id);
  if (!updated) throw new ApiError("Usuario no encontrado", 404);
  return updated;
}

export async function createUser(data: Omit<User, "id" | "createdAt" | "tieneFirma">): Promise<User> {
  await delay(null, 500);
  const newUser: User = {
    ...data,
    id: Math.max(...usersState.map((u) => u.id)) + 1,
    tieneFirma: false,
    createdAt: new Date().toISOString(),
  };
  usersState = [...usersState, newUser];
  return newUser;
}

// ---- Work Orders ----
export async function fetchWorkOrders(): Promise<WorkOrder[]> {
  return delay([...MOCK_WORK_ORDERS], 450);
}

// ---- Inspections ----
let inspectionsState: InspectionListItem[] = [...MOCK_INSPECTIONS];

export async function fetchInspections(): Promise<InspectionListItem[]> {
  return delay([...inspectionsState], 500);
}

export async function fetchInspectionDetail(id: number): Promise<InspectionDetail> {
  await delay(null, 400);
  const detail = getInspectionDetail(id);
  if (!detail) throw new ApiError("Inspección no encontrada", 404);
  const current = inspectionsState.find((i) => i.id === id);
  return { ...detail, estadoReporte: current?.estadoReporte ?? detail.estadoReporte };
}

export async function generateReport(id: number): Promise<GeneratedReport> {
  inspectionsState = inspectionsState.map((i) =>
    i.id === id ? { ...i, estadoReporte: "GENERANDO" as ReportStatus } : i
  );
  await delay(null, 2200);
  // 10% de probabilidad de simular error, para probar el estado ERROR en la UI
  const fail = Math.random() < 0.1;
  inspectionsState = inspectionsState.map((i) =>
    i.id === id ? { ...i, estadoReporte: (fail ? "ERROR" : "GENERADO") as ReportStatus } : i
  );
  if (fail) throw new ApiError("Error al insertar imagen: URL de Drive no accesible", 500);
  return {
    id: Date.now(),
    generadoPor: "Tú",
    fileName: `Reporte_${id}.xlsx`,
    createdAt: new Date().toISOString(),
    sizeKb: 780,
  };
}

export async function linkWorkOrder(inspectionId: number, workOrderId: number): Promise<void> {
  const wo = MOCK_WORK_ORDERS.find((w) => w.id === workOrderId);
  inspectionsState = inspectionsState.map((i) =>
    i.id === inspectionId ? { ...i, workOrderId, workOrderNumero: wo?.numero ?? null } : i
  );
  await delay(undefined, 350);
}

// ---- Sync ----
export async function fetchSyncRuns(): Promise<SyncRun[]> {
  return delay([...MOCK_SYNC_RUNS], 350);
}

export async function runSync(): Promise<SyncRun> {
  await delay(null, 1500);
  return {
    id: Date.now(),
    reportType: "TODOS",
    status: "SUCCESS",
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    rowsUpserted: Math.floor(Math.random() * 10) + 1,
    errorDetail: null,
  };
}

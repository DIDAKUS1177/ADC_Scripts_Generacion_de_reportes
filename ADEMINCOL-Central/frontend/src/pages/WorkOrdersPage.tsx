import { useEffect, useState } from "react";
import { Plus, MapPin, User as UserIcon } from "lucide-react";
import { fetchWorkOrders } from "../mock/client";
import type { WorkOrder } from "../types";
import { Spinner, EmptyState, ErrorState } from "../components/ui/States";
import { OTStatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/ui/Toast";

export function WorkOrdersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [ots, setOts] = useState<WorkOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setOts(null);
    fetchWorkOrders()
      .then(setOts)
      .catch(() => setError("No se pudieron cargar las órdenes de trabajo."));
  }

  useEffect(load, []);

  const canCreate = user?.rol === "ADMINISTRADOR" || user?.rol === "SUPERVISOR";

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Órdenes de Trabajo</h1>
          <p className="text-sm text-ink-500">Contratos y asignaciones de campo</p>
        </div>
        {canCreate && (
          <button
            onClick={() => toast.success("Formulario de nueva OT (mockup).")}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus size={16} /> Nueva OT
          </button>
        )}
      </div>

      {ots === null && !error && <Spinner label="Cargando órdenes de trabajo..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {ots !== null && ots.length === 0 && (
        <EmptyState title="No hay órdenes de trabajo" description="Crea la primera OT para comenzar." />
      )}

      {ots !== null && ots.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ots.map((ot) => (
            <div key={ot.id} className="rounded-xl border border-ink-200 bg-white p-5">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="font-mono text-sm font-bold text-ink-900">{ot.numero}</p>
                  <p className="text-xs text-ink-400">{ot.contrato}</p>
                </div>
                <OTStatusBadge status={ot.estado} />
              </div>

              <p className="mb-1 text-sm font-medium text-ink-800">{ot.cliente}</p>
              <p className="mb-3 flex items-center gap-1 text-xs text-ink-500">
                <MapPin size={12} /> {ot.ubicacion}
              </p>

              <p className="mb-4 text-sm text-ink-600">{ot.descripcion}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500">
                <span className="flex items-center gap-1">
                  <UserIcon size={12} /> {ot.supervisorNombre ?? "Sin supervisor"}
                </span>
                <span>{ot.inspeccionesCount} inspecciones vinculadas</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

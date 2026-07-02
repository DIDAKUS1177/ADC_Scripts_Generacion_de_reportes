import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import type { ReportStatus, OTStatus } from "../../types";
import { Badge } from "./Badge";

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  switch (status) {
    case "GENERADO":
      return (
        <Badge tone="green">
          <CheckCircle2 size={13} /> Generado
        </Badge>
      );
    case "GENERANDO":
      return (
        <Badge tone="yellow">
          <Loader2 size={13} className="animate-spin" /> Generando
        </Badge>
      );
    case "ERROR":
      return (
        <Badge tone="red">
          <AlertCircle size={13} /> Error
        </Badge>
      );
    default:
      return (
        <Badge tone="gray">
          <Clock size={13} /> Pendiente
        </Badge>
      );
  }
}

const OT_TONE: Record<OTStatus, "gray" | "blue" | "green" | "red"> = {
  PENDIENTE: "gray",
  EN_CURSO: "blue",
  COMPLETADA: "green",
  CANCELADA: "red",
};

const OT_LABEL: Record<OTStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_CURSO: "En curso",
  COMPLETADA: "Completada",
  CANCELADA: "Cancelada",
};

export function OTStatusBadge({ status }: { status: OTStatus }) {
  return <Badge tone={OT_TONE[status]}>{OT_LABEL[status]}</Badge>;
}

import { forwardRef, useImperativeHandle, useState, type ChangeEvent } from "react";
import { ChevronDown, ChevronUp, Loader2, Signature } from "lucide-react";
import type { RealUser } from "../../api/previewClient";
import { useToast } from "../ui/Toast";

export interface FirmaSelectorHandle {
  getOverrides: () => Record<string, string>;
}

interface FirmaSelectorProps {
  label: string;
  prefijo: string; // ej. "revisor" | "aprobador" | "supervisor" — debe coincidir
  // con el prefijo que el backend espera en overrides (ver _resolver_bloque_firma
  // en main.py).
  usuarios: RealUser[];
  usuarioActual?: string;
  defaultUsuario?: string;
  className?: string;
}

// Selector de firma con dos vías combinadas (pedido explícito del usuario
// 2026-07-16: "quiero... que me dé la opción de colocar yo mismo el nombre,
// firma y certificado... pero que dé la libertad también de colocar
// libremente" — es decir, el selector de usuario registrado que YA existía
// (y que el usuario dijo que le encantaba) MÁS la libertad de escribirlo a
// mano, sin tener que elegir entre uno u otro). Si se llena el nombre
// manual, esos datos ganan prioridad — mismo criterio que ya resuelve el
// backend en _resolver_bloque_firma (revisor/aprobador en 570 y aprobador
// en Espesores) y en el bloque legado de supervisor en PMI/Espesores.
export const FirmaSelector = forwardRef<FirmaSelectorHandle, FirmaSelectorProps>(
  ({ label, prefijo, usuarios, usuarioActual, defaultUsuario, className }, ref) => {
    const toast = useToast();
    const [usuario, setUsuario] = useState(defaultUsuario ?? "");
    const [manualOpen, setManualOpen] = useState(false);
    const [nombre, setNombre] = useState("");
    const [cargo, setCargo] = useState("");
    const [certificado, setCertificado] = useState("");
    const [firmaBase64, setFirmaBase64] = useState<string | null>(null);
    const [firmaNombreArchivo, setFirmaNombreArchivo] = useState<string | null>(null);
    const [loadingFirma, setLoadingFirma] = useState(false);

    useImperativeHandle(ref, () => ({
      getOverrides() {
        const overrides: Record<string, string> = {};
        if (usuario) overrides[`${prefijo}_usuario`] = usuario;
        if (nombre.trim()) overrides[`${prefijo}_nombre_manual`] = nombre.trim();
        if (cargo.trim()) overrides[`${prefijo}_cargo_manual`] = cargo.trim();
        if (certificado.trim()) overrides[`${prefijo}_certificado_manual`] = certificado.trim();
        if (firmaBase64) overrides[`${prefijo}_firma_manual`] = firmaBase64;
        return overrides;
      },
    }));

    function handleFirmaChange(e: ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      setLoadingFirma(true);
      const reader = new FileReader();
      reader.onload = () => {
        setFirmaBase64(reader.result as string);
        setFirmaNombreArchivo(file.name);
        setLoadingFirma(false);
      };
      reader.onerror = () => {
        toast.error("No se pudo leer la imagen.");
        setLoadingFirma(false);
      };
      reader.readAsDataURL(file);
    }

    return (
      <div className={className}>
        <label className="block">
          <span className="mb-1 block text-[11px] font-medium text-ink-500">{label}</span>
          <select
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            className="w-full rounded-lg border border-ink-200 px-2 py-1.5 text-xs outline-none focus:border-brand-600"
          >
            <option value="">— Ninguno —</option>
            {usuarios.map((u) => (
              <option key={u.usuario} value={u.usuario}>
                {u.nombre}
                {u.usuario === usuarioActual ? " (tú)" : ""}
                {!u.tieneFirma ? " — sin firma cargada" : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setManualOpen((v) => !v)}
          className="mt-1 flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:text-brand-700"
        >
          {manualOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Colocar {label.toLowerCase()} manualmente
        </button>
        {manualOpen && (
          <div className="mt-2 w-56 space-y-2 rounded-lg border border-ink-200 bg-ink-50/60 p-2.5">
            <p className="text-[10px] leading-tight text-ink-500">
              Si escribes un nombre aquí, estos datos reemplazan la selección de arriba.
            </p>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre"
              className="w-full rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
            />
            <input
              value={cargo}
              onChange={(e) => setCargo(e.target.value)}
              placeholder="Cargo"
              className="w-full rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
            />
            <input
              value={certificado}
              onChange={(e) => setCertificado(e.target.value)}
              placeholder="Certificado"
              className="w-full rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
            />
            <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed border-ink-300 px-2 py-1.5 text-[11px] text-ink-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700">
              {loadingFirma ? <Loader2 size={13} className="animate-spin" /> : <Signature size={13} />}
              {firmaNombreArchivo ? firmaNombreArchivo : "Subir imagen de firma"}
              <input type="file" accept="image/*" onChange={handleFirmaChange} className="hidden" />
            </label>
          </div>
        )}
      </div>
    );
  }
);
FirmaSelector.displayName = "FirmaSelector";

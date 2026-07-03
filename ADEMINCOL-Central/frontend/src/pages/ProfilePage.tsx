import { Signature, Mail, Briefcase, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../components/layout/navConfig";
import { useToast } from "../components/ui/Toast";
import { useState } from "react";
import { updateRealUserFirma } from "../api/previewClient";
import { SignaturePad } from "../components/ui/SignaturePad";

export function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [showPad, setShowPad] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!user) return null;

  async function handleSaveFirma(base64: string) {
    setSaving(true);
    try {
      await updateRealUserFirma(user!.usuario, base64);
      toast.success("Firma guardada correctamente. El sistema la usará en los próximos reportes.");
      setShowPad(false);
      // Idealmente recargar el contexto del usuario aquí
    } catch (e) {
      toast.error("Error al guardar la firma");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="mb-5 text-2xl font-bold text-ink-900">Mi Perfil</h1>

      <div className="rounded-xl border border-ink-200 bg-white p-6">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl font-bold text-white">
            {user.nombre.charAt(0)}
          </div>
          <div>
            <p className="text-lg font-bold text-ink-900">{user.nombre}</p>
            <p className="text-sm text-ink-500">{ROLE_LABEL[user.rol]}</p>
          </div>
        </div>

        <div className="space-y-3 border-t border-ink-100 pt-4 text-sm">
          <Row icon={Mail} label="Correo" value={user.correo ?? "-"} />
          <Row icon={Briefcase} label="Cargo" value={user.cargo ?? "-"} />
          <Row icon={ShieldCheck} label="Certificado" value={user.certificado ?? "-"} />
        </div>

        <div className="mt-5 border-t border-ink-100 pt-5">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-800">
            <Signature size={16} /> Firma digital
          </p>
          {showPad ? (
            <div className="mb-3">
              <SignaturePad onSave={handleSaveFirma} onClear={() => {}} />
              {saving && <p className="mt-1 text-xs text-ink-500">Guardando...</p>}
              <button
                onClick={() => setShowPad(false)}
                className="mt-2 text-xs text-ink-400 hover:text-ink-600 underline"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <>
              {user.tieneFirma ? (
                <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-ink-200 bg-ink-50 text-xs text-ink-400">
                  Firma registrada (lista para reportes)
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">
                  Aún no has cargado tu firma. Es necesaria para generar reportes con tu nombre.
                </div>
              )}
              <button
                onClick={() => setShowPad(true)}
                className="mt-3 rounded-lg border border-ink-200 px-3.5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-50"
              >
                {user.tieneFirma ? "Actualizar firma" : "Configurar firma"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 text-ink-700">
      <Icon size={15} className="text-ink-400" />
      <span className="w-24 text-ink-400">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

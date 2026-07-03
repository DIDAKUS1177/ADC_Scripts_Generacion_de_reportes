import { useEffect, useMemo, useState } from "react";
import { Award, Search, X, Loader2, Plus, Trash2, ShieldCheck, Signature } from "lucide-react";
import {
  fetchRealUsers,
  fetchUserCertificates,
  updateUserCertificates,
  type RealUser,
  type UserCertificate,
} from "../api/previewClient";
import { Spinner, ErrorState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { ROLE_LABEL } from "../components/layout/navConfig";

export function EquiposPage() {
  const [users, setUsers] = useState<RealUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<RealUser | null>(null);

  function load() {
    setError(null);
    setUsers(null);
    fetchRealUsers()
      .then(setUsers)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "No se pudo cargar la lista del equipo.")
      );
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) => !q || u.nombre.toLowerCase().includes(q) || u.usuario.toLowerCase().includes(q)
    );
  }, [users, query]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">Equipo y Certificados</h1>
          <p className="text-sm text-ink-500">
            Gestiona los certificados y calificaciones de tu equipo
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar inspector por nombre o usuario..."
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {users === null && !error && <Spinner label="Cargando equipo..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      
      {users !== null && filtered.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((u) => (
            <div
              key={u.idUsuario}
              className="flex flex-col rounded-xl border border-ink-200 bg-white p-4 shadow-sm hover:border-brand-300 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-ink-900">{u.nombre}</h3>
                  <p className="text-xs text-ink-500">{u.usuario}</p>
                </div>
                <Badge tone={u.activo ? "green" : "gray"}>
                  {u.activo ? "Activo" : "Inactivo"}
                </Badge>
              </div>
              
              <div className="mt-3 flex items-center gap-2 text-xs text-ink-600">
                <ShieldCheck size={14} className="text-ink-400" />
                <span>{ROLE_LABEL[u.rol]} {u.cargo ? `· ${u.cargo}` : ""}</span>
              </div>
              
              <div className="mt-1 flex items-center gap-2 text-xs text-ink-600">
                <Signature size={14} className="text-ink-400" />
                <span>Firma: {u.tieneFirma ? "Registrada" : "Pendiente"}</span>
              </div>

              <div className="mt-4 pt-4 border-t border-ink-100 mt-auto">
                <button
                  onClick={() => setSelectedUser(u)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-ink-50 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                >
                  <Award size={16} /> Gestionar Certificados
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedUser && (
        <CertificatesModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
        />
      )}
    </div>
  );
}

function CertificatesModal({ user, onClose }: { user: RealUser; onClose: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [certs, setCerts] = useState<UserCertificate[]>([]);

  useEffect(() => {
    fetchUserCertificates(user.usuario)
      .then((data) => {
        setCerts(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error("Error cargando certificados");
        setLoading(false);
      });
  }, [user.usuario, toast]);

  function addCert() {
    setCerts([
      ...certs,
      {
        usuario: user.usuario,
        nombreCertificado: "",
        entidadEmisora: "",
        fechaEmision: "",
        fechaVencimiento: "",
        linkPdf: "",
      },
    ]);
  }

  function removeCert(index: number) {
    const newCerts = [...certs];
    newCerts.splice(index, 1);
    setCerts(newCerts);
  }

  function updateCert(index: number, field: keyof UserCertificate, value: string) {
    const newCerts = [...certs];
    newCerts[index] = { ...newCerts[index], [field]: value };
    setCerts(newCerts);
  }

  async function handleSave() {
    // Basic validation
    for (const c of certs) {
      if (!c.nombreCertificado.trim()) {
        toast.error("El nombre del certificado es obligatorio.");
        return;
      }
    }
    
    setSaving(true);
    try {
      await updateUserCertificates(user.usuario, certs);
      toast.success("Certificados actualizados exitosamente.");
      onClose();
    } catch (e) {
      toast.error("No se pudieron guardar los certificados.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <div>
            <h2 className="text-lg font-bold text-ink-900">Certificados</h2>
            <p className="text-sm text-ink-500">Inspector: {user.nombre}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <Spinner label="Cargando certificados..." />
          ) : (
            <div className="space-y-4">
              {certs.length === 0 && (
                <div className="rounded-lg border border-dashed border-ink-200 bg-ink-50 p-6 text-center text-sm text-ink-500">
                  Este usuario aún no tiene certificados registrados.
                </div>
              )}
              {certs.map((c, i) => (
                <div key={i} className="relative rounded-xl border border-ink-200 bg-ink-50/50 p-4">
                  <button
                    onClick={() => removeCert(i)}
                    className="absolute right-3 top-3 text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50"
                    title="Eliminar certificado"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 mr-6">
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-xs font-medium text-ink-700">Nombre del Certificado *</label>
                      <input
                        value={c.nombreCertificado}
                        onChange={(e) => updateCert(i, "nombreCertificado", e.target.value)}
                        placeholder="Ej: Nivel II PT (SNT-TC-1A)"
                        className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-700">Entidad Emisora</label>
                      <input
                        value={c.entidadEmisora}
                        onChange={(e) => updateCert(i, "entidadEmisora", e.target.value)}
                        placeholder="Ej: ASNT / Empresa"
                        className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-700">Fecha de Emisión</label>
                      <input
                        type="date"
                        value={c.fechaEmision}
                        onChange={(e) => updateCert(i, "fechaEmision", e.target.value)}
                        className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-700">Fecha de Vencimiento</label>
                      <input
                        type="date"
                        value={c.fechaVencimiento}
                        onChange={(e) => updateCert(i, "fechaVencimiento", e.target.value)}
                        className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
                      />
                    </div>
                    <div className="md:col-span-1">
                      <label className="mb-1 block text-xs font-medium text-ink-700">Link / Documento</label>
                      <input
                        value={c.linkPdf}
                        onChange={(e) => updateCert(i, "linkPdf", e.target.value)}
                        placeholder="URL de Drive o archivo"
                        className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={addCert}
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 px-4 py-3 text-sm font-medium text-ink-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 w-full"
              >
                <Plus size={16} /> Añadir otro certificado
              </button>
            </div>
          )}
        </div>

        <div className="border-t border-ink-100 bg-ink-50 p-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  Search,
  X,
  Loader2,
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  Signature,
  Wrench,
  Users2,
  Power,
} from "lucide-react";
import {
  fetchRealUsers,
  fetchUserCertificates,
  updateUserCertificates,
  fetchRealEquipos,
  crearEquipo,
  actualizarEquipo,
  borrarEquipo,
  fetchPersonalCertificados,
  crearCertificadoPersonal,
  actualizarCertificadoPersonal,
  borrarCertificadoPersonal,
  type RealUser,
  type UserCertificate,
  type RealEquipo,
  type PersonalCertificado,
  type NewPersonalCertificadoPayload,
} from "../api/previewClient";
import { Spinner, ErrorState, EmptyState } from "../components/ui/States";
import { Badge } from "../components/ui/Badge";
import { useToast } from "../components/ui/Toast";
import { ROLE_LABEL } from "../components/layout/navConfig";

type Tab = "personal" | "equipos" | "roster";

const TABS: { code: Tab; label: string; icon: typeof Users2 }[] = [
  { code: "personal", label: "Usuarios de la webapp", icon: Users2 },
  { code: "equipos", label: "Equipos físicos", icon: Wrench },
  { code: "roster", label: "Roster de certificados", icon: Award },
];

// Valor de filtro compartido por los selects de "Todos/Todas" en las tablas
// 100% editables de Equipos y Certificados (decisión 2026-07-08).
const FILTRO_TODOS = "__todos__";

export function EquiposPage() {
  const [tab, setTab] = useState<Tab>("personal");

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-ink-900">Equipos y Certificados</h1>
        <p className="text-sm text-ink-500">
          Usuarios de la plataforma, equipos físicos de ensayo y el roster completo de
          certificados del personal de ADEMINCOL
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.code}
              onClick={() => setTab(t.code)}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                tab === t.code
                  ? "bg-brand-600 text-white"
                  : "bg-white text-ink-600 border border-ink-200 hover:bg-ink-50"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "personal" && <PersonalUsuariosTab />}
      {tab === "equipos" && <EquiposFisicosTab />}
      {tab === "roster" && <CertificadosTab />}
    </div>
  );
}

// =====================================================================
// Tab 1: Usuarios de la webapp — comportamiento original (certificados_usuarios)
// =====================================================================
function PersonalUsuariosTab() {
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
                <Badge tone={u.activo ? "green" : "gray"}>{u.activo ? "Activo" : "Inactivo"}</Badge>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-ink-600">
                <ShieldCheck size={14} className="text-ink-400" />
                <span>
                  {ROLE_LABEL[u.rol]} {u.cargo ? `· ${u.cargo}` : ""}
                </span>
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

      {selectedUser && <CertificatesModal user={selectedUser} onClose={() => setSelectedUser(null)} />}
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
        tecnica: "",
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
    for (const c of certs) {
      if (!c.nombreCertificado.trim()) {
        toast.error("El nombre del certificado es obligatorio.");
        return;
      }
      if (!c.tecnica) {
        toast.error("Cada certificado debe indicar a qué técnica corresponde (MT, PMI...).");
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
                    <div>
                      <label className="mb-1 block text-xs font-medium text-ink-700">Técnica *</label>
                      <select
                        value={c.tecnica}
                        onChange={(e) => updateCert(i, "tecnica", e.target.value)}
                        className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
                      >
                        <option value="">— Selecciona —</option>
                        <option value="MT">MT — Partículas Magnéticas</option>
                        <option value="PMI">PMI — Caracterización de Materiales</option>
                        <option value="570">API 570 — Inspección Visual de Tubería</option>
                        <option value="510">API 510 — Inspección Visual de Recipientes a Presión</option>
                      </select>
                    </div>
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
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
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

// =====================================================================
// Tab 2: Equipos físicos — decisión D17 (2026-07-07), tabla 100%
// editable por celda + filtros (2026-07-08)
// =====================================================================
type EquipoEdit = Partial<
  Pick<
    RealEquipo,
    "categoria" | "equipo" | "serie" | "serialAdc" | "fechaCalibracion" | "fechaVencimientoCalibracion" | "observaciones"
  >
>;

function EquiposFisicosTab() {
  const toast = useToast();
  const [equipos, setEquipos] = useState<RealEquipo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState(FILTRO_TODOS);
  const [filtroActivo, setFiltroActivo] = useState<"todos" | "activo" | "inactivo">("todos");
  const [edits, setEdits] = useState<Record<string, EquipoEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);

  function load() {
    setError(null);
    setEquipos(null);
    fetchRealEquipos()
      .then(setEquipos)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar la BD de equipos."));
  }

  useEffect(load, []);

  const categorias = useMemo(() => {
    if (!equipos) return [];
    return Array.from(new Set(equipos.map((e) => (e.categoria || "").trim()).filter(Boolean))).sort();
  }, [equipos]);

  const filtered = useMemo(() => {
    if (!equipos) return [];
    const q = query.trim().toLowerCase();
    return equipos.filter((e) => {
      if (filtroCategoria !== FILTRO_TODOS && (e.categoria || "") !== filtroCategoria) return false;
      if (filtroActivo === "activo" && !e.activo) return false;
      if (filtroActivo === "inactivo" && e.activo) return false;
      if (q && ![e.categoria, e.equipo, e.serie, e.serialAdc].some((v) => (v || "").toLowerCase().includes(q))) {
        return false;
      }
      return true;
    });
  }, [equipos, query, filtroCategoria, filtroActivo]);

  function hoyEsVencimientoProximo(fecha: string): boolean {
    if (!fecha) return false;
    const d = new Date(fecha);
    if (isNaN(d.getTime())) return false;
    const dias = (d.getTime() - Date.now()) / 86400000;
    return dias <= 60;
  }

  function valorCampo(e: RealEquipo, campo: keyof EquipoEdit): string {
    const edit = edits[e.idEquipo];
    const val = edit && campo in edit ? edit[campo] : e[campo];
    return (val as string) ?? "";
  }

  function setCampo(idEquipo: string, campo: keyof EquipoEdit, valor: string) {
    setEdits((prev) => ({
      ...prev,
      [idEquipo]: { ...prev[idEquipo], [campo]: valor } as EquipoEdit,
    }));
  }

  function esDirty(idEquipo: string): boolean {
    return Boolean(edits[idEquipo] && Object.keys(edits[idEquipo]).length > 0);
  }

  async function guardar(idEquipo: string) {
    const cambios = edits[idEquipo];
    if (!cambios || Object.keys(cambios).length === 0) return;
    setSavingId(idEquipo);
    try {
      await actualizarEquipo(idEquipo, cambios);
      toast.success("Equipo actualizado.");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[idEquipo];
        return next;
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleToggleActivo(equipo: RealEquipo) {
    try {
      await actualizarEquipo(equipo.idEquipo, { activo: !equipo.activo });
      toast.success(equipo.activo ? "Equipo desactivado." : "Equipo reactivado.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }

  async function handleBorrar(equipo: RealEquipo) {
    if (
      !window.confirm(
        `¿Borrar el equipo "${equipo.categoria || equipo.idEquipo}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await borrarEquipo(equipo.idEquipo);
      toast.success("Equipo borrado.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por categoría, serie o serial ADC..."
              className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          >
            <option value={FILTRO_TODOS}>Todas las categorías</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={filtroActivo}
            onChange={(e) => setFiltroActivo(e.target.value as "todos" | "activo" | "inactivo")}
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          >
            <option value="todos">Activos e inactivos</option>
            <option value="activo">Solo activos</option>
            <option value="inactivo">Solo inactivos</option>
          </select>
        </div>
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-2 self-start rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={15} /> Nuevo equipo
        </button>
      </div>

      {equipos === null && !error && <Spinner label="Cargando equipos..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {equipos !== null && filtered.length === 0 && (
        <EmptyState title="Sin equipos" description="No hay equipos que coincidan con los filtros." />
      )}

      {equipos !== null && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
              <tr>
                <th className="px-3 py-3">Categoría</th>
                <th className="px-3 py-3">Equipo</th>
                <th className="px-3 py-3">Serie</th>
                <th className="px-3 py-3">Serial ADC</th>
                <th className="px-3 py-3">Última calibración</th>
                <th className="px-3 py-3">Vencimiento</th>
                <th className="px-3 py-3">Observaciones</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((e) => {
                const dirty = esDirty(e.idEquipo);
                const proximaAVencer = hoyEsVencimientoProximo(valorCampo(e, "fechaVencimientoCalibracion"));
                return (
                  <tr key={e.idEquipo} className={!e.activo ? "opacity-50" : ""}>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(e, "categoria")}
                        onChange={(ev) => setCampo(e.idEquipo, "categoria", ev.target.value)}
                        className="w-28 rounded border border-transparent px-2 py-1 text-sm font-medium text-ink-800 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(e, "equipo")}
                        onChange={(ev) => setCampo(e.idEquipo, "equipo", ev.target.value)}
                        className="w-28 rounded border border-transparent px-2 py-1 text-sm outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(e, "serie")}
                        onChange={(ev) => setCampo(e.idEquipo, "serie", ev.target.value)}
                        className="w-24 rounded border border-transparent px-2 py-1 font-mono text-xs text-ink-600 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(e, "serialAdc")}
                        onChange={(ev) => setCampo(e.idEquipo, "serialAdc", ev.target.value)}
                        className="w-24 rounded border border-transparent px-2 py-1 font-mono text-xs font-semibold text-brand-700 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        value={valorCampo(e, "fechaCalibracion")}
                        onChange={(ev) => setCampo(e.idEquipo, "fechaCalibracion", ev.target.value)}
                        className="rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        value={valorCampo(e, "fechaVencimientoCalibracion")}
                        onChange={(ev) => setCampo(e.idEquipo, "fechaVencimientoCalibracion", ev.target.value)}
                        className={`rounded border px-2 py-1 text-xs outline-none focus:border-brand-600 ${
                          proximaAVencer ? "border-amber-400 bg-amber-50" : "border-ink-200"
                        }`}
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(e, "observaciones")}
                        onChange={(ev) => setCampo(e.idEquipo, "observaciones", ev.target.value)}
                        placeholder="—"
                        className="w-32 rounded border border-transparent px-2 py-1 text-xs text-ink-600 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge tone={e.activo ? "green" : "gray"}>{e.activo ? "Activo" : "Inactivo"}</Badge>
                        {proximaAVencer && <Badge tone="yellow">Por vencer</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {dirty && (
                          <button
                            onClick={() => guardar(e.idEquipo)}
                            disabled={savingId === e.idEquipo}
                            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                          >
                            {savingId === e.idEquipo ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Save size={12} />
                            )}
                            Guardar
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActivo(e)}
                          title={e.activo ? "Desactivar" : "Reactivar"}
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                        >
                          <Power size={14} />
                        </button>
                        <button
                          onClick={() => handleBorrar(e)}
                          title="Borrar equipo"
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <NuevoEquipoModal
          onClose={() => setShowNuevo(false)}
          onCreated={() => {
            setShowNuevo(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NuevoEquipoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    categoria: "",
    equipo: "",
    serie: "",
    serialAdc: "",
    fechaCalibracion: "",
    fechaVencimientoCalibracion: "",
    observaciones: "",
  });

  async function handleSave() {
    if (!form.categoria.trim() || !form.serialAdc.trim()) {
      toast.error("Categoría y serial ADC son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await crearEquipo(form);
      toast.success("Equipo creado.");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el equipo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <h2 className="text-lg font-bold text-ink-900">Nuevo equipo</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Categoría *</label>
            <input
              value={form.categoria}
              onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}
              placeholder="Ej: MX2, PAUT VEO3, Espesores..."
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Serie (fábrica)</label>
            <input
              value={form.serie}
              onChange={(e) => setForm((f) => ({ ...f, serie: e.target.value }))}
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Serial ADC *</label>
            <input
              value={form.serialAdc}
              onChange={(e) => setForm((f) => ({ ...f, serialAdc: e.target.value }))}
              placeholder="Ej: ADC131"
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Última calibración</label>
              <input
                type="date"
                value={form.fechaCalibracion}
                onChange={(e) => setForm((f) => ({ ...f, fechaCalibracion: e.target.value }))}
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Vencimiento</label>
              <input
                type="date"
                value={form.fechaVencimientoCalibracion}
                onChange={(e) => setForm((f) => ({ ...f, fechaVencimientoCalibracion: e.target.value }))}
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-ink-100 bg-ink-50 p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Tab 3: Roster de certificados (RRHH) — decisión D17 (2026-07-07),
// tabla plana 100% editable por celda + filtros (2026-07-08). La
// técnica es texto libre (no un select cerrado): el personal de
// ADEMINCOL maneja 29+ técnicas distintas y solo 4 tienen reporte
// automatizado, así que restringir el campo perdería información real.
// =====================================================================
type CertificadoEdit = Partial<
  Pick<PersonalCertificado, "nombre" | "cc" | "numeroCertificado" | "tecnica" | "nivel" | "fechaEmision" | "fechaVencimiento">
>;

function CertificadosTab() {
  const toast = useToast();
  const [certs, setCerts] = useState<PersonalCertificado[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filtroTecnica, setFiltroTecnica] = useState(FILTRO_TODOS);
  const [filtroEstado, setFiltroEstado] = useState(FILTRO_TODOS);
  const [edits, setEdits] = useState<Record<string, CertificadoEdit>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);

  function load() {
    setError(null);
    setCerts(null);
    fetchPersonalCertificados()
      .then(setCerts)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el roster."));
  }

  useEffect(load, []);

  const tecnicas = useMemo(() => {
    if (!certs) return [];
    return Array.from(new Set(certs.map((c) => (c.tecnica || "").trim()).filter(Boolean))).sort();
  }, [certs]);

  const filtered = useMemo(() => {
    if (!certs) return [];
    const q = query.trim().toLowerCase();
    return certs.filter((c) => {
      if (filtroTecnica !== FILTRO_TODOS && (c.tecnica || "") !== filtroTecnica) return false;
      if (filtroEstado !== FILTRO_TODOS && (c.estado || "") !== filtroEstado) return false;
      if (q && !c.nombre.toLowerCase().includes(q) && !(c.cc || "").includes(q)) return false;
      return true;
    });
  }, [certs, query, filtroTecnica, filtroEstado]);

  function valorCampo(c: PersonalCertificado, campo: keyof CertificadoEdit): string {
    const edit = edits[c.idCertificado];
    const val = edit && campo in edit ? edit[campo] : c[campo];
    return (val as string) ?? "";
  }

  function setCampo(idCertificado: string, campo: keyof CertificadoEdit, valor: string) {
    setEdits((prev) => ({
      ...prev,
      [idCertificado]: { ...prev[idCertificado], [campo]: valor } as CertificadoEdit,
    }));
  }

  function esDirty(idCertificado: string): boolean {
    return Boolean(edits[idCertificado] && Object.keys(edits[idCertificado]).length > 0);
  }

  async function guardar(idCertificado: string) {
    const cambios = edits[idCertificado];
    if (!cambios || Object.keys(cambios).length === 0) return;
    setSavingId(idCertificado);
    try {
      await actualizarCertificadoPersonal(idCertificado, cambios);
      toast.success("Certificado actualizado.");
      setEdits((prev) => {
        const next = { ...prev };
        delete next[idCertificado];
        return next;
      });
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleBorrar(c: PersonalCertificado) {
    if (
      !window.confirm(
        `¿Borrar el certificado de "${c.nombre}" (${c.tecnica || "sin técnica"})? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    try {
      await borrarCertificadoPersonal(c.idCertificado);
      toast.success("Certificado borrado.");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  }

  function estadoTone(estado: string | null): "green" | "red" | "gray" {
    if (estado === "VIGENTE") return "green";
    if (estado === "VENCIDA") return "red";
    return "gray";
  }

  return (
    <div>
      <p className="mb-4 text-xs text-ink-500">
        Roster maestro de RRHH — identificado por cédula, no por usuario de la webapp. Incluye
        personal que todavía no tiene login en la plataforma. La técnica es texto libre.
      </p>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o cédula..."
              className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <select
            value={filtroTecnica}
            onChange={(e) => setFiltroTecnica(e.target.value)}
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          >
            <option value={FILTRO_TODOS}>Todas las técnicas</option>
            {tecnicas.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brand-600"
          >
            <option value={FILTRO_TODOS}>Vigentes y vencidas</option>
            <option value="VIGENTE">Solo vigentes</option>
            <option value="VENCIDA">Solo vencidas</option>
          </select>
        </div>
        <button
          onClick={() => setShowNuevo(true)}
          className="flex items-center gap-2 self-start rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus size={15} /> Nuevo certificado
        </button>
      </div>

      {certs === null && !error && <Spinner label="Cargando roster..." />}
      {error && <ErrorState message={error} onRetry={load} />}
      {certs !== null && filtered.length === 0 && (
        <EmptyState title="Sin resultados" description="No hay certificados que coincidan con los filtros." />
      )}

      {certs !== null && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
          <table className="w-full min-w-[1200px] text-sm">
            <thead className="bg-ink-50 text-left text-xs font-semibold uppercase text-ink-500">
              <tr>
                <th className="px-3 py-3">Nombre</th>
                <th className="px-3 py-3">CC</th>
                <th className="px-3 py-3">Técnica</th>
                <th className="px-3 py-3">Nivel</th>
                <th className="px-3 py-3"># Certificado</th>
                <th className="px-3 py-3">Fecha emisión</th>
                <th className="px-3 py-3">Fecha vencimiento</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {filtered.map((c) => {
                const dirty = esDirty(c.idCertificado);
                return (
                  <tr key={c.idCertificado}>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(c, "nombre")}
                        onChange={(ev) => setCampo(c.idCertificado, "nombre", ev.target.value)}
                        className="w-36 rounded border border-transparent px-2 py-1 text-sm font-medium text-ink-800 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(c, "cc")}
                        onChange={(ev) => setCampo(c.idCertificado, "cc", ev.target.value)}
                        className="w-24 rounded border border-transparent px-2 py-1 font-mono text-xs text-ink-600 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(c, "tecnica")}
                        onChange={(ev) => setCampo(c.idCertificado, "tecnica", ev.target.value)}
                        placeholder="Ej: API 570, MT, CWI..."
                        className="w-32 rounded border border-transparent px-2 py-1 text-sm outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(c, "nivel")}
                        onChange={(ev) => setCampo(c.idCertificado, "nivel", ev.target.value)}
                        placeholder="I / II / III"
                        className="w-16 rounded border border-transparent px-2 py-1 text-sm outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        value={valorCampo(c, "numeroCertificado")}
                        onChange={(ev) => setCampo(c.idCertificado, "numeroCertificado", ev.target.value)}
                        className="w-24 rounded border border-transparent px-2 py-1 text-xs text-ink-600 outline-none hover:border-ink-200 focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        value={valorCampo(c, "fechaEmision")}
                        onChange={(ev) => setCampo(c.idCertificado, "fechaEmision", ev.target.value)}
                        className="rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
                      />
                    </td>
                    <td className="px-1.5 py-1.5">
                      <input
                        type="date"
                        value={valorCampo(c, "fechaVencimiento")}
                        onChange={(ev) => setCampo(c.idCertificado, "fechaVencimiento", ev.target.value)}
                        className="rounded border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-600"
                      />
                    </td>
                    <td className="px-3 py-2.5">{c.estado && <Badge tone={estadoTone(c.estado)}>{c.estado}</Badge>}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        {dirty && (
                          <button
                            onClick={() => guardar(c.idCertificado)}
                            disabled={savingId === c.idCertificado}
                            className="flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50"
                          >
                            {savingId === c.idCertificado ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <Save size={12} />
                            )}
                            Guardar
                          </button>
                        )}
                        <button
                          onClick={() => handleBorrar(c)}
                          title="Borrar certificado"
                          className="rounded-lg p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNuevo && (
        <NuevoCertificadoModal
          onClose={() => setShowNuevo(false)}
          onCreated={() => {
            setShowNuevo(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function NuevoCertificadoModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<NewPersonalCertificadoPayload>({
    nombre: "",
    cc: "",
    tecnica: "",
    nivel: "",
    numeroCertificado: "",
    fechaEmision: "",
    fechaVencimiento: "",
  });

  async function handleSave() {
    if (!form.nombre.trim() || !form.tecnica.trim()) {
      toast.error("Nombre y técnica son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await crearCertificadoPersonal(form);
      toast.success("Certificado creado.");
      onCreated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo crear el certificado.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-ink-100 p-5">
          <h2 className="text-lg font-bold text-ink-900">Nuevo certificado</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-ink-100">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Nombre *</label>
            <input
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700">Cédula (cc)</label>
            <input
              value={form.cc}
              onChange={(e) => setForm((f) => ({ ...f, cc: e.target.value }))}
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Técnica *</label>
              <input
                value={form.tecnica}
                onChange={(e) => setForm((f) => ({ ...f, tecnica: e.target.value }))}
                placeholder="Ej: API 570, MT, CWI..."
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Nivel</label>
              <input
                value={form.nivel}
                onChange={(e) => setForm((f) => ({ ...f, nivel: e.target.value }))}
                placeholder="I / II / III"
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-700"># Certificado</label>
            <input
              value={form.numeroCertificado}
              onChange={(e) => setForm((f) => ({ ...f, numeroCertificado: e.target.value }))}
              className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Fecha de emisión</label>
              <input
                type="date"
                value={form.fechaEmision}
                onChange={(e) => setForm((f) => ({ ...f, fechaEmision: e.target.value }))}
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-700">Fecha de vencimiento</label>
              <input
                type="date"
                value={form.fechaVencimiento}
                onChange={(e) => setForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
                className="w-full rounded border border-ink-200 px-2.5 py-1.5 text-sm outline-none focus:border-brand-600"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 border-t border-ink-100 bg-ink-50 p-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

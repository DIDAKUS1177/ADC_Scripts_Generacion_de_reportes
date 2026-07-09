import { useEffect, useMemo, useState } from "react";
import { Database, Download, Search, Loader2, Table2, Check } from "lucide-react";
import {
  fetchAdminTablas,
  fetchAdminTablaDatos,
  exportarBD,
  PreviewApiError,
  type AdminTablaMeta,
  type AdminTablaDatos,
  type ExportSeleccion,
} from "../api/previewClient";
import { Spinner, ErrorState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";

// Página SOLO para ADMINISTRADOR (protegida en App.tsx). Descarga la base de
// datos como Excel: cada tabla es una hoja. Se eligen qué tablas incluir y,
// dentro de cada una, filtrar y seleccionar filas por su ID.
export function DatabasePage() {
  const toast = useToast();
  const [tablas, setTablas] = useState<AdminTablaMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activa, setActiva] = useState<string | null>(null);
  const [cache, setCache] = useState<Record<string, AdminTablaDatos>>({});
  const [cargandoTabla, setCargandoTabla] = useState(false);
  const [query, setQuery] = useState("");
  const [descargando, setDescargando] = useState(false);
  // Grupo activo en el selector (2026-07-09: "no como listas" — las tablas
  // se agrupan por categoría, General/PMI/... en vez de una lista plana de
  // las 10). Se arma dinámico a partir de lo que devuelva el backend, así
  // que agregar un grupo nuevo (SCAN C, 570...) no requiere tocar este archivo.
  const [grupoActivo, setGrupoActivo] = useState<string | null>(null);

  // Qué tablas se incluyen en la descarga (checkbox por tabla).
  const [incluidas, setIncluidas] = useState<Set<string>>(new Set());
  // IDs de filas seleccionadas por tabla. Vacío = todas las filas.
  const [seleccion, setSeleccion] = useState<Record<string, Set<string>>>({});

  function load() {
    setError(null);
    setTablas(null);
    fetchAdminTablas()
      .then((t) => {
        setTablas(t);
        if (t.length > 0) {
          setGrupoActivo(t[0].grupo);
          abrirTabla(t[0].key);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error desconocido"));
  }

  useEffect(load, []);

  function abrirTabla(key: string) {
    setActiva(key);
    setQuery("");
    if (cache[key]) return;
    setCargandoTabla(true);
    fetchAdminTablaDatos(key)
      .then((d) => setCache((prev) => ({ ...prev, [key]: d })))
      .catch((e) => toast.error(e instanceof Error ? e.message : "No se pudo cargar la tabla."))
      .finally(() => setCargandoTabla(false));
  }

  const datos = activa ? cache[activa] : null;
  const idCol = datos?.idColumn ?? "";

  const filasFiltradas = useMemo(() => {
    if (!datos) return [];
    const q = query.trim().toLowerCase();
    if (!q) return datos.filas;
    return datos.filas.filter((f) =>
      Object.values(f).some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [datos, query]);

  function toggleIncluir(key: string) {
    setIncluidas((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleFila(key: string, id: string) {
    setSeleccion((prev) => {
      const set = new Set(prev[key] ?? []);
      set.has(id) ? set.delete(id) : set.add(id);
      const next = { ...prev, [key]: set };
      return next;
    });
    // Seleccionar filas incluye la tabla automáticamente.
    setIncluidas((prev) => new Set(prev).add(key));
  }

  function toggleTodasFilas() {
    if (!datos || !activa) return;
    const key = activa;
    const idsVisibles = filasFiltradas.map((f) => String(f[idCol]));
    const actual = seleccion[key] ?? new Set<string>();
    const todasSeleccionadas = idsVisibles.length > 0 && idsVisibles.every((id) => actual.has(id));
    setSeleccion((prev) => {
      const set = new Set(prev[key] ?? []);
      if (todasSeleccionadas) {
        idsVisibles.forEach((id) => set.delete(id));
      } else {
        idsVisibles.forEach((id) => set.add(id));
        setIncluidas((p) => new Set(p).add(key));
      }
      return { ...prev, [key]: set };
    });
  }

  function seleccionarTodasDelGrupo() {
    const keysDelGrupo = tablasDelGrupo.map((t) => t.key);
    const todasIncluidas = keysDelGrupo.length > 0 && keysDelGrupo.every((k) => incluidas.has(k));
    setIncluidas((prev) => {
      const next = new Set(prev);
      keysDelGrupo.forEach((k) => (todasIncluidas ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  // Grupos únicos, en el orden en que el backend los fue mandando (no
  // alfabético — así "General" queda primero, que es lo más usado).
  const grupos = useMemo(() => {
    if (!tablas) return [];
    const vistos = new Set<string>();
    const orden: string[] = [];
    for (const t of tablas) {
      if (!vistos.has(t.grupo)) {
        vistos.add(t.grupo);
        orden.push(t.grupo);
      }
    }
    return orden;
  }, [tablas]);

  const tablasDelGrupo = useMemo(
    () => (tablas ?? []).filter((t) => t.grupo === grupoActivo),
    [tablas, grupoActivo]
  );

  const totalFilasADescargar = useMemo(() => {
    if (!tablas) return 0;
    let total = 0;
    for (const t of tablas) {
      if (!incluidas.has(t.key)) continue;
      const sel = seleccion[t.key];
      total += sel && sel.size > 0 ? sel.size : t.totalFilas;
    }
    return total;
  }, [tablas, incluidas, seleccion]);

  async function handleDescargar() {
    if (incluidas.size === 0) {
      toast.error("Selecciona al menos una tabla para descargar.");
      return;
    }
    const payload: ExportSeleccion[] = Array.from(incluidas).map((key) => {
      const sel = seleccion[key];
      return { key, ids: sel && sel.size > 0 ? Array.from(sel) : undefined };
    });
    setDescargando(true);
    try {
      await exportarBD(payload);
      toast.success("Excel generado y descargado.");
    } catch (e) {
      toast.error(e instanceof PreviewApiError ? e.message : "No se pudo generar el Excel.");
    } finally {
      setDescargando(false);
    }
  }

  if (tablas === null && !error) return <Spinner label="Cargando base de datos..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const idsSeleccionadasActiva = activa ? seleccion[activa] ?? new Set<string>() : new Set<string>();
  const todasVisiblesSeleccionadas =
    filasFiltradas.length > 0 && filasFiltradas.every((f) => idsSeleccionadasActiva.has(String(f[idCol])));

  return (
    <div>
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-900">
            <Database size={22} className="text-brand-600" /> Base de Datos
          </h1>
          <p className="text-sm text-ink-500">
            Descarga las tablas en Excel — cada tabla es una hoja. Elige tablas y filas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="whitespace-nowrap text-xs text-ink-500">
            {incluidas.size} tabla{incluidas.size !== 1 ? "s" : ""} · {totalFilasADescargar} filas
          </span>
          <button
            onClick={handleDescargar}
            disabled={descargando || incluidas.size === 0}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {descargando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {descargando ? "Generando..." : "Descargar Excel"}
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Lista de tablas, agrupada por categoría con un selector arriba
            (2026-07-09: "no como listas" — antes era una sola lista plana
            de 10 tablas mezclando lo general con lo de PMI). */}
        <div className="flex max-h-[72vh] flex-col rounded-xl border border-ink-200 bg-white">
          <div className="flex gap-1 border-b border-ink-100 p-2">
            {grupos.map((g) => (
              <button
                key={g}
                onClick={() => setGrupoActivo(g)}
                className={`flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  grupoActivo === g
                    ? "bg-brand-600 text-white"
                    : "bg-ink-50 text-ink-500 hover:bg-ink-100"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <button
            onClick={seleccionarTodasDelGrupo}
            className="flex items-center justify-between border-b border-ink-100 px-4 py-2.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
          >
            <span>{grupoActivo} ({tablasDelGrupo.length})</span>
            <span className="text-ink-400">
              {tablasDelGrupo.length > 0 && tablasDelGrupo.every((t) => incluidas.has(t.key))
                ? "Quitar todas"
                : "Incluir todas"}
            </span>
          </button>
          <div className="overflow-auto">
            {tablasDelGrupo.map((t) => {
              const incluida = incluidas.has(t.key);
              const sel = seleccion[t.key];
              const nSel = sel?.size ?? 0;
              return (
                <div
                  key={t.key}
                  className={`flex items-center gap-2.5 border-b border-ink-50 px-3 py-2.5 ${
                    activa === t.key ? "bg-brand-50" : "hover:bg-ink-50/60"
                  }`}
                >
                  <button
                    onClick={() => toggleIncluir(t.key)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      incluida ? "border-brand-600 bg-brand-600 text-white" : "border-ink-300"
                    }`}
                    title="Incluir en la descarga"
                  >
                    {incluida && <Check size={11} strokeWidth={3} />}
                  </button>
                  <button onClick={() => abrirTabla(t.key)} className="flex flex-1 flex-col items-start text-left">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-ink-800">
                      <Table2 size={13} className="text-ink-400" /> {t.label}
                    </span>
                    <span className="text-[11px] text-ink-400">
                      {t.totalFilas} filas{nSel > 0 ? ` · ${nSel} seleccionadas` : incluida ? " · todas" : ""}
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grid de la tabla activa. min-w-0 es necesario: sin esto, un hijo
            de grid con contenido ancho (la tabla, hasta 14 columnas) no se
            encoge y empuja toda la página más allá del viewport en vez de
            scrollear solo aquí adentro. */}
        <div className="flex min-w-0 max-h-[72vh] flex-col rounded-xl border border-ink-200 bg-white">
          {!activa || cargandoTabla ? (
            <div className="flex flex-1 items-center justify-center py-16">
              {cargandoTabla ? <Spinner label="Cargando filas..." /> : <p className="text-sm text-ink-400">Selecciona una tabla.</p>}
            </div>
          ) : datos ? (
            <>
              <div className="flex items-center gap-3 border-b border-ink-200 p-3">
                <div className="relative flex-1">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={`Filtrar en ${datos.label}...`}
                    className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
                  />
                </div>
                <span className="whitespace-nowrap text-xs text-ink-500">
                  {filasFiltradas.length} de {datos.totalFilas}
                  {idsSeleccionadasActiva.size > 0 && ` · ${idsSeleccionadasActiva.size} sel.`}
                </span>
              </div>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-ink-50 text-left font-semibold uppercase text-ink-500">
                    <tr>
                      <th className="w-9 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={todasVisiblesSeleccionadas}
                          onChange={toggleTodasFilas}
                          className="h-3.5 w-3.5 accent-brand-600"
                        />
                      </th>
                      {datos.columnas.map((c) => (
                        <th key={c} className="whitespace-nowrap px-3 py-2">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {filasFiltradas.map((fila, i) => {
                      const id = String(fila[idCol]);
                      const seleccionada = idsSeleccionadasActiva.has(id);
                      return (
                        <tr key={id || i} className={seleccionada ? "bg-brand-50/50" : "hover:bg-ink-50/60"}>
                          <td className="px-3 py-1.5">
                            <input
                              type="checkbox"
                              checked={seleccionada}
                              onChange={() => toggleFila(activa!, id)}
                              className="h-3.5 w-3.5 accent-brand-600"
                            />
                          </td>
                          {datos.columnas.map((c) => (
                            <td
                              key={c}
                              className="max-w-[220px] truncate whitespace-nowrap px-3 py-1.5 text-ink-700"
                              title={String(fila[c] ?? "")}
                            >
                              {fila[c] === null || fila[c] === "" ? (
                                <span className="text-ink-300">—</span>
                              ) : (
                                String(fila[c])
                              )}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                    {filasFiltradas.length === 0 && (
                      <tr>
                        <td colSpan={datos.columnas.length + 1} className="px-3 py-6 text-center text-ink-400">
                          Sin resultados para "{query}".
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

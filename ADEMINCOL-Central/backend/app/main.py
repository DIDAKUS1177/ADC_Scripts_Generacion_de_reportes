"""
Backend de PREVIEW (temporal) — lee datos reales de Google Sheets sin base de
datos ni autenticación, genera el reporte MT real con openpyxl (asíncrono,
con progreso) y administra usuarios/OTs contra la BD temporal en Sheets
(decisión D11). NO usar en producción — no hay auth ni caché. Se reemplaza
por el backend real de las Fases 2-4 (docs/).
"""
import logging
import threading
import uuid
from datetime import datetime

import bcrypt
from fastapi import Body, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from .report_engine_mt import generar_reporte_mt
from .report_engine_pmi import calcular_ce, generar_reporte_pmi
from .report_engine_570 import SECTIONS_CONFIG as SECTIONS_CONFIG_570, generar_reporte_570
from .report_engine_510 import SECTIONS_CONFIG as SECTIONS_CONFIG_510, generar_reporte_510
from .sheets_client import (
    BD_SPREADSHEET_ID,
    HOJA_570_GENERAL,
    HOJA_510_GENERAL,
    MT_SPREADSHEET_ID,
    PMI_SPREADSHEET_ID,
    SHEET_570_ID,
    SHEET_510_DATOS_ID,
    SHEET_510_FOTOS_ID,
    append_row,
    read_sheet_as_dicts,
    update_cell_by_key,
    delete_rows_by_key,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("preview")

app = FastAPI(title="ADEMINCOL Central — Preview API (temporal)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:5173"],
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["*"],
)

# Jobs de generación en memoria: {job_id: {estado, pct, etapa, error, archivo, nombre}}
JOBS: dict[str, dict] = {}


@app.get("/health")
def health():
    return {"status": "ok"}


# =====================================================================
# Inspecciones MT (lectura del Sheet real)
# =====================================================================

@app.get("/api/preview/mt")
def list_mt_inspections():
    try:
        rows = read_sheet_as_dicts(MT_SPREADSHEET_ID, "2.general_particulas_magneticas")
    except Exception as e:
        logger.exception("Error leyendo hoja general de MT")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de MT: {e}")

    items = []
    for row in rows:
        id_informe = row.get("id_informe", "").strip()
        if not id_informe:
            continue
        link_reporte = row.get("link_reporte", "").strip()
        items.append(
            {
                "id": id_informe,
                "reportType": "MT",
                "idInforme": id_informe,
                "cliente": row.get("cliente") or None,
                "fecha": row.get("fecha_actividad") or None,
                "reporteN": row.get("reporte_n") or None,
                "workOrderId": None,
                "workOrderNumero": row.get("ot") or None,
                "estadoReporte": "GENERADO" if link_reporte else "PENDIENTE",
                "syncedAt": None,
                "sistema": row.get("sistema") or None,
                "inspector": row.get("nombre") or None,
            }
        )
    return items


def _cargar_datos_mt(id_informe: str):
    generales = read_sheet_as_dicts(MT_SPREADSHEET_ID, "2.general_particulas_magneticas")
    resultados = read_sheet_as_dicts(MT_SPREADSHEET_ID, "3.resultados_inspeccion")
    indicaciones = read_sheet_as_dicts(MT_SPREADSHEET_ID, "5.indicaciones")
    calidad = read_sheet_as_dicts(MT_SPREADSHEET_ID, "4.2.reg_calidad")
    fotos_resultado = read_sheet_as_dicts(MT_SPREADSHEET_ID, "4.reg_fotografico")

    fila_general = next(
        (r for r in generales if r.get("id_informe", "").strip() == id_informe), None
    )
    if not fila_general:
        raise HTTPException(status_code=404, detail=f"No existe el informe {id_informe}")

    filas_resultado = [r for r in resultados if r.get("id_informe_fk", "").strip() == id_informe]

    fotos = []
    for f in calidad:
        if f.get("id_general", "").strip() == id_informe:
            url = (f.get("link") or f.get("imagen") or "").strip()
            if url:
                fotos.append({"url": url, "descripcion": f.get("descripcion", "")})

    ids_resultado = {r.get("id_resultado", "").strip() for r in filas_resultado}
    for f in fotos_resultado:
        if f.get("id_resultado_fk", "").strip() in ids_resultado:
            url = (f.get("link") or f.get("imagen") or "").strip()
            if url:
                fotos.append({"url": url, "descripcion": f.get("descripcion", "")})

    return fila_general, filas_resultado, indicaciones, fotos


@app.get("/api/preview/mt/{id_informe}")
def get_mt_inspection_detail(id_informe: str):
    try:
        fila_general, filas_resultado, indicaciones, fotos = _cargar_datos_mt(id_informe)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error leyendo hojas de MT")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de MT: {e}")

    resultados_out = []
    indicaciones_out = []
    for r in filas_resultado:
        id_resultado = r.get("id_resultado", "").strip()
        resultados_out.append(
            {
                "item": r.get("item"),
                "identificacion": r.get("identificacion"),
                "evaluacion": r.get("evaluacion"),
                "observaciones": r.get("observaciones"),
            }
        )
        for ind in indicaciones:
            if ind.get("id_resultado", "").strip() == id_resultado:
                indicaciones_out.append(
                    {
                        "id_resultado": r.get("item"),
                        "tipo": ind.get("tipo"),
                        "long": ind.get("long"),
                    }
                )

    link_reporte = fila_general.get("link_reporte", "").strip()

    return {
        "id": id_informe,
        "reportType": "MT",
        "idInforme": id_informe,
        "cliente": fila_general.get("cliente") or None,
        "fecha": fila_general.get("fecha_actividad") or None,
        "reporteN": fila_general.get("reporte_n") or None,
        "workOrderId": None,
        "workOrderNumero": fila_general.get("ot") or None,
        "estadoReporte": "GENERADO" if link_reporte else "PENDIENTE",
        "syncedAt": None,
        "datosGenerales": {
            "cliente": fila_general.get("cliente"),
            "contrato": fila_general.get("contrato"),
            "ot": fila_general.get("ot"),
            "fecha_actividad": fila_general.get("fecha_actividad"),
            "zona": fila_general.get("zona"),
            "sistema": fila_general.get("sistema"),
            "material": fila_general.get("material"),
            "espesor": fila_general.get("espesor"),
            "diametro": fila_general.get("diametro"),
            "procedimiento_n": fila_general.get("procedimiento_n"),
            "tecnica_magnetizacion": fila_general.get("tecnica_magnetizacion"),
            "certificado": fila_general.get("certificado"),
            "observaciones": fila_general.get("observaciones"),
            "inspector": fila_general.get("nombre"),
        },
        "resultados": resultados_out,
        "indicaciones": indicaciones_out,
        "fotos": fotos,
        "historialReportes": [],
    }


# =====================================================================
# Generación de reportes: asíncrona con barra de progreso
# =====================================================================

# Campos de datosGenerales editables desde la UI → nombre real de columna del Sheet
CAMPOS_EDITABLES = {
    "cliente": "cliente", "contrato": "contrato", "ot": "ot",
    "fecha_actividad": "fecha_actividad", "zona": "zona", "sistema": "sistema",
    "material": "material", "espesor": "espesor", "diametro": "diametro",
    "procedimiento_n": "procedimiento_n", "tecnica_magnetizacion": "tecnica_magnetizacion",
    "certificado": "certificado", "observaciones": "observaciones", "inspector": "nombre",
}


def _normalizar_nombre(nombre: str) -> str:
    return " ".join(str(nombre or "").strip().lower().split())


def _buscar_firma_usuario(nombre_inspector: str) -> str | None:
    """Prioridad 1 de firma (ver decisión D8): busca en la BD de usuarios
    (hoja `usuarios`, columna `firma` en base64, capturada desde el perfil
    con SignaturePad) un usuario cuyo nombre coincida con el inspector del
    informe. Si no hay match o no tiene firma, se devuelve None y el motor
    usa el fallback (firma_link del Sheet de MT).

    Match tolerante: los nombres casi nunca son idénticos entre el Sheet de
    MT y la BD de usuarios (confirmado con datos reales — "Diego Alejandro
    Hernandez" en BD vs "Diego Alejandro Hernandez Blanco" en el informe).
    Se hace match si el conjunto de palabras del nombre más corto está
    completamente contenido en el más largo (evita falsos positivos de
    coincidencias parciales de una sola palabra)."""
    if not nombre_inspector:
        return None
    try:
        usuarios = read_sheet_as_dicts(BD_SPREADSHEET_ID, "usuarios")
    except Exception:
        logger.warning("No se pudo consultar la BD de usuarios para buscar firma")
        return None

    palabras_objetivo = set(_normalizar_nombre(nombre_inspector).split())
    if not palabras_objetivo:
        return None

    for u in usuarios:
        firma = (u.get("firma") or "").strip()
        if not firma:
            continue
        palabras_bd = set(_normalizar_nombre(u.get("nombre", "")).split())
        if not palabras_bd:
            continue
        corta, larga = (palabras_bd, palabras_objetivo) if len(palabras_bd) <= len(palabras_objetivo) else (palabras_objetivo, palabras_bd)
        if len(corta) >= 2 and corta.issubset(larga):
            return firma
    return None


def _job_generar(job_id: str, id_informe: str, overrides: dict):
    job = JOBS[job_id]
    try:
        job.update(pct=2, etapa="Leyendo datos del Sheet")
        fila_general, filas_resultado, indicaciones, fotos = _cargar_datos_mt(id_informe)

        # Aplicar los cambios que el usuario hizo en el visualizador
        for campo_ui, valor in (overrides or {}).items():
            columna = CAMPOS_EDITABLES.get(campo_ui)
            if columna is not None and valor is not None:
                fila_general[columna] = valor

        # Firma: prioridad a la firma real capturada en el perfil (BD usuarios)
        # sobre la firma_link que trae el Sheet de MT (ver decisión D8).
        firma_bd = _buscar_firma_usuario(fila_general.get("nombre", ""))
        if firma_bd:
            fila_general["firma_link"] = firma_bd

        # Advertencia (reunión 2026-07-03): avisar si el inspector que firma
        # el informe no tiene certificado registrado para esta técnica. NO
        # bloquea la generación — solo informa.
        warnings = []
        inspector_nombre = fila_general.get("nombre", "")
        if inspector_nombre and not _tiene_certificado_para_tecnica(inspector_nombre, "MT"):
            warnings.append(
                f"El inspector '{inspector_nombre}' no tiene un certificado de MT registrado."
            )

        def progreso(pct: int, etapa: str):
            job.update(pct=pct, etapa=etapa)

        contenido = generar_reporte_mt(
            fila_general, filas_resultado, indicaciones, fotos, progreso=progreso
        )
        job.update(
            estado="DONE", pct=100, etapa="Completado",
            archivo=contenido, nombre=f"Reporte_MT_{id_informe}.xlsx",
            warnings=warnings,
        )
    except HTTPException as e:
        job.update(estado="ERROR", error=e.detail)
    except Exception as e:
        logger.exception("Error en job de generación %s", job_id)
        job.update(estado="ERROR", error=str(e))


@app.post("/api/preview/mt/{id_informe}/generar-reporte")
def iniciar_generacion(id_informe: str, payload: dict = Body(default={})):
    overrides = payload.get("overrides", {})
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"estado": "RUNNING", "pct": 0, "etapa": "Iniciando", "error": None,
                    "archivo": None, "nombre": None, "warnings": []}
    thread = threading.Thread(target=_job_generar, args=(job_id, id_informe, overrides), daemon=True)
    thread.start()
    return {"jobId": job_id}


@app.get("/api/preview/jobs/{job_id}")
def estado_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return {
        "estado": job["estado"], "pct": job["pct"], "etapa": job["etapa"], "error": job["error"],
        "warnings": job.get("warnings", []),
    }


@app.get("/api/preview/jobs/{job_id}/descargar")
def descargar_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    if job["estado"] != "DONE" or not job["archivo"]:
        raise HTTPException(status_code=409, detail="El reporte aún no está listo")
    return Response(
        content=job["archivo"],
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{job["nombre"]}"'},
    )


# =====================================================================
# Inspecciones PMI — Caracterización de Materiales (lectura del Sheet real)
# =====================================================================

@app.get("/api/preview/pmi")
def list_pmi_inspections():
    try:
        rows = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "1_general")
    except Exception as e:
        logger.exception("Error leyendo hoja general de PMI")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de PMI: {e}")

    items = []
    for row in rows:
        id_general = row.get("id_general", "").strip()
        if not id_general:
            continue
        link_reporte = row.get("link_reporte", "").strip()
        items.append(
            {
                "id": id_general,
                "reportType": "PMI",
                "idInforme": id_general,
                "cliente": row.get("cliente") or None,
                "fecha": row.get("fecha") or None,
                "reporteN": row.get("n_reporte") or None,
                "workOrderId": None,
                "workOrderNumero": row.get("ot") or None,
                "estadoReporte": "GENERADO" if link_reporte else "PENDIENTE",
                "syncedAt": None,
                "sistema": row.get("sistema") or None,
                "inspector": row.get("nombre") or None,
            }
        )
    return items


def _cargar_datos_pmi(id_general: str):
    generales = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "1_general")
    quimica = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "2_quimica")
    durezas = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "3_durezas")

    fila_general = next(
        (r for r in generales if r.get("id_general", "").strip() == id_general), None
    )
    if not fila_general:
        raise HTTPException(status_code=404, detail=f"No existe el id_general {id_general}")

    filas_quimica = [r for r in quimica if r.get("id_general", "").strip() == id_general]
    filas_durezas = [r for r in durezas if r.get("id_general", "").strip() == id_general]

    # read_sheet_as_dicts normaliza headers a minúsculas; el motor PMI y el
    # cálculo de CE esperan las llaves originales (Elemento, Valor, Dureza,
    # ksi, etc. con mayúsculas) porque así están en MAPEO_GENERAL/2_quimica
    # del script GAS. Se reconstruyen aquí con la capitalización esperada.
    quimica_out = [{"Elemento": r.get("elemento", ""), "Valor": r.get("valor", "")} for r in filas_quimica]
    durezas_out = [{"Dureza": r.get("dureza", ""), "ksi": r.get("ksi", "")} for r in filas_durezas]

    return fila_general, quimica_out, durezas_out


@app.get("/api/preview/pmi/{id_general}")
def get_pmi_inspection_detail(id_general: str):
    try:
        fila_general, quimica, durezas = _cargar_datos_pmi(id_general)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error leyendo hojas de PMI")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de PMI: {e}")

    link_reporte = fila_general.get("link_reporte", "").strip()
    ce = calcular_ce(quimica)

    return {
        "id": id_general,
        "reportType": "PMI",
        "idInforme": id_general,
        "cliente": fila_general.get("cliente") or None,
        "fecha": fila_general.get("fecha") or None,
        "reporteN": fila_general.get("n_reporte") or None,
        "workOrderId": None,
        "workOrderNumero": fila_general.get("ot") or None,
        "estadoReporte": "GENERADO" if link_reporte else "PENDIENTE",
        "syncedAt": None,
        "datosGenerales": {
            "cliente": fila_general.get("cliente"),
            "contrato": fila_general.get("contrato"),
            "ot": fila_general.get("ot"),
            "fecha": fila_general.get("fecha"),
            "sistema": fila_general.get("sistema"),
            "equipo_inspeccionado": fila_general.get("equipo_inspeccionado"),
            "descripcion_componente": fila_general.get("descripcion_componente"),
            "estado_componente": fila_general.get("estado_componente"),
            "material_referencia": fila_general.get("material_referencia"),
            "nps": fila_general.get("nps"),
            "espesor_min_pulg": fila_general.get("espesor_min_pulg"),
            "carbono_equivalente": ce,
            "inspector": fila_general.get("nombre"),
        },
        "quimica": quimica,
        "durezas": durezas,
        "fotos": [
            {"url": fila_general.get(campo, ""), "descripcion": campo}
            for campo in ("link_foto", "link_imagen_2", "link_imagen_3", "link_imagen_4",
                          "link_imagen_5", "link_imagen_6", "link_imagen_7", "link_imagen_8",
                          "link_imagen_9", "link_imagen_10")
            if fila_general.get(campo, "").strip()
        ],
        "historialReportes": [],
    }


def _aplicar_overrides(fila_general: dict, overrides: dict):
    """Aplica los cambios hechos en el visualizador sobre la fila del Sheet.
    La UI expone 'inspector' pero la columna real se llama 'nombre' — sin
    este mapeo la edición del inspector se ignoraba silenciosamente (bug
    corregido 2026-07-03; MT no lo sufría porque usa CAMPOS_EDITABLES)."""
    alias = {"inspector": "nombre"}
    for campo_ui, valor in (overrides or {}).items():
        columna = alias.get(campo_ui, campo_ui)
        if columna in fila_general and valor is not None:
            fila_general[columna] = valor


def _job_generar_pmi(job_id: str, id_general: str, overrides: dict):
    job = JOBS[job_id]
    try:
        job.update(pct=2, etapa="Leyendo datos del Sheet")
        fila_general, quimica, durezas = _cargar_datos_pmi(id_general)

        _aplicar_overrides(fila_general, overrides)

        firma_bd = _buscar_firma_usuario(fila_general.get("nombre", ""))
        if firma_bd:
            fila_general["link_firma"] = firma_bd

        warnings = []
        inspector_nombre = fila_general.get("nombre", "")
        if inspector_nombre and not _tiene_certificado_para_tecnica(inspector_nombre, "PMI"):
            warnings.append(
                f"El inspector '{inspector_nombre}' no tiene un certificado de PMI registrado."
            )

        def progreso(pct: int, etapa: str):
            job.update(pct=pct, etapa=etapa)

        contenido = generar_reporte_pmi(fila_general, quimica, durezas, progreso=progreso)
        job.update(
            estado="DONE", pct=100, etapa="Completado",
            archivo=contenido, nombre=f"Reporte_PMI_{id_general}.xlsx",
            warnings=warnings,
        )
    except HTTPException as e:
        job.update(estado="ERROR", error=e.detail)
    except Exception as e:
        logger.exception("Error en job de generación PMI %s", job_id)
        job.update(estado="ERROR", error=str(e))


@app.post("/api/preview/pmi/{id_general}/generar-reporte")
def iniciar_generacion_pmi(id_general: str, payload: dict = Body(default={})):
    overrides = payload.get("overrides", {})
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"estado": "RUNNING", "pct": 0, "etapa": "Iniciando", "error": None,
                    "archivo": None, "nombre": None, "warnings": []}
    thread = threading.Thread(target=_job_generar_pmi, args=(job_id, id_general, overrides), daemon=True)
    thread.start()
    return {"jobId": job_id}


# =====================================================================
# Inspecciones API 570 (Inspección Visual de Tubería) — lectura del Sheet
# real. NO pasa por el modelo OT/Servicio: el campo `ot` de la hoja general
# es texto libre (nunca fue una FK, ni en el script GAS original) — no se
# exige crear una OT antes de generar un reporte 570 (decisión 2026-07-03).
# =====================================================================

@app.get("/api/preview/570")
def list_570_inspections():
    try:
        rows = read_sheet_as_dicts(SHEET_570_ID, HOJA_570_GENERAL)
    except Exception as e:
        logger.exception("Error leyendo hoja general de 570")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de 570: {e}")

    items = []
    for row in rows:
        id_api570 = row.get("id_api570", "").strip()
        if not id_api570:
            continue
        link_reporte = row.get("linkreporte", "").strip()
        items.append(
            {
                "id": id_api570,
                "reportType": "570",
                "idInforme": id_api570,
                "cliente": row.get("cliente") or None,
                "fecha": row.get("fecha") or None,
                "reporteN": row.get("consecutivo") or None,
                "workOrderId": None,
                "workOrderNumero": row.get("ot") or None,
                "estadoReporte": "GENERADO" if link_reporte.startswith("http") else "PENDIENTE",
                "syncedAt": None,
                "sistema": row.get("sistema") or None,
                "inspector": row.get("nombre") or None,
            }
        )
    return items


def _cargar_datos_570(id_api570: str):
    generales = read_sheet_as_dicts(SHEET_570_ID, HOJA_570_GENERAL)
    fila_general = next(
        (r for r in generales if r.get("id_api570", "").strip() == id_api570), None
    )
    if not fila_general:
        raise HTTPException(status_code=404, detail=f"No existe el informe {id_api570}")

    secciones_data: dict[str, list[dict]] = {}
    secciones_fotos: dict[str, list[dict]] = {}
    for key, config in SECTIONS_CONFIG_570.items():
        try:
            filas = read_sheet_as_dicts(SHEET_570_ID, config["sheet"])
        except Exception:
            logger.warning("No se pudo leer la sección %s de 570", config["sheet"])
            filas = []
        secciones_data[key] = [r for r in filas if r.get("id_api570", "").strip() == id_api570]

        try:
            fotos_raw = read_sheet_as_dicts(SHEET_570_ID, config["photo_sheet"])
        except Exception:
            logger.warning("No se pudo leer fotos de la sección %s de 570", config["photo_sheet"])
            fotos_raw = []
        secciones_fotos[key] = [
            {"url": f.get("photo_url", ""), "descripcion": f.get("descripcion", "")}
            for f in fotos_raw
            if f.get("id_api570", "").strip() == id_api570 and f.get("photo_url", "").strip().startswith("http")
        ]

    return fila_general, secciones_data, secciones_fotos


@app.get("/api/preview/570/{id_api570}")
def get_570_inspection_detail(id_api570: str):
    try:
        fila_general, secciones_data, secciones_fotos = _cargar_datos_570(id_api570)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error leyendo hojas de 570")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de 570: {e}")

    link_reporte = fila_general.get("linkreporte", "").strip()
    secciones_resumen = [
        {
            "key": key,
            "sheet": SECTIONS_CONFIG_570[key]["sheet"],
            "registros": len(secciones_data.get(key, [])),
            "fotos": len(secciones_fotos.get(key, [])),
        }
        for key in SECTIONS_CONFIG_570
    ]
    total_fotos = sum(s["fotos"] for s in secciones_resumen)

    return {
        "id": id_api570,
        "reportType": "570",
        "idInforme": id_api570,
        "cliente": fila_general.get("cliente") or None,
        "fecha": fila_general.get("fecha") or None,
        "reporteN": fila_general.get("consecutivo") or None,
        "workOrderId": None,
        "workOrderNumero": fila_general.get("ot") or None,
        "estadoReporte": "GENERADO" if link_reporte.startswith("http") else "PENDIENTE",
        "syncedAt": None,
        "datosGenerales": {
            "cliente": fila_general.get("cliente"),
            "consecutivo": fila_general.get("consecutivo"),
            "fecha": fila_general.get("fecha"),
            "ubicacion": fila_general.get("ubicacion"),
            "ot": fila_general.get("ot"),
            "servicio": fila_general.get("servicio"),
            "codigo_fabricacion": fila_general.get("codigo_fabricacion"),
            "ano_fabricacion": fila_general.get("ano_fabricacion"),
            "sistema": fila_general.get("sistema"),
            "subsistema": fila_general.get("subsistema"),
            "presion_operacion": fila_general.get("presion_operacion"),
            "temperatura_operacion": fila_general.get("temperatura_operacion"),
            "inspector": fila_general.get("nombre"),
            "cargo": fila_general.get("cargo"),
            "certificacion": fila_general.get("certificacion"),
        },
        "secciones": secciones_resumen,
        "totalFotos": total_fotos,
        "fotos": [],
        "historialReportes": [],
    }


def _job_generar_570(job_id: str, id_api570: str, overrides: dict):
    job = JOBS[job_id]
    try:
        job.update(pct=2, etapa="Leyendo datos del Sheet")
        fila_general, secciones_data, secciones_fotos = _cargar_datos_570(id_api570)

        _aplicar_overrides(fila_general, overrides)

        firma_bd = _buscar_firma_usuario(fila_general.get("nombre", ""))
        if firma_bd:
            fila_general["link_firma"] = firma_bd

        warnings = []
        inspector_nombre = fila_general.get("nombre", "")
        if inspector_nombre and not _tiene_certificado_para_tecnica(inspector_nombre, "570"):
            warnings.append(
                f"El inspector '{inspector_nombre}' no tiene un certificado de API 570 registrado."
            )

        def progreso(pct: int, etapa: str):
            job.update(pct=pct, etapa=etapa)

        contenido = generar_reporte_570(fila_general, secciones_data, secciones_fotos, progreso=progreso)
        job.update(
            estado="DONE", pct=100, etapa="Completado",
            archivo=contenido, nombre=f"Reporte_570_{id_api570}.xlsx",
            warnings=warnings,
        )
    except HTTPException as e:
        job.update(estado="ERROR", error=e.detail)
    except Exception as e:
        logger.exception("Error en job de generación 570 %s", job_id)
        job.update(estado="ERROR", error=str(e))


@app.post("/api/preview/570/{id_api570}/generar-reporte")
def iniciar_generacion_570(id_api570: str, payload: dict = Body(default={})):
    overrides = payload.get("overrides", {})
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"estado": "RUNNING", "pct": 0, "etapa": "Iniciando", "error": None,
                    "archivo": None, "nombre": None, "warnings": []}
    thread = threading.Thread(target=_job_generar_570, args=(job_id, id_api570, overrides), daemon=True)
    thread.start()
    return {"jobId": job_id}


# =====================================================================
# Inspecciones API 510 (Inspección Visual de Recipientes a Presión) — igual
# que 570 pero con datos y fotos en DOS spreadsheets separados. Tampoco pasa
# por el modelo OT/Servicio (mismo criterio que 570).
# =====================================================================

@app.get("/api/preview/510")
def list_510_inspections():
    try:
        rows = read_sheet_as_dicts(SHEET_510_DATOS_ID, HOJA_510_GENERAL)
    except Exception as e:
        logger.exception("Error leyendo hoja general de 510")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de 510: {e}")

    items = []
    for row in rows:
        pvid = row.get("pvid", "").strip()
        if not pvid:
            continue
        link_reporte = row.get("linkreporte", "").strip()
        items.append(
            {
                "id": pvid,
                "reportType": "510",
                "idInforme": pvid,
                "cliente": row.get("cliente") or None,
                "fecha": row.get("fechainsp") or None,
                "reporteN": row.get("consecutivo") or None,
                "workOrderId": None,
                "workOrderNumero": row.get("ot") or None,
                "estadoReporte": "GENERADO" if link_reporte.startswith("http") else "PENDIENTE",
                "syncedAt": None,
                "sistema": row.get("tag") or None,
                "inspector": row.get("nombre") or None,
            }
        )
    return items


def _cargar_datos_510(pvid: str):
    generales = read_sheet_as_dicts(SHEET_510_DATOS_ID, HOJA_510_GENERAL)
    fila_general = next(
        (r for r in generales if r.get("pvid", "").strip() == pvid), None
    )
    if not fila_general:
        raise HTTPException(status_code=404, detail=f"No existe el informe {pvid}")

    secciones_data: dict[str, list[dict]] = {}
    secciones_fotos: dict[str, list[dict]] = {}
    for key, config in SECTIONS_CONFIG_510.items():
        try:
            filas = read_sheet_as_dicts(SHEET_510_DATOS_ID, config["sheet"])
        except Exception:
            logger.warning("No se pudo leer la sección %s de 510", config["sheet"])
            filas = []
        secciones_data[key] = [r for r in filas if r.get("pvid", "").strip() == pvid]

        try:
            fotos_raw = read_sheet_as_dicts(SHEET_510_FOTOS_ID, config["photo_sheet"])
        except Exception:
            logger.warning("No se pudo leer fotos de la sección %s de 510", config["photo_sheet"])
            fotos_raw = []
        link_col = config["photo_link_col"].lower()
        secciones_fotos[key] = [
            {"url": f.get(link_col, ""), "descripcion": f.get("descripccion", "")}
            for f in fotos_raw
            if f.get("pvid", "").strip() == pvid and f.get(link_col, "").strip().startswith("http")
        ]

    return fila_general, secciones_data, secciones_fotos


@app.get("/api/preview/510/{pvid}")
def get_510_inspection_detail(pvid: str):
    try:
        fila_general, secciones_data, secciones_fotos = _cargar_datos_510(pvid)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error leyendo hojas de 510")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de 510: {e}")

    link_reporte = fila_general.get("linkreporte", "").strip()
    secciones_resumen = [
        {
            "key": key,
            "sheet": SECTIONS_CONFIG_510[key]["sheet"],
            "registros": len(secciones_data.get(key, [])),
            "fotos": len(secciones_fotos.get(key, [])),
        }
        for key in SECTIONS_CONFIG_510
    ]
    total_fotos = sum(s["fotos"] for s in secciones_resumen)

    return {
        "id": pvid,
        "reportType": "510",
        "idInforme": pvid,
        "cliente": fila_general.get("cliente") or None,
        "fecha": fila_general.get("fechainsp") or None,
        "reporteN": fila_general.get("consecutivo") or None,
        "workOrderId": None,
        "workOrderNumero": fila_general.get("ot") or None,
        "estadoReporte": "GENERADO" if link_reporte.startswith("http") else "PENDIENTE",
        "syncedAt": None,
        "datosGenerales": {
            "cliente": fila_general.get("cliente"),
            "consecutivo": fila_general.get("consecutivo"),
            "fechainsp": fila_general.get("fechainsp"),
            "ubicación": fila_general.get("ubicación"),
            "tag": fila_general.get("tag"),
            "servicio": fila_general.get("servicio"),
            "fabricante": fila_general.get("fabricante"),
            "yearfabrication": fila_general.get("yearfabrication"),
            "mawp": fila_general.get("mawp"),
            "designtemp": fila_general.get("designtemp"),
            "matcuerpo": fila_general.get("matcuerpo"),
            "capacidad": fila_general.get("capacidad"),
            "inspector": fila_general.get("nombre"),
        },
        "secciones": secciones_resumen,
        "totalFotos": total_fotos,
        "fotos": [],
        "historialReportes": [],
    }


def _job_generar_510(job_id: str, pvid: str, overrides: dict):
    job = JOBS[job_id]
    try:
        job.update(pct=2, etapa="Leyendo datos del Sheet")
        fila_general, secciones_data, secciones_fotos = _cargar_datos_510(pvid)

        _aplicar_overrides(fila_general, overrides)

        firma_bd = _buscar_firma_usuario(fila_general.get("nombre", ""))
        if firma_bd:
            fila_general["link_firma"] = firma_bd

        warnings = []
        inspector_nombre = fila_general.get("nombre", "")
        if inspector_nombre and not _tiene_certificado_para_tecnica(inspector_nombre, "510"):
            warnings.append(
                f"El inspector '{inspector_nombre}' no tiene un certificado de API 510 registrado."
            )

        def progreso(pct: int, etapa: str):
            job.update(pct=pct, etapa=etapa)

        contenido = generar_reporte_510(fila_general, secciones_data, secciones_fotos, progreso=progreso)
        job.update(
            estado="DONE", pct=100, etapa="Completado",
            archivo=contenido, nombre=f"Reporte_510_{pvid}.xlsx",
            warnings=warnings,
        )
    except HTTPException as e:
        job.update(estado="ERROR", error=e.detail)
    except Exception as e:
        logger.exception("Error en job de generación 510 %s", job_id)
        job.update(estado="ERROR", error=str(e))


@app.post("/api/preview/510/{pvid}/generar-reporte")
def iniciar_generacion_510(pvid: str, payload: dict = Body(default={})):
    overrides = payload.get("overrides", {})
    job_id = uuid.uuid4().hex
    JOBS[job_id] = {"estado": "RUNNING", "pct": 0, "etapa": "Iniciando", "error": None,
                    "archivo": None, "nombre": None, "warnings": []}
    thread = threading.Thread(target=_job_generar_510, args=(job_id, pvid, overrides), daemon=True)
    thread.start()
    return {"jobId": job_id}


# =====================================================================
# Usuarios y OTs — BD temporal en Sheets (decisión D11)
# =====================================================================

@app.get("/api/preview/usuarios")
def list_usuarios():
    try:
        rows = read_sheet_as_dicts(BD_SPREADSHEET_ID, "usuarios")
    except Exception as e:
        logger.exception("Error leyendo hoja usuarios")
        raise HTTPException(status_code=502, detail=f"No se pudo leer la BD de usuarios: {e}")

    out = []
    for r in rows:
        if not r.get("usuario", "").strip():
            continue
        out.append(
            {
                "idUsuario": r.get("id_usuario"),
                "nombre": r.get("nombre"),
                "usuario": r.get("usuario"),
                "correo": r.get("correo") or None,
                "rol": r.get("rol"),
                "cargo": r.get("cargo") or None,
                "certificado": r.get("certificado") or None,
                "tieneFirma": bool((r.get("firma_link") or r.get("firma") or "").strip()),
                "activo": str(r.get("activo", "")).strip().upper() in ("TRUE", "VERDADERO", "SÍ", "SI", "1"),
                "createdAt": r.get("created_at") or None,
            }
        )
    return out


@app.post("/api/preview/usuarios")
def crear_usuario(payload: dict = Body(...)):
    requeridos = ["nombre", "usuario", "password", "rol"]
    faltantes = [c for c in requeridos if not str(payload.get(c, "")).strip()]
    if faltantes:
        raise HTTPException(status_code=422, detail=f"Campos requeridos: {', '.join(faltantes)}")
    if payload["rol"] not in ("ADMINISTRADOR", "SUPERVISOR", "INSPECTOR"):
        raise HTTPException(status_code=422, detail="Rol inválido")

    try:
        existentes = read_sheet_as_dicts(BD_SPREADSHEET_ID, "usuarios")
        if any(r.get("usuario", "").strip() == payload["usuario"].strip() for r in existentes):
            raise HTTPException(status_code=409, detail=f"El usuario '{payload['usuario']}' ya existe")

        password_hash = bcrypt.hashpw(
            payload["password"].encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

        n = len([r for r in existentes if r.get("id_usuario", "").strip()]) + 1
        append_row(
            BD_SPREADSHEET_ID,
            "usuarios",
            {
                "id_usuario": f"U-{n:03d}",
                "nombre": payload["nombre"].strip(),
                "usuario": payload["usuario"].strip(),
                "password_hash": password_hash,
                "correo": payload.get("correo", "").strip(),
                "rol": payload["rol"],
                "cargo": payload.get("cargo", "").strip(),
                "certificado": payload.get("certificado", "").strip(),
                "activo": "TRUE",
                "created_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creando usuario")
        raise HTTPException(status_code=502, detail=f"No se pudo escribir en la BD: {e}")
    return {"ok": True}


@app.patch("/api/preview/usuarios/{usuario}/activo")
def toggle_usuario_activo(usuario: str, payload: dict = Body(...)):
    nuevo = "TRUE" if payload.get("activo") else "FALSE"
    try:
        ok = update_cell_by_key(BD_SPREADSHEET_ID, "usuarios", "usuario", usuario, "activo", nuevo)
    except Exception as e:
        logger.exception("Error actualizando usuario")
        raise HTTPException(status_code=502, detail=f"No se pudo actualizar: {e}")
    if not ok:
        raise HTTPException(status_code=404, detail=f"Usuario '{usuario}' no encontrado")
    return {"ok": True}


@app.patch("/api/preview/usuarios/{usuario}/firma")
def update_usuario_firma(usuario: str, payload: dict = Body(...)):
    firma_base64 = payload.get("firmaBase64")
    if not firma_base64:
        raise HTTPException(status_code=422, detail="firmaBase64 es requerido")
    try:
        ok = update_cell_by_key(BD_SPREADSHEET_ID, "usuarios", "usuario", usuario, "firma", firma_base64)
    except Exception as e:
        logger.exception("Error actualizando firma de usuario")
        raise HTTPException(status_code=502, detail=f"No se pudo actualizar: {e}")
    if not ok:
        raise HTTPException(status_code=404, detail=f"Usuario '{usuario}' no encontrado")
    return {"ok": True}

@app.get("/api/preview/usuarios/{usuario}/certificados")
def list_usuario_certificados(usuario: str):
    try:
        rows = read_sheet_as_dicts(BD_SPREADSHEET_ID, "certificados_usuarios")
    except Exception as e:
        logger.exception("Error leyendo certificados")
        raise HTTPException(status_code=502, detail=f"No se pudo leer la BD: {e}")

    out = []
    for r in rows:
        if str(r.get("usuario", "")).strip() == usuario:
            out.append({
                "idCertificado": r.get("id_certificado"),
                "usuario": r.get("usuario"),
                "tecnica": r.get("tecnica") or None,
                "nombreCertificado": r.get("nombre_certificado"),
                "entidadEmisora": r.get("entidad_emisora"),
                "fechaEmision": r.get("fecha_emision"),
                "fechaVencimiento": r.get("fecha_vencimiento"),
                "linkPdf": r.get("link_pdf"),
                "createdAt": r.get("created_at"),
            })
    return out

@app.patch("/api/preview/usuarios/{usuario}/certificados")
def update_usuario_certificados(usuario: str, payload: dict = Body(...)):
    certificados = payload.get("certificados", [])
    for c in certificados:
        if not str(c.get("tecnica", "")).strip():
            raise HTTPException(
                status_code=422,
                detail="Cada certificado debe indicar a qué técnica corresponde (MT, PMI...).",
            )
    try:
        delete_rows_by_key(BD_SPREADSHEET_ID, "certificados_usuarios", "usuario", usuario)
        for c in certificados:
            append_row(
                BD_SPREADSHEET_ID,
                "certificados_usuarios",
                {
                    "id_certificado": c.get("idCertificado") or uuid.uuid4().hex[:8].upper(),
                    "usuario": usuario,
                    "tecnica": c.get("tecnica", "").strip(),
                    "nombre_certificado": c.get("nombreCertificado", "").strip(),
                    "entidad_emisora": c.get("entidadEmisora", "").strip(),
                    "fecha_emision": c.get("fechaEmision", "").strip(),
                    "fecha_vencimiento": c.get("fechaVencimiento", "").strip(),
                    "link_pdf": c.get("linkPdf", "").strip(),
                    "created_at": c.get("createdAt") or datetime.now().isoformat(timespec="seconds")
                }
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error actualizando certificados")
        raise HTTPException(status_code=502, detail=f"Error actualizando en BD: {e}")

    return {"ok": True}


def _tiene_certificado_para_tecnica(usuario_nombre: str, tecnica: str) -> bool:
    """Usado al generar reportes para la advertencia de 'inspector sin
    certificado' (ver decisión de la reunión 2026-07-03). Busca el usuario
    por nombre (match tolerante, igual que _buscar_firma_usuario) y revisa
    si tiene al menos un certificado registrado para esa técnica."""
    try:
        usuarios = read_sheet_as_dicts(BD_SPREADSHEET_ID, "usuarios")
        certificados = read_sheet_as_dicts(BD_SPREADSHEET_ID, "certificados_usuarios")
    except Exception:
        logger.warning("No se pudo verificar certificado para advertencia")
        return True  # no bloquear el reporte por un fallo de lectura

    palabras_objetivo = set(_normalizar_nombre(usuario_nombre).split())
    if not palabras_objetivo:
        return True

    usuario_login = None
    for u in usuarios:
        palabras_bd = set(_normalizar_nombre(u.get("nombre", "")).split())
        if not palabras_bd:
            continue
        corta, larga = (
            (palabras_bd, palabras_objetivo)
            if len(palabras_bd) <= len(palabras_objetivo)
            else (palabras_objetivo, palabras_bd)
        )
        if len(corta) >= 2 and corta.issubset(larga):
            usuario_login = u.get("usuario")
            break

    if not usuario_login:
        return False  # ni siquiera existe como usuario registrado

    return any(
        str(c.get("usuario", "")).strip() == usuario_login
        and str(c.get("tecnica", "")).strip().upper() == tecnica.upper()
        for c in certificados
    )


@app.get("/api/preview/ots")
def list_ots():
    try:
        rows = read_sheet_as_dicts(BD_SPREADSHEET_ID, "work_orders")
    except Exception as e:
        logger.exception("Error leyendo hoja work_orders")
        raise HTTPException(status_code=502, detail=f"No se pudo leer la BD de OTs: {e}")

    out = []
    for r in rows:
        if not r.get("numero", "").strip():
            continue
        out.append(
            {
                "idOt": r.get("id_ot"),
                "numero": r.get("numero"),
                "contrato": r.get("contrato") or None,
                "cliente": r.get("cliente") or None,
                "ubicacion": r.get("ubicacion") or None,
                "supervisorUsuario": r.get("supervisor_usuario") or None,
                "fechaInicio": r.get("fecha_inicio") or None,
                "fechaFin": r.get("fecha_fin") or None,
                "estado": r.get("estado") or "PENDIENTE",
                "descripcion": r.get("descripcion") or None,
                "observaciones": r.get("observaciones") or None,
            }
        )
    return out


@app.post("/api/preview/ots")
def crear_ot(payload: dict = Body(...)):
    """El supervisor NUNCA se selecciona manualmente: 'supervisorUsuario' es
    SIEMPRE el usuario que hace la petición (decisión de la reunión
    2026-07-03 — 'el supervisor es el que hace la solicitud'). El backend de
    preview no tiene sesión real, así que el frontend lo envía tomándolo de
    su AuthContext; cuando exista auth de verdad (Fase 2) esto se lee del
    token en vez del payload. No existe 'inspectorUsuario' a nivel de OT: se
    asigna por servicio (ver /api/preview/servicios)."""
    if not str(payload.get("numero", "")).strip():
        raise HTTPException(status_code=422, detail="El número de OT es requerido")
    if not str(payload.get("supervisorUsuario", "")).strip():
        raise HTTPException(status_code=422, detail="Falta el usuario del supervisor solicitante")
    estado = payload.get("estado", "PENDIENTE")
    if estado not in ("PENDIENTE", "EN_CURSO", "COMPLETADA", "CANCELADA"):
        raise HTTPException(status_code=422, detail="Estado inválido")

    try:
        existentes = read_sheet_as_dicts(BD_SPREADSHEET_ID, "work_orders")
        if any(r.get("numero", "").strip() == payload["numero"].strip() for r in existentes):
            raise HTTPException(status_code=409, detail=f"La OT '{payload['numero']}' ya existe")

        n = len([r for r in existentes if r.get("id_ot", "").strip()]) + 1
        id_ot = f"OT-{n:04d}"
        append_row(
            BD_SPREADSHEET_ID,
            "work_orders",
            {
                "id_ot": id_ot,
                "numero": payload["numero"].strip(),
                "contrato": payload.get("contrato", "").strip(),
                "cliente": payload.get("cliente", "").strip(),
                "ubicacion": payload.get("ubicacion", "").strip(),
                "supervisor_usuario": payload["supervisorUsuario"].strip(),
                "fecha_inicio": payload.get("fechaInicio", "").strip(),
                "fecha_fin": payload.get("fechaFin", "").strip(),
                "estado": estado,
                "descripcion": payload.get("descripcion", "").strip(),
                "observaciones": payload.get("observaciones", "").strip(),
                "created_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creando OT")
        raise HTTPException(status_code=502, detail=f"No se pudo escribir en la BD: {e}")
    return {"ok": True, "idOt": id_ot}


# =====================================================================
# Servicios — una técnica (MT, PMI...) dentro de una OT (decisión reunión
# 2026-07-03). Cada servicio tiene su propio id_servicio alfanumérico libre,
# su propio estado, y el inspector se autoasigna (no lo elige el supervisor).
# =====================================================================

@app.get("/api/preview/servicios")
def list_servicios(id_ot: str | None = None):
    try:
        rows = read_sheet_as_dicts(BD_SPREADSHEET_ID, "servicios")
    except Exception as e:
        logger.exception("Error leyendo hoja servicios")
        raise HTTPException(status_code=502, detail=f"No se pudo leer la BD de servicios: {e}")

    out = []
    for r in rows:
        if not r.get("id_servicio", "").strip():
            continue
        if id_ot and r.get("id_ot", "").strip() != id_ot:
            continue
        out.append(
            {
                "idServicio": r.get("id_servicio"),
                "idOt": r.get("id_ot"),
                "tecnica": r.get("tecnica"),
                "estado": r.get("estado") or "PENDIENTE",
                "inspectorUsuario": r.get("inspector_usuario") or None,
                "fechaCreacion": r.get("fecha_creacion") or None,
                "fechaInicio": r.get("fecha_inicio") or None,
                "fechaFin": r.get("fecha_fin") or None,
                "duracionMin": r.get("duracion_min") or None,
                "idInformeGenerado": r.get("id_informe_generado") or None,
            }
        )
    return out


@app.post("/api/preview/servicios")
def crear_servicio(payload: dict = Body(...)):
    id_ot = str(payload.get("idOt", "")).strip()
    tecnica = str(payload.get("tecnica", "")).strip().upper()
    if not id_ot:
        raise HTTPException(status_code=422, detail="Falta idOt")
    if tecnica not in ("MT", "PMI"):
        raise HTTPException(status_code=422, detail="Técnica inválida (debe ser MT o PMI)")

    try:
        ots = read_sheet_as_dicts(BD_SPREADSHEET_ID, "work_orders")
        if not any(r.get("id_ot", "").strip() == id_ot for r in ots):
            raise HTTPException(status_code=404, detail=f"No existe la OT '{id_ot}'")

        id_servicio = f"SRV-{uuid.uuid4().hex[:8].upper()}"
        append_row(
            BD_SPREADSHEET_ID,
            "servicios",
            {
                "id_servicio": id_servicio,
                "id_ot": id_ot,
                "tecnica": tecnica,
                "estado": "PENDIENTE",
                "inspector_usuario": "",  # se autoasigna en AppSheet, no aquí
                "fecha_creacion": datetime.now().isoformat(timespec="seconds"),
                "fecha_inicio": "",
                "fecha_fin": "",
                "duracion_min": "",
                "id_informe_generado": "",
                "created_at": datetime.now().isoformat(timespec="seconds"),
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creando servicio")
        raise HTTPException(status_code=502, detail=f"No se pudo escribir en la BD: {e}")
    return {"ok": True, "idServicio": id_servicio}


# =====================================================================
# Dashboard — agregados reales (reunión 2026-07-03: "mejora ese dashboard,
# ajustado para que el administrador mire los activos, los supervisores
# inspectores"). ADMIN ve todo el negocio (usuarios, OTs, servicios,
# certificados por vencer, reportes por técnica). SUPERVISOR ve sus propias
# OTs/servicios. INSPECTOR ve los servicios que tiene asignados. Reemplaza
# los datos simulados de mock/client.ts en DashboardPage.tsx.
# =====================================================================

def _vencimiento_proximo(fecha_str: str, dias: int = 60) -> bool:
    if not fecha_str:
        return False
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            fecha = datetime.strptime(fecha_str.strip(), fmt)
            return 0 <= (fecha - datetime.now()).days <= dias
        except ValueError:
            continue
    return False


@app.get("/api/preview/dashboard")
def get_dashboard(usuario: str | None = None, rol: str | None = None):
    try:
        usuarios = read_sheet_as_dicts(BD_SPREADSHEET_ID, "usuarios")
        ots = read_sheet_as_dicts(BD_SPREADSHEET_ID, "work_orders")
        servicios = read_sheet_as_dicts(BD_SPREADSHEET_ID, "servicios")
        certificados = read_sheet_as_dicts(BD_SPREADSHEET_ID, "certificados_usuarios")
    except Exception as e:
        logger.exception("Error leyendo BD para dashboard")
        raise HTTPException(status_code=502, detail=f"No se pudo leer la BD: {e}")

    ots = [r for r in ots if r.get("numero", "").strip()]
    servicios = [r for r in servicios if r.get("id_servicio", "").strip()]
    usuarios_activos = [r for r in usuarios if r.get("usuario", "").strip() and str(r.get("activo", "")).strip().upper() in ("TRUE", "VERDADERO", "SÍ", "SI", "1")]

    otsPorEstado: dict[str, int] = {}
    for r in ots:
        estado = r.get("estado") or "PENDIENTE"
        otsPorEstado[estado] = otsPorEstado.get(estado, 0) + 1

    serviciosPorTecnica: dict[str, int] = {}
    serviciosPendientes = 0
    for r in servicios:
        tecnica = r.get("tecnica") or "?"
        serviciosPorTecnica[tecnica] = serviciosPorTecnica.get(tecnica, 0) + 1
        if not r.get("inspector_usuario", "").strip():
            serviciosPendientes += 1

    certificadosPorVencer = [
        {
            "usuario": c.get("usuario"),
            "tecnica": c.get("tecnica"),
            "nombreCertificado": c.get("nombre_certificado"),
            "fechaVencimiento": c.get("fecha_vencimiento"),
        }
        for c in certificados
        if _vencimiento_proximo(c.get("fecha_vencimiento", ""))
    ]

    # Reportes por técnica: reutiliza los endpoints de lectura ya construidos
    # (MT/PMI/570) — cada uno hace UNA lectura de su hoja general.
    reportesPorTipo = {}
    for tipo, fn in (("MT", list_mt_inspections), ("PMI", list_pmi_inspections), ("570", list_570_inspections), ("510", list_510_inspections)):
        try:
            items = fn()
            generados = sum(1 for i in items if i["estadoReporte"] == "GENERADO")
            reportesPorTipo[tipo] = {"total": len(items), "generados": generados, "pendientes": len(items) - generados}
        except Exception:
            reportesPorTipo[tipo] = {"total": 0, "generados": 0, "pendientes": 0}

    data = {
        "usuariosActivos": len(usuarios_activos),
        "otsTotal": len(ots),
        "otsPorEstado": otsPorEstado,
        "serviciosTotal": len(servicios),
        "serviciosPorTecnica": serviciosPorTecnica,
        "serviciosPendientes": serviciosPendientes,
        "certificadosPorVencer": certificadosPorVencer,
        "reportesPorTipo": reportesPorTipo,
    }

    # Recortes personales para supervisor/inspector (si se identifica al usuario)
    if usuario and rol == "SUPERVISOR":
        data["misOts"] = [
            {"idOt": r.get("id_ot"), "numero": r.get("numero"), "cliente": r.get("cliente"), "estado": r.get("estado")}
            for r in ots if r.get("supervisor_usuario", "").strip() == usuario
        ]
        mis_ot_ids = {o["idOt"] for o in data["misOts"]}
        data["misServicios"] = [
            {"idServicio": r.get("id_servicio"), "idOt": r.get("id_ot"), "tecnica": r.get("tecnica"), "estado": r.get("estado")}
            for r in servicios if r.get("id_ot", "").strip() in mis_ot_ids
        ]
    elif usuario and rol == "INSPECTOR":
        data["misServicios"] = [
            {"idServicio": r.get("id_servicio"), "idOt": r.get("id_ot"), "tecnica": r.get("tecnica"), "estado": r.get("estado")}
            for r in servicios if r.get("inspector_usuario", "").strip() == usuario
        ]
        data["misCertificadosPorVencer"] = [c for c in certificadosPorVencer if c["usuario"] == usuario]

    return data

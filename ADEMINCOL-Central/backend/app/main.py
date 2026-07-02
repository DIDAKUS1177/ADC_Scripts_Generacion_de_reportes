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
from .sheets_client import (
    BD_SPREADSHEET_ID,
    MT_SPREADSHEET_ID,
    append_row,
    read_sheet_as_dicts,
    update_cell_by_key,
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

        def progreso(pct: int, etapa: str):
            job.update(pct=pct, etapa=etapa)

        contenido = generar_reporte_mt(
            fila_general, filas_resultado, indicaciones, fotos, progreso=progreso
        )
        job.update(
            estado="DONE", pct=100, etapa="Completado",
            archivo=contenido, nombre=f"Reporte_MT_{id_informe}.xlsx",
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
                    "archivo": None, "nombre": None}
    thread = threading.Thread(target=_job_generar, args=(job_id, id_informe, overrides), daemon=True)
    thread.start()
    return {"jobId": job_id}


@app.get("/api/preview/jobs/{job_id}")
def estado_job(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")
    return {"estado": job["estado"], "pct": job["pct"], "etapa": job["etapa"], "error": job["error"]}


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
                "inspectorUsuario": r.get("inspector_usuario") or None,
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
    if not str(payload.get("numero", "")).strip():
        raise HTTPException(status_code=422, detail="El número de OT es requerido")
    estado = payload.get("estado", "PENDIENTE")
    if estado not in ("PENDIENTE", "EN_CURSO", "COMPLETADA", "CANCELADA"):
        raise HTTPException(status_code=422, detail="Estado inválido")

    try:
        existentes = read_sheet_as_dicts(BD_SPREADSHEET_ID, "work_orders")
        if any(r.get("numero", "").strip() == payload["numero"].strip() for r in existentes):
            raise HTTPException(status_code=409, detail=f"La OT '{payload['numero']}' ya existe")

        n = len([r for r in existentes if r.get("id_ot", "").strip()]) + 1
        append_row(
            BD_SPREADSHEET_ID,
            "work_orders",
            {
                "id_ot": f"OT-{n:04d}",
                "numero": payload["numero"].strip(),
                "contrato": payload.get("contrato", "").strip(),
                "cliente": payload.get("cliente", "").strip(),
                "ubicacion": payload.get("ubicacion", "").strip(),
                "supervisor_usuario": payload.get("supervisorUsuario", "").strip(),
                "inspector_usuario": payload.get("inspectorUsuario", "").strip(),
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
    return {"ok": True}

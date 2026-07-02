"""
Backend de PREVIEW (temporal) — lee datos reales de Google Sheets sin base de
datos ni autenticación, y genera el reporte MT real con openpyxl usando la
plantilla verificada. Objetivo: validar visualmente en el frontend que la
conexión real funciona, antes de construir el backend completo (Fases 1-4 en
ADEMINCOL-Central/docs/). NO usar en producción — no hay auth, no hay caché,
no hay manejo de reintentos. Se reemplaza por el backend real de la Fase 2-4.
"""
import logging

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from .report_engine_mt import generar_reporte_mt
from .sheets_client import MT_SPREADSHEET_ID, read_sheet_as_dicts

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("preview")

app = FastAPI(title="ADEMINCOL Central — Preview API (temporal)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


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

    # Fotos de calidad (vinculadas directo al informe)
    fotos = []
    for f in calidad:
        if f.get("id_general", "").strip() == id_informe:
            url = (f.get("link") or f.get("imagen") or "").strip()
            if url:
                fotos.append({"url": url, "descripcion": f.get("descripcion", "")})

    # Fotos de resultados (vinculadas por id_resultado_fk)
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


@app.post("/api/preview/mt/{id_informe}/generar-reporte")
def generar_reporte_real(id_informe: str):
    try:
        fila_general, filas_resultado, indicaciones, fotos = _cargar_datos_mt(id_informe)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error leyendo hojas de MT para generar reporte")
        raise HTTPException(status_code=502, detail=f"No se pudo leer el Sheet de MT: {e}")

    try:
        contenido = generar_reporte_mt(fila_general, filas_resultado, indicaciones, fotos)
    except Exception as e:
        logger.exception("Error generando el reporte MT")
        raise HTTPException(status_code=500, detail=f"Error generando el reporte: {e}")

    nombre_archivo = f"Reporte_MT_{id_informe}.xlsx"
    return Response(
        content=contenido,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )

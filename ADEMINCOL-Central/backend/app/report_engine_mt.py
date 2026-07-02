"""
Generador REAL de reportes MT (.xlsx) usando la plantilla verificada
(templates_xlsx/MT.xlsx) y datos reales del Sheet. Es una versión adelantada
y simplificada del motor genérico de la Fase 4 (ver docs/04_GENERACION_REPORTES.md)
— aquí está hardcodeado para MT porque es solo para probar el flujo completo
antes de tener PostgreSQL. El motor genérico (config por tipo, sin ifs) se
construye en la Fase 4.
"""
import io
import logging
import re
from copy import copy
from pathlib import Path

import httpx
from openpyxl import load_workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
from openpyxl.drawing.xdr import XDRPositiveSize2D
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string
from openpyxl.utils.units import pixels_to_EMU

logger = logging.getLogger("report_engine_mt")

TEMPLATE_PATH = Path(__file__).resolve().parent / "templates_xlsx" / "MT.xlsx"

# Verificado celda por celda contra la plantilla real (ver docs/04_GENERACION_REPORTES.md)
CELDAS_GENERALES = {
    "cliente": "C7", "contrato": "H7", "ot": "K7", "fecha_actividad": "N7", "reporte_n": "R7",
    "zona": "C9", "sistema": "I9", "subsistema_linea": "O9",
    "departamento": "C11", "municipio": "I11", "pk_sistema": "O11", "distancia_registro": "S11",
    "descripcion_elemento": "F15", "acabado_superficial": "R15",
    "material": "D17", "espesor": "J17", "diametro": "N17", "cantidad_inspeccionada": "S17",
    "plano_referencia": "D19",
    "procedimiento_n": "E23", "revision": "K23", "norma_codigo_ref": "Q23",
    "tecnica_magnetizacion": "E25", "fuerza_campo": "L25", "direccion_campo": "S25",
    "tecnica_desmagnetizacion": "F27",
    "tipo_particulas": "D31", "metodo_aplicacion": "K31", "color_particulas": "O31", "tipo_luz_negra": "T31",
    "marca_equipo": "E33", "codigo_equipo": "P33",
    "marca_particulas": "E35", "codigo_particulas": "R35",
    "intensidad_luz_blanca": "E37", "intensidad_luz_negra": "R37",
    "tipo_corriente": "E39", "equipo_medicion_luz": "K39", "equipo_luz_sn": "R39",
    "observaciones": "D52",
    "nombre": "D54",
    "certificado": "D55",
    "fecha": "D57",
}
CELDA_FIRMA = "D56"
FILA_INICIO_INSPECCION = 44
COLUMNAS_RESULTADO = {"item": "A", "identificacion": "B", "evaluacion": "O", "observaciones": "Q"}
COLUMNAS_INDICACIONES = [("I", "J"), ("K", "L"), ("M", "N")]
FILA_BASE_FOTO = 49
FILA_BASE_DESC = 50


def _insertar_filas_y_ajustar_alturas(ws, pos: int, n: int):
    """`ws.insert_rows()` desplaza el CONTENIDO de las celdas pero NO desplaza
    `ws.row_dimensions` (las alturas de fila) — bug/limitación conocida de
    openpyxl, confirmada empíricamente el 2026-07-02: una fila con height=200
    se queda en su número de fila original aunque su contenido se mueva 1
    fila hacia abajo. Esto causaba que la fila alta de fotos (221px) quedara
    pegada al encabezado "6. REGISTRO FOTOGRAFICO" y las fotos terminaran en
    una fila de altura normal (~20px), forzando el escalado a un tamaño
    minúsculo. Aquí se recalculan las alturas manualmente después de insertar
    (limpiar todo el rango afectado y reescribir con los valores desplazados).
    """
    max_row_antes = ws.max_row
    alturas_originales = {
        r: ws.row_dimensions[r].height
        for r in range(pos, max_row_antes + 1)
        if r in ws.row_dimensions and ws.row_dimensions[r].height is not None
    }
    ws.insert_rows(pos, n)
    for r in range(pos, max_row_antes + n + 1):
        if r in ws.row_dimensions:
            ws.row_dimensions[r].height = None
    for r_original, altura in alturas_originales.items():
        ws.row_dimensions[r_original + n].height = altura


def _copiar_estilo_fila(ws, fila_origen: int, fila_destino: int, max_col: int = 20):
    for c in range(1, max_col + 1):
        origen = ws.cell(row=fila_origen, column=c)
        destino = ws.cell(row=fila_destino, column=c)
        destino.font = copy(origen.font)
        destino.border = copy(origen.border)
        destino.fill = copy(origen.fill)
        destino.alignment = copy(origen.alignment)
        destino.number_format = origen.number_format


def _drive_url_a_descarga(url: str) -> str | None:
    if not url:
        return None
    url = url.strip()
    if not url:
        return None
    if "drive.google.com" in url:
        m = re.search(r"id=([^&]+)", url) or re.search(r"/d/([^/]+)", url)
        if m:
            return f"https://drive.google.com/uc?export=download&id={m.group(1)}"
    return url if url.startswith("http") else None


def _descargar_imagen(url: str) -> bytes | None:
    final_url = _drive_url_a_descarga(url)
    if not final_url:
        return None
    try:
        resp = httpx.get(final_url, timeout=15, follow_redirects=True)
        if resp.status_code == 200 and resp.content:
            return resp.content
    except Exception:
        logger.warning("No se pudo descargar imagen: %s", url)
    return None


def _insertar_imagen_centrada(ws, image_bytes: bytes, celda_ancla: str):
    """Inserta una imagen flotante centrada en el área de la celda (o su rango
    combinado), replicando el fix ya aplicado en los scripts GAS."""
    col_letra, fila_num = coordinate_from_string(celda_ancla)
    col_idx = column_index_from_string(col_letra)

    destino = (col_idx, fila_num, col_idx, fila_num)
    for rng in ws.merged_cells.ranges:
        if rng.min_col <= col_idx <= rng.max_col and rng.min_row <= fila_num <= rng.max_row:
            destino = (rng.min_col, rng.min_row, rng.max_col, rng.max_row)
            break

    min_col, min_row, max_col, max_row = destino
    ancho_area = sum(
        (ws.column_dimensions[chr(64 + c)].width if c <= 26 else 8.43) or 8.43
        for c in range(min_col, max_col + 1)
    ) * 7
    alto_area = sum(
        (ws.row_dimensions[r].height or 15) for r in range(min_row, max_row + 1)
    ) * 96 / 72

    try:
        img = XLImage(io.BytesIO(image_bytes))
    except Exception:
        logger.warning("Imagen inválida, se omite")
        return

    margen = 4
    escala = min(
        max(ancho_area - margen, 20) / img.width,
        max(alto_area - margen, 20) / img.height,
    )
    ancho_final = round(img.width * escala)
    alto_final = round(img.height * escala)
    img.width = ancho_final
    img.height = alto_final

    offset_x = max(0, round((ancho_area - ancho_final) / 2))
    offset_y = max(0, round((alto_area - alto_final) / 2))

    marker = AnchorMarker(
        col=min_col - 1, colOff=pixels_to_EMU(offset_x),
        row=min_row - 1, rowOff=pixels_to_EMU(offset_y),
    )
    size = XDRPositiveSize2D(cx=pixels_to_EMU(ancho_final), cy=pixels_to_EMU(alto_final))
    img.anchor = OneCellAnchor(_from=marker, ext=size)

    ws.add_image(img)


def generar_reporte_mt(
    fila_general: dict,
    resultados: list[dict],
    indicaciones: list[dict],
    fotos: list[dict],
) -> bytes:
    """Genera el .xlsx real y devuelve los bytes del archivo.

    IMPORTANTE — orden de operaciones (fuente de un bug ya corregido):
    openpyxl `insert_rows()` desplaza celdas y sus VALORES automáticamente,
    pero NO desplaza imágenes ya insertadas con `add_image()`. Por eso el
    orden correcto es: 1) calcular e insertar TODAS las filas extra
    (resultados y fotos) primero, 2) escribir todo el texto en las
    posiciones finales, 3) insertar las imágenes al final, cuando ya no
    habrá más inserciones de filas que las desalineen.
    """
    wb = load_workbook(TEMPLATE_PATH)
    ws = wb["FORMATO_MT"]

    # ---- Fase 1: calcular cuántas filas extra hacen falta ----
    filas_extra_resultados = max(0, len(resultados) - 2)  # plantilla ya trae 2 filas (44-45)
    n_fotos = len(fotos)
    pares_fotos_extra = -(-max(0, n_fotos - 2) // 2)  # ceil((n_fotos-2)/2), 0 si n_fotos<=2
    filas_extra_fotos = pares_fotos_extra * 2

    # ---- Fase 2: insertar filas de la tabla de resultados ----
    if filas_extra_resultados > 0:
        fila_patron = FILA_INICIO_INSPECCION + 1  # fila 45, ya con formato
        _insertar_filas_y_ajustar_alturas(ws, fila_patron + 1, filas_extra_resultados)
        for i in range(filas_extra_resultados):
            _copiar_estilo_fila(ws, fila_patron, fila_patron + 1 + i)

    fila_base_foto_actual = FILA_BASE_FOTO + filas_extra_resultados
    fila_base_desc_actual = FILA_BASE_DESC + filas_extra_resultados

    # ---- Fase 3: insertar filas extra de fotos (pares más allá del primero) ----
    posiciones_fotos: list[tuple[int, int]] = []  # (fila_foto, fila_desc) por índice de foto
    ultima_fila_desc = fila_base_desc_actual
    for p in range(pares_fotos_extra):
        _insertar_filas_y_ajustar_alturas(ws, ultima_fila_desc + 1, 2)
        f_foto, f_desc = ultima_fila_desc + 1, ultima_fila_desc + 2
        _copiar_estilo_fila(ws, fila_base_foto_actual, f_foto)
        _copiar_estilo_fila(ws, fila_base_desc_actual, f_desc)
        ws.row_dimensions[f_foto].height = ws.row_dimensions[fila_base_foto_actual].height
        ws.row_dimensions[f_desc].height = ws.row_dimensions[fila_base_desc_actual].height
        posiciones_fotos.append((f_foto, f_desc))
        ultima_fila_desc = f_desc

    def fila_final(fila_original: int) -> int:
        """Todas las inserciones de filas ya ocurrieron: calcula la fila
        final de una celda de la plantilla original según en qué zona cae."""
        if fila_original > FILA_BASE_FOTO:
            return fila_original + filas_extra_resultados + filas_extra_fotos
        if fila_original > FILA_INICIO_INSPECCION:
            return fila_original + filas_extra_resultados
        return fila_original

    # ---- Fase 4: escribir texto (datos generales, resultados, indicaciones, descripciones de fotos) ----
    for campo, celda in CELDAS_GENERALES.items():
        valor = fila_general.get(campo)
        if valor:
            col, fila = coordinate_from_string(celda)
            ws[f"{col}{fila_final(fila)}"] = valor

    for idx, res in enumerate(resultados):
        fila_actual = FILA_INICIO_INSPECCION + idx
        for campo, col in COLUMNAS_RESULTADO.items():
            ws[f"{col}{fila_actual}"] = res.get(campo, "")
        inds = [i for i in indicaciones if i.get("id_resultado") == res.get("item")]
        for i, (col_tipo, col_long) in enumerate(COLUMNAS_INDICACIONES):
            if i < len(inds):
                ws[f"{col_tipo}{fila_actual}"] = inds[i].get("tipo", "")
                ws[f"{col_long}{fila_actual}"] = inds[i].get("long", "")

    fila_foto_por_indice: list[tuple[int, int]] = []  # (fila, columna_letra) por foto, para las imágenes
    for idx, foto in enumerate(fotos):
        desc = foto.get("descripcion") or ""
        es_par = idx % 2 == 0
        if idx <= 1:
            f_foto, f_desc = fila_base_foto_actual, fila_base_desc_actual
        else:
            f_foto, f_desc = posiciones_fotos[(idx - 2) // 2]
        col_desc = "B" if es_par else "M"
        ws[f"{col_desc}{f_desc}"] = desc
        fila_foto_por_indice.append((f_foto, "A" if es_par else "L"))

    # ---- Fase 5: insertar imágenes (firma + fotos), ya con todas las filas en su lugar final ----
    firma_bytes = _descargar_imagen(fila_general.get("firma_link", ""))
    if firma_bytes:
        col_firma, fila_firma = coordinate_from_string(CELDA_FIRMA)
        _insertar_imagen_centrada(ws, firma_bytes, f"{col_firma}{fila_final(fila_firma)}")

    for idx, foto in enumerate(fotos):
        img_bytes = _descargar_imagen(foto.get("url") or "")
        if img_bytes:
            f_foto, col_foto = fila_foto_por_indice[idx]
            _insertar_imagen_centrada(ws, img_bytes, f"{col_foto}{f_foto}")

    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()

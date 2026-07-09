"""
Utilidades de imágenes compartidas entre los motores de reporte (MT, PMI...).
Extraído de report_engine_mt.py el 2026-07-03 para reutilizar en PMI sin
duplicar código — cualquier fix aquí (como el bug de columnas >Z corregido
abajo) beneficia a todos los motores por igual.
"""
import base64
import io
import logging
import re

import httpx
from openpyxl.drawing.image import Image as XLImage
from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
from openpyxl.drawing.xdr import XDRPositiveSize2D
from openpyxl.utils import get_column_letter
from openpyxl.utils.cell import coordinate_from_string, column_index_from_string
from openpyxl.utils.units import pixels_to_EMU

logger = logging.getLogger("image_utils")


def desactivar_fit_to_page(ws):
    """REVERTIDO el 2026-07-08 — ya NO hace nada (se deja como no-op en vez
    de borrarla para no tener que tocar los 3 motores que la llaman).

    Historia: el 2026-07-06 diagnostiqué que `fitToPage=True` (que traen
    PMI/570/510, no MT) hacía que las imágenes flotantes se vieran
    desbordadas al exportar a PDF, y esta función lo desactivaba. Esa
    prueba se hizo con LibreOffice --headless (no había Excel real a mano).
    El 2026-07-08 el usuario reportó, probando en Excel de verdad, que con
    `fitToPage=False` el reporte PMI paginaba a **126 páginas** al imprimir
    (Ctrl+P) — la plantilla es MUY ancha (34 columnas) y alta (895 filas), y
    sin ese ajuste Excel no comprime nada. Osea: el bug de imágenes
    desbordadas era un artefacto del renderizador de LibreOffice, no de
    Excel real — la plantilla siempre estuvo pensada para imprimirse con
    `fitToPage=True` (así la dejó quien la diseñó) y ESO es lo correcto en
    Excel. Se revierte a no tocar el valor de la plantilla."""
    return


def drive_url_a_descarga(url: str) -> str | None:
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


def descargar_imagen(url: str) -> bytes | None:
    if not url:
        return None
    url = url.strip()
    if url.startswith("data:image/"):
        try:
            _, b64_data = url.split(",", 1)
            return base64.b64decode(b64_data)
        except Exception:
            logger.warning("No se pudo decodificar imagen base64")
            return None

    final_url = drive_url_a_descarga(url)
    if not final_url:
        return None
    try:
        resp = httpx.get(final_url, timeout=15, follow_redirects=True)
        if resp.status_code == 200 and resp.content:
            return resp.content
    except Exception:
        logger.warning("No se pudo descargar imagen: %s", url)
    return None


def _ancho_columna(ws, col_letra: str) -> float:
    """Ancho de columna (unidades de caracter) SIN mutar la hoja.

    `ws.column_dimensions[letra]` (acceso por índice) es un defaultdict: si
    la columna no tenía ancho explícito, CREA un ColumnDimension nuevo — y
    ese objeto nuevo trae width=13.0 por defecto (no None). O sea que la
    sola LECTURA del ancho vía `[...]` graba un ancho de 13 en columnas que
    debían quedarse con el ancho por defecto de la plantilla. Bug real,
    confirmado 2026-07-09 con un reporte generado por el usuario: la
    plantilla PMI no trae ancho explícito en C:AG y el .xlsx generado salía
    con esas 31 columnas fijadas en 13.0 — esto, no la fórmula de escalado
    de imagen, era la causa de "las columnas siguen aumentando su tamaño".
    `.get()` no dispara el auto-creado (no pasa por `__missing__`)."""
    dim = ws.column_dimensions.get(col_letra)
    return dim.width if dim and dim.width else 8.43


def _alto_fila(ws, fila_num: int) -> float:
    """Alto de fila (puntos) sin mutar la hoja — ver `_ancho_columna`."""
    dim = ws.row_dimensions.get(fila_num)
    return dim.height if dim and dim.height else 15


def insertar_imagen_centrada(ws, image_bytes: bytes, celda_ancla: str):
    """Inserta una imagen flotante centrada en el área de la celda (o su rango
    combinado), replicando el fix ya aplicado en los scripts GAS.

    NOTA: el cálculo de ancho de columna usaba `chr(64 + c)` que solo
    funciona hasta la columna Z — se reemplazó por `get_column_letter()`
    (openpyxl) que soporta columnas AA, AB... correctamente. Importa para
    PMI, cuya plantilla llega hasta la columna AH."""
    col_letra, fila_num = coordinate_from_string(celda_ancla)
    col_idx = column_index_from_string(col_letra)

    destino = (col_idx, fila_num, col_idx, fila_num)
    for rng in ws.merged_cells.ranges:
        if rng.min_col <= col_idx <= rng.max_col and rng.min_row <= fila_num <= rng.max_row:
            destino = (rng.min_col, rng.min_row, rng.max_col, rng.max_row)
            break

    min_col, min_row, max_col, max_row = destino
    # Conversión ancho de columna (unidades de caracter, fuente Calibri 11,
    # MDW=7) -> píxeles. FORMULA CORREGIDA 2026-07-05: usaba solo `width * 7`,
    # que subestima el ancho real por ~5px POR COLUMNA (el ancho default de
    # Excel, 8.43, da 64px documentados — la fórmula vieja daba 59px). En un
    # merge de muchas columnas (ej. el bloque de fotos de 570/510, 22
    # columnas) el déficit acumulado superaba 100px, y como la imagen se
    # escalaba para caber en esa área SUBESTIMADA, quedaba más pequeña de lo
    # que debía y desplazada hacia la izquierda dentro de la celda real —
    # visualmente "no centrada" y con la columna viéndose más ancha que la
    # imagen.
    ancho_area = sum(_ancho_columna(ws, get_column_letter(c)) * 7 + 5 for c in range(min_col, max_col + 1))
    alto_area = sum(_alto_fila(ws, r) for r in range(min_row, max_row + 1)) * 96 / 72

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

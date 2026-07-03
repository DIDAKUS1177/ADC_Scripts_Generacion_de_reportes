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
    ancho_area = sum(
        (ws.column_dimensions[get_column_letter(c)].width or 8.43)
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

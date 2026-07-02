# Fase 4 — Motor de generación de reportes Excel

**Objetivo:** Traducir la lógica probada de los scripts GAS a un motor Python genérico
con openpyxl. El supervisor pulsa "Generar" en la UI y descarga el Excel idéntico al
que hoy producen los scripts.
**Resultado verificable:** generar el reporte MT de una inspección real produce un
.xlsx con datos, filas dinámicas, fotos insertadas centradas y firma.

---

## Contexto: qué hacen hoy los scripts GAS (referencia obligada)

Leer `ADEMINCOL-Scripts/APP022_Partic_Magn_MT.js` antes de empezar. El flujo GAS es:

1. Busca la fila del `id_informe` en la hoja general.
2. Copia la hoja plantilla `FORMATO_MT` a un spreadsheet nuevo.
3. Inserta filas extra si hay más resultados que las filas de la plantilla.
4. Escribe datos generales según `MAPEO_CELDAS_GENERAL_MT` (dict campo → celda),
   ajustando las celdas que quedan debajo de las filas insertadas.
5. Inserta imágenes flotantes escaladas y centradas (firma + fotos).
6. Escribe la URL del reporte de vuelta en `link_reporte`.

El motor Python replica esto con plantillas `.xlsx` locales.

## Paso 4.1 — Obtener las plantillas (requiere acción del USUARIO)

Pedir al usuario que descargue como `.xlsx` cada hoja FORMATO desde los spreadsheets
de Google (Archivo → Descargar → Microsoft Excel) y las entregue. Guardarlas en:

```
backend/app/templates_xlsx/
├── MT.xlsx            (hoja FORMATO_MT)
├── VT_SOLDADAS.xlsx
└── UT_ESPESORES.xlsx
```

⚠️ Al descargar de Sheets, verificar que las celdas combinadas y anchos de columna
sobrevivieron (abrir en Excel y comparar contra el original).

## Paso 4.2 — Config declarativa por tipo de reporte

`backend/app/services/report_configs/mt.py` — traducción directa de las constantes GAS:

```python
MT_CONFIG = {
    "template": "MT.xlsx",
    "celdas_generales": {
        # copiar MAPEO_CELDAS_GENERAL_MT de APP022_Partic_Magn_MT.js tal cual
        "cliente": "C7", "contrato": "H7", "ot": "K7",
        # ... (completo, no abreviar)
    },
    # Firma: PRIORIDAD 1 = users.firma_base64 del usuario cuyo nombre coincide con
    # el campo 'nombre' de los datos generales (match por nombre normalizado).
    # PRIORIDAD 2 (fallback) = descargar la URL del campo firma_link del Sheet,
    # como hacen hoy los scripts GAS. Registrar en el log cuál vía se usó.
    "firma": {"celda": "D56", "campo_fallback": "firma_link"},
    "tabla_resultados": {
        "fila_inicio": 44,
        "columnas": {  # campo del JSONB → columna del Excel
            "item": "A", "identificacion": "B", "zona_insp_distancia": "E",
            "diam_long": "G", "evaluacion": "O", "observaciones": "Q",
        },
        "indicaciones": {   # específico de MT: 3 indicaciones por fila
            "max_por_fila": 3,
            "columnas": [("I","J"), ("K","L"), ("M","N")],
        },
    },
    "fotos": {
        "fila_base_foto": 49, "fila_base_desc": 50,
        "por_fila": 2,
        "columnas_foto": ["A", "L"], "columnas_desc": ["B", "M"],
    },
}
```

Cada tipo nuevo = un archivo de config nuevo. **El motor no debe tener `if tipo == 'MT'`
en ninguna parte.**

## Paso 4.3 — El motor (`report_engine.py`)

```python
class ReportEngine:
    def generate(self, db, inspection: Inspection, user: User) -> GeneratedReport:
        # 1. Marcar inspection.estado_reporte = GENERANDO
        # 2. Cargar plantilla: openpyxl.load_workbook(template_path)
        # 3. Calcular filas extra → ws.insert_rows(fila_inicio+1, n_extra)
        # 4. Escribir datos generales (ajustando celdas bajo la inserción)
        # 5. Escribir tabla de resultados
        # 6. Insertar imágenes (ver 4.4)
        # 7. Guardar en {STORAGE_DIR}/reportes/{tipo}/{id_informe}_{timestamp}.xlsx
        # 8. Calcular checksum SHA-256, crear generated_reports
        # 9. Write-back: link de descarga → columna link_reporte del Sheet
        # 10. estado_reporte = GENERADO (o ERROR con detalle si algo falla)
```

### Detalles críticos de openpyxl (fuente de bugs conocidos)

1. **`insert_rows()` NO copia formato ni merges.** Después de insertar hay que:
   - copiar el estilo celda por celda desde la fila patrón
     (`copy(cell._style)` — usar `from copy import copy`),
   - re-crear los merges desplazados: iterar `ws.merged_cells.ranges` ANTES de
     insertar, guardar los que están debajo, y re-aplicarlos desplazados.
2. **Celdas combinadas:** solo se escribe en la celda superior-izquierda del merge.
   Escribir en otra celda del merge lanza error o se pierde silenciosamente.
3. **Ajuste de celdas bajo la inserción** (equivale a `calcularNuevaPosicion_MT` de GAS):
   ```python
   def ajustar_celda(ref: str, fila_umbral: int, filas_extra: int) -> str:
       col, fila = coordinate_from_string(ref)  # openpyxl.utils
       return f"{col}{fila + filas_extra}" if fila > fila_umbral else ref
   ```
4. **Fórmulas de la plantilla:** load_workbook SIN `data_only=True` (se necesitan
   las fórmulas vivas).

## Paso 4.4 — Imágenes flotantes centradas (traducción del fix GAS)

`insert_centered_image(ws, image_bytes, anchor_range)`:

```python
from openpyxl.drawing.image import Image as XLImage
from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
from openpyxl.utils.units import pixels_to_EMU, cm_to_EMU
from PIL import Image as PILImage

# 1. Área del rango en píxeles:
#    ancho_col_px ≈ ws.column_dimensions[letra].width * 7  (aprox 7 px/unidad)
#    alto_fila_px ≈ ws.row_dimensions[n].height * 96/72   (puntos → píxeles)
#    Si la dimensión es None, usar defaults: width=8.43, height=15.
# 2. Escala = min(area_w/img_w, area_h/img_h) con margen de 4 px.
# 3. Centrado (mismo cálculo que el fix GAS):
#    offset_x = max(0, (area_w - final_w) // 2)
#    offset_y = max(0, (area_h - final_h) // 2)
# 4. Anclar con OneCellAnchor: col/row 0-index de la celda,
#    colOff=pixels_to_EMU(offset_x), rowOff=pixels_to_EMU(offset_y)
```

⚠️ El cálculo de píxeles de columnas de openpyxl es aproximado. Tras implementar,
generar un reporte de prueba, abrirlo en Excel y ajustar el factor si las imágenes
se ven descuadradas. Documentar el factor final en el código.

### Descarga de imágenes desde Drive

Las URLs en los Sheets son links de Drive. Reusar la lógica GAS:

```python
def drive_url_to_download(url: str) -> str:
    # extraer id con regex: r"id=([^&]+)" o r"/d/([^/]+)"
    # → f"https://drive.google.com/uc?export=download&id={file_id}"
```

- Descargar con `httpx` timeout=15 s, 2 reintentos.
- Si la imagen requiere permisos: usar la service account
  (`drive.files().get_media()`) como fallback.
- Si falla todo: escribir "Sin foto" en la celda y seguir. **Una foto rota no
  puede tumbar el reporte completo.**

## Paso 4.5 — Endpoints

| Método | Ruta | Rol | Notas |
|--------|------|-----|-------|
| POST | `/inspections/{id}/generate-report` | admin, supervisor | síncrono si <30 s; si no, BackgroundTask + polling de estado_reporte |
| GET | `/reports/{id}/download` | según permisos | `FileResponse` con el .xlsx |
| GET | `/reports?inspection_id=` | — | historial de versiones generadas |

Generación masiva (equivalente al panel selector de GAS):
| POST | `/reports/generate-batch` | body `{inspection_ids: [...]}` | encola secuencial, responde estado por id |

## Paso 4.6 — Validación contra el reporte GAS (OBLIGATORIO)

Antes de dar por buena la fase:
1. Elegir un `id_informe` real de MT ya generado con el script GAS.
2. Generar el mismo con el motor Python.
3. Comparar lado a lado: datos generales, nº de filas de resultados, indicaciones,
   posiciones de fotos y firma.
4. Pedir al usuario confirmación visual antes de marcar la fase completa.

## Criterios de aceptación de la Fase 4

- [ ] Reporte MT real generado y validado contra el equivalente GAS (paso 4.6).
- [ ] Filas dinámicas conservan formato y merges.
- [ ] Fotos y firma centradas correctamente en Excel de escritorio.
- [ ] Una URL de foto rota no impide generar el reporte.
- [ ] `link_reporte` se escribe de vuelta al Sheet.
- [ ] El historial (`generated_reports`) registra cada generación con checksum.
- [ ] Agregar VT_SOLDADAS solo requirió crear `report_configs/vt_soldadas.py` + plantilla (cero cambios en el motor).
- [ ] Actualizar tabla de avance del README raíz.

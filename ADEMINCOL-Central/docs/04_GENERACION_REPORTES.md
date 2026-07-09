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

## Paso 4.1 — Plantillas

`backend/app/templates_xlsx/MT.xlsx` ya está en el repo (entregada por el usuario el
2026-07-02, copiada desde `ADEMINCOL-Scripts/APP022_Partic_Magn_MT/formato excel MT.xlsx`).
Verificada con `openpyxl`: 1 hoja `FORMATO_MT`, rango `A1:T57`, 145 rangos combinados,
coincide con la lógica de `APP022_Partic_Magn_MT.js`.

Pendientes de pedir al usuario cuando se aborden esos tipos de reporte:
```
backend/app/templates_xlsx/
├── MT.xlsx            ✅ recibida
├── PMI.xlsx            ⏳ pedir (2º en el orden, ver 00_ARQUITECTURA.md D7)
├── VT_SOLDADAS.xlsx     ⏳ pedir
└── UT_ESPESORES.xlsx    ⏳ pedir
```

⚠️ Al descargar de Sheets, verificar que las celdas combinadas y anchos de columna
sobrevivieron (abrir en Excel y comparar contra el original).

## Paso 4.2 — Config declarativa por tipo de reporte

`backend/app/services/report_configs/mt.py` — **verificada celda por celda contra
`backend/app/templates_xlsx/MT.xlsx` con openpyxl el 2026-07-02** (no es una traducción
a ciegas del GAS: se abrió el archivo real, se listaron los 145 merges y se confirmó
que cada celda de valor es la esquina superior-izquierda de su rango combinado).

```python
MT_CONFIG = {
    "template": "MT.xlsx",
    "celdas_generales": {
        "cliente": "C7", "contrato": "H7", "ot": "K7",
        "fecha_actividad": "N7", "reporte_n": "R7",
        "zona": "C9", "sistema": "I9", "subsistema_linea": "O9",
        "departamento": "C11", "municipio": "I11", "pk_sistema": "O11",
        "distancia_registro": "S11",
        "descripcion_elemento": "F15", "acabado_superficial": "R15",
        "material": "D17", "espesor": "J17", "diametro": "N17",
        "cantidad_inspeccionada": "S17", "plano_referencia": "D19",
        "procedimiento_n": "E23", "revision": "K23", "norma_codigo_ref": "Q23",
        "tecnica_magnetizacion": "E25", "fuerza_campo": "L25", "direccion_campo": "S25",
        "tecnica_desmagnetizacion": "F27",
        "tipo_particulas": "D31", "metodo_aplicacion": "K31",
        "color_particulas": "O31", "tipo_luz_negra": "T31",
        "marca_equipo": "E33", "codigo_equipo": "P33",
        "marca_particulas": "E35", "codigo_particulas": "R35",
        "intensidad_luz_blanca": "E37", "intensidad_luz_negra": "R37",
        "tipo_corriente": "E39", "equipo_medicion_luz": "K39", "equipo_luz_sn": "R39",
        # Confirmado con el usuario 2026-07-02 — ambos vienen de la hoja
        # "2.general_particulas_magneticas" (columnas 'observaciones' y 'certificado').
        # El script GAS actual NO los llena; el motor Python sí (mejora sobre el proceso actual).
        "observaciones": "D52",
        "nombre": "D54",
        "certificado": "D55",
        "fecha": "D57",
    },
    # Firma: PRIORIDAD 1 = users.firma_base64 del usuario cuyo nombre coincide con
    # el campo 'nombre' de los datos generales (match por nombre normalizado).
    # PRIORIDAD 2 (fallback) = descargar la URL del campo firma_link del Sheet,
    # como hacen hoy los scripts GAS. Registrar en el log cuál vía se usó.
    "firma": {"celda": "D56", "campo_fallback": "firma_link"},
    "tabla_resultados": {
        "fila_inicio": 44,   # confirmado: filas de plantilla 44-45, altura 30px c/u
        "columnas": {  # campo del JSONB → columna del Excel
            "item": "A", "identificacion": "B", "zona_insp_distancia": "E",
            "diam_long": "G", "evaluacion": "O", "observaciones": "Q",
        },
        "indicaciones": {   # específico de MT: 3 indicaciones por fila, columnas SIN merge
            "max_por_fila": 3,
            "columnas": [("I", "J"), ("K", "L"), ("M", "N")],
        },
    },
    "fotos": {
        # confirmado: fila 49 (alto 221px, foto) + fila 50 (alto 19.5px, descripción)
        # foto izquierda ocupa A49:K49 combinado, foto derecha L49:T49 combinado
        "fila_base_foto": 49, "fila_base_desc": 50,
        "por_fila": 2,
        "columnas_foto": ["A", "L"], "columnas_desc": ["B", "M"],
    },
    # NOTA: la sección "6. ESQUEMA DE INSPECCIÓN" (fila 46-47, alto 259px) NO está
    # automatizada — ni en el GAS actual ni aquí. Es un espacio para dibujo/anexo manual.
    # No requiere config a menos que el usuario pida automatizarla más adelante.
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
5. **`column_dimensions`/`row_dimensions` son `defaultdict`: LEER con `[...]` puede
   escribir en la hoja.** `ws.column_dimensions[letra]`, para una columna SIN ancho
   explícito, no lanza `KeyError` ni devuelve `None` — CREA un `ColumnDimension`
   nuevo y lo deja guardado en la hoja. Ese objeto nuevo trae **`width=13.0` por
   defecto (no `None`)**. O sea: la sola LECTURA del ancho, para calcular otra cosa
   (p. ej. el escalado de una imagen), fija un ancho de 13 en columnas que debían
   quedarse con el ancho por defecto de la plantilla — y ese 13.0 se graba de verdad
   al guardar el `.xlsx`.
   - **Bug real que causó esto (2026-07-09):** `insertar_imagen_centrada()`
     (`image_utils.py`, compartida por los 4 motores: MT, PMI, 570, 510) leía así
     el ancho de cada columna del rango de la imagen para calcular el escalado.
     Como el reporte PMI inserta ~14 imágenes en rangos anchos (fotos, gráfico de
     durezas, firmas), terminaba "pisando" con 13.0 casi todas las columnas del
     reporte generado. El usuario lo reportó como "las columnas siguen aumentando
     su tamaño" — se confirmó comparando con openpyxl la plantilla (columnas C:AG
     sin ancho explícito) contra un .xlsx recién generado (las mismas columnas en
     13.0 exacto).
   - `row_dimensions[fila]` tiene el mismo comportamiento `defaultdict`, pero su
     default es inofensivo (`height=None`, `customHeight=False` — no pisa nada al
     guardar). El bug real es específico de `column_dimensions` por su default de
     13.0.
   - **Regla:** para LEER un ancho/alto sin riesgo de mutar la hoja, usar siempre
     `.get(letra_o_fila)` (devuelve `None` si no existe, sin crear nada — `.get()`
     no dispara `__missing__` del defaultdict). Reservar `[...]` para cuando la
     intención es escribir (`ws.column_dimensions[letra].width = 20`).
     ```python
     def _ancho_columna(ws, letra: str) -> float:
         dim = ws.column_dimensions.get(letra)
         return dim.width if dim and dim.width else 8.43
     ```

## Paso 4.4 — Imágenes flotantes centradas (traducción del fix GAS)

`insert_centered_image(ws, image_bytes, anchor_range)`:

```python
from openpyxl.drawing.image import Image as XLImage
from openpyxl.drawing.spreadsheet_drawing import OneCellAnchor, AnchorMarker
from openpyxl.utils.units import pixels_to_EMU, cm_to_EMU
from PIL import Image as PILImage

# 1. Área del rango en píxeles — LEER SIEMPRE con `.get()`, nunca con `[...]`
#    (ver bug #5 de la sección anterior: `[...]` en una columna sin ancho
#    explícito graba width=13.0 en la hoja como efecto secundario de leerla):
#    dim_col = ws.column_dimensions.get(letra)       # None si no existe
#    ancho_col_px ≈ (dim_col.width if dim_col and dim_col.width else 8.43) * 7 + 5
#    dim_fila = ws.row_dimensions.get(n)              # None si no existe
#    alto_fila_px ≈ (dim_fila.height if dim_fila and dim_fila.height else 15) * 96/72
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

✅ Ya resueltos y documentados en `image_utils.py` (`insertar_imagen_centrada`,
`_ancho_columna`, `_alto_fila`) — no reabrir sin evidencia nueva:
- Factor de conversión de ancho: `width * 7 + 5`, no `width * 7` (corregido 2026-07-05).
- Lectura de `column_dimensions`/`row_dimensions` con `.get()`, no `[...]` (bug #5,
  corregido 2026-07-09).
- `fitToPage` de PMI/570/510 debe quedar en `True` (el valor que trae la plantilla).
  Un intento anterior de desactivarlo (2026-07-06, basado en una prueba con
  LibreOffice --headless) causó que el PMI paginara a 126 hojas al imprimir en
  Excel real — revertido 2026-07-08. Si un renderizador muestra imágenes
  desbordadas, sospechar primero del renderizador antes de tocar `fitToPage`.

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

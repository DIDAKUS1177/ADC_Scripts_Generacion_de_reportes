# Fase 3 — Sincronización Google Sheets → PostgreSQL

> ⚠️ **La sincronización real que terminó construyéndose (2026-07-09) es
> `backend/app/sync_service.py`** — cubre las 7 tablas de soporte (usuarios, OTs,
> servicios, equipos, certificados, consecutivos), no los datos de inspección de
> cada técnica como planteaba este documento originalmente. Endpoints reales:
> `POST /api/preview/sync` y `GET /api/preview/sync/runs` (no `/api/v1/...`). Ver
> **`07_CONTEXTO_MIGRACION_POSTGRES.md`** para el detalle completo. Los hallazgos de
> conexión a Sheets de abajo (paso 3.1) siguen vigentes.

**Objetivo:** El servicio de sync copia los datos que AppSheet deposita en los Sheets
hacia PostgreSQL, automáticamente cada 5 minutos y bajo demanda.
**Resultado verificable:** `POST /api/v1/sync/run` trae las inspecciones del Sheet MT
real y aparecen en `GET /api/v1/inspections`.

---

## Paso 3.1 — Credenciales de Google ✅ COMPLETADO (2026-07-02)

- Proyecto GCP: `adcformatos`.
- Service account: `didakus@adcformatos.iam.gserviceaccount.com`.
- Credencial guardada en `backend/credentials/service-account.json` (gitignored,
  verificado que nunca se subió al repo).
- Google Sheets API habilitada y probada: conexión real exitosa contra el
  spreadsheet de MT (`1J3FcVxay3dNQMG9SnOwfTccezzuBlaL-PPSiEq7Icy8`), ya compartido
  con permiso Editor.
- Pendiente repetir este paso 3.1 para PMI/VT_SOLDADAS/UT_ESPESORES cuando se aborden.

### Hallazgos de la conexión de prueba (2026-07-02)

- Hojas del spreadsheet MT: `1.map`, `2.general_particulas_magneticas`,
  `3.resultados_inspeccion`, `4.reg_fotografico`, `4.2.reg_calidad`, `5.indicaciones`,
  `6.complementos`, `FORMATO_MT`.
- **`1.map` y `6.complementos` son hojas de referencia para AppSheet (listas
  desplegables, catálogos). Confirmado con el usuario: no son relevantes para el
  sync — solo sincronizar las hojas que el script GAS ya usa.**
- El header `observaciones` de `2.general_particulas_magneticas` tiene un **espacio
  en blanco al final** (`"observaciones "`). El sync DEBE normalizar headers con
  `.strip().lower()` (ya estaba previsto en el Paso 3.5) — confirmado que es
  necesario, no opcional.
- La hoja general tiene ~35 columnas que el script GAS/motor Python actual no usa
  todavía (variantes `_visible` / `_uva` de partículas y luz, datos de calibración
  de gausímetro/luxómetros/bloque de peso). No requieren acción ahora — el sync las
  captura igual dentro del JSONB de `datos_generales` aunque no se mapeen a celdas
  del Excel. Si el usuario pide automatizarlas en el reporte, se agregan al
  `MT_CONFIG` sin cambiar el motor.

## Paso 3.2 — Config de cada tipo de reporte

Llenar el `config_json` de cada fila de `report_types` (actualizar el seed). Estructura:

```json
{
  "id_column": "id_informe",
  "child_sheets": [
    { "name": "3.resultados_inspeccion",  "fk_column": "id_informe_fk" },
    { "name": "5.indicaciones",           "fk_column": "id_informe" },
    { "name": "4.reg_fotografico",        "fk_column": "id_resultado_fk", "fk_via": "3.resultados_inspeccion.id_resultado" },
    { "name": "4.2.reg_calidad",          "fk_column": "id_general" }
  ],
  "general_fields_to_columns": {
    "cliente": "cliente",
    "fecha": "fecha_actividad",
    "reporte_n": "reporte_n"
  },
  "link_reporte_column": "link_reporte"
}
```

Notas:
- `fk_via` indica FK indirecta: las fotos apuntan a un resultado, no al informe.
  El sync debe resolver la cadena (foto → resultado → informe).
- `general_fields_to_columns` mapea columnas del Sheet a las columnas reales de
  `inspections` (para filtros de la UI).
- Los valores exactos para MT están en `ADEMINCOL-Scripts/APP022_Partic_Magn_MT.js`
  (constantes `HOJA_DB_*`); para VT_SOLDADAS en `APP034_VT_soldadas/Code.gs`.

## Paso 3.3 — Servicio de sync

`backend/app/services/sheets_client.py`:

```python
class SheetsClient:
    """Wrapper sobre google-api-python-client con retry."""
    def read_sheet(self, spreadsheet_id: str, sheet_name: str) -> list[dict]:
        # 1. values().get(range=f"'{sheet_name}'")  — comillas: los nombres tienen puntos
        # 2. Primera fila = headers → normalizar: str.strip().lower()
        # 3. Devolver lista de dicts {header: valor}
        # 4. Retry con backoff exponencial (3 intentos) ante HttpError 429/500/503

    def write_cell(self, spreadsheet_id, sheet_name, row, column_name, value):
        # Para el write-back de link_reporte (usado en Fase 4)
```

`backend/app/services/sync_service.py`:

```python
def sync_report_type(db: Session, report_type: ReportType) -> SyncRun:
    # 1. Crear sync_run con status RUNNING
    # 2. Leer hoja general → por cada fila con id_informe no vacío:
    #    - upsert en inspections (clave: report_type_id + id_informe)
    #    - guardar la fila completa en datos_generales (JSONB)
    #    - guardar sheet_row (índice de fila real, para write-back)
    #    - poblar cliente/fecha/reporte_n según general_fields_to_columns
    #    - NO tocar estado_reporte si ya es GENERADO (el sync no des-genera)
    # 3. Por cada child_sheet: leer, agrupar por FK, y reemplazar las filas de
    #    inspection_data de esa inspección+hoja (delete + insert es aceptable:
    #    la fuente de verdad de los datos crudos es el Sheet)
    # 4. Cerrar sync_run: SUCCESS + rows_upserted, o ERROR + error_detail
    # 5. TODO en una transacción por inspección (si una falla, las demás siguen)

def sync_all(db: Session) -> list[SyncRun]:
    # itera report_types activos; una excepción en uno NO detiene los demás
```

## Paso 3.4 — Scheduler y endpoint

En `main.py`, con APScheduler:

```python
scheduler = BackgroundScheduler()
scheduler.add_job(sync_all_job, "interval", minutes=5, max_instances=1)
# max_instances=1 → si una corrida tarda >5 min, no se solapan
```

Endpoints en `api/v1/sync.py`:
| Método | Ruta | Rol | Notas |
|--------|------|-----|-------|
| POST | `/sync/run` | admin, supervisor | body opcional `{report_type: "MT"}`; sin body = todos |
| GET | `/sync/runs` | admin, supervisor | últimas 50 corridas con status y errores |

## Paso 3.5 — Manejo de datos sucios (OBLIGATORIO, aquí es donde fallan los syncs)

Los Sheets alimentados por AppSheet traen inconsistencias. Reglas:

1. **Fechas:** pueden venir como string `dd/mm/yyyy`, `yyyy-mm-dd` o serial de
   Sheets. Parsear con tolerancia; si no se puede, guardar NULL en la columna
   tipada y conservar el valor crudo en el JSONB.
2. **Números:** pueden traer comas decimales (`12,5`). Conservar como string en
   JSONB; la conversión se hace en el motor de reportes.
3. **Filas fantasma:** filas con formato pero sin `id_informe` → ignorar.
4. **Headers duplicados:** si dos columnas tienen el mismo nombre normalizado,
   sufijar `_2`, `_3` y registrar warning en el sync_run.
5. **id_informe duplicado en la hoja:** gana la última fila; registrar warning.

## Criterios de aceptación de la Fase 3

- [ ] `POST /sync/run {"report_type": "MT"}` trae datos reales del Sheet de MT.
- [ ] Correr el sync 2 veces seguidas no duplica inspecciones ni filas hijas.
- [ ] Un Sheet inaccesible (revocar permiso para probar) produce sync_run ERROR
      con mensaje claro, y NO tumba la API.
- [ ] `GET /inspections?report_type=MT` lista lo sincronizado con filtros funcionando.
- [ ] El scheduler corre solo (verificar 2 corridas consecutivas en `/sync/runs`).
- [ ] `service-account.json` NO está en el repo (verificar `.gitignore`).
- [ ] Actualizar tabla de avance del README raíz.

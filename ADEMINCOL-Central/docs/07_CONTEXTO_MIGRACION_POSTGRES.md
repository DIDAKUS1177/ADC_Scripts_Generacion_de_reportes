# Contexto — Migración a PostgreSQL (bitácora viva)

Este archivo es distinto de `01_BASE_DE_DATOS.md` y `03_SINCRONIZACION_SHEETS.md`:
esos dos describen el **plan original** (Docker + Alembic + SQLAlchemy), que no fue
lo que terminó pasando. Este documento es la **bitácora real** de lo que se construyó,
con fecha, para no perder el porqué de cada decisión. Se sigue actualizando a medida
que avanza la migración — pedido explícito del usuario 2026-07-09 ("todo esto lo
tienes que ir documentando en un contextualizador .md").

**Regla de este archivo:** cada sección nueva va con fecha. No se reescribe la
historia — si una decisión se corrige después, se agrega una entrada nueva que dice
qué cambió y por qué, no se borra la anterior.

---

## Decisión base: Supabase, no Docker local (2026-07-09)

El plan original (`01_BASE_DE_DATOS.md`) era Postgres en Docker + Alembic. En la
práctica el usuario ya tenía un proyecto de **Supabase** ("ADC_REPORT") creado y
conectado por pgAdmin, y pidió usar eso directamente en vez de armar Docker desde
cero. Se abandonó el plan de Docker (el `docker-compose.yml` que se llegó a crear
quedó sin usar, no se borró por si sirve para un entorno local más adelante).

Conexión real: **Transaction Pooler** de Supabase (puerto 6543, usuario con formato
`postgres.<project-ref>` — así lo exige el pooler, no es un típo). Guardada en
`backend/.env` como `DATABASE_URL` (gitignored).

## Esquema: qué se migró y qué no

**Sí migrado a Postgres, con sync real** (botón "Sincronizar"):
`users`, `work_orders`, `servicios`, `equipos_ensayo`, `personal_certificados`,
`certificados_usuarios`, `consecutivos_reportes` — ver `backend/db/schema.sql` —
y desde el 2026-07-10 también `pmi_general`, `pmi_quimica`, `pmi_durezas` — ver
`backend/db/pmi_schema.sql` y la sección fechada más abajo.
`pmi_general` es un espejo 1:1 de la hoja real `1_general` (119 columnas, incluye
columnas con nombres que empiezan con dígito como `"1_m_procedimiento"` — en Postgres
esas van SIEMPRE entre comillas dobles). La decisión de espejo exacto (no JSONB) fue
porque el plan es que **AppSheet lea directo de estas tablas más adelante** — un JSONB
no sirve como fuente de datos de AppSheet, necesita columnas reales.

**Sin tocar todavía**: los datos de inspección de MT/570/510/Espesores/SCAN C —
siguen siendo Sheets/AppSheet en vivo. Cuando se migre alguno, este archivo se
actualiza con una sección nueva.

## Bugs de esquema encontrados migrando datos reales (2026-07-09)

Ninguno de estos se detectó diseñando el esquema en abstracto — todos salieron al
correr la sincronización real contra datos reales:

1. **`serial_adc` no es único**: 6 códigos ADC se repiten en `equipos_ensayo` (datos
   reales de origen, no un error de la migración). Se quitó el `UNIQUE`.
2. **`cc` (cédula) puede ser NULL**: 3 de 251 personas en `personal_certificados` no
   tienen cédula registrada. Columna vuelta nullable.
3. **`correo` no es único en `users`**: "admin" y "diego123" son la misma persona
   real (Diego Alejandro Hernández) con dos logins, mismo correo. Se quitó el
   `UNIQUE`, quedó como índice normal.
4. **`work_orders` no tenía `id_ot`** (el más importante): el diseño original solo
   tenía `numero` (el número visible al usuario, ej. "OT-2026-0001") y asumía —mal—
   que era lo mismo que `id_ot` de Sheets (la clave real, ej. "OT-0001"). El FK de
   `servicios.id_ot` apuntaba a `work_orders.numero`, que nunca iba a calzar.
   Corregido: se agregó la columna `id_ot` a `work_orders`, y el FK de `servicios`
   ahora apunta ahí. **Lección para futuras tablas**: nunca asumir que "número
   visible" y "clave interna de Sheets" son la misma columna — verificar con datos
   reales antes de fijar el FK.

## Rendimiento: pool de conexiones (2026-07-09)

Medido en vivo: abrir una conexión nueva contra Supabase tarda **~1 segundo** (va por
internet, no es localhost). El código original abría una conexión nueva por cada
consulta (`psycopg2.connect()` en cada `fetch_all()`) — una pantalla que hacía 14
consultas (el listado de "Base de Datos", 2 por tabla × 7 tablas) tardaba **19
segundos**, no por Postgres en sí sino por reconectar 14 veces.

Arreglado en `backend/app/db.py` con `psycopg2.pool.ThreadedConnectionPool`
(`minconn=2, maxconn=10`) — `get_connection()` es un context manager que presta del
pool y devuelve, mismo `with get_connection() as conn:` que ya usaba todo el código
(no hubo que tocar `sync_service.py` ni `main.py`).

Además, en `backend/app/admin_export.py`:
- Caché en memoria de `information_schema.columns` por tabla (el esquema no cambia
  mientras el backend corre — no vale la pena reconsultarlo cada vez).
- Los conteos de filas de todas las tablas se piden en **una sola consulta**
  (`UNION ALL`) en vez de una por tabla.

Resultado medido: listado de 7 tablas, 19.2s → **~0.8s** (frío) / **~0.4s** (con
caché caliente). Aplica a cualquier código que use `get_connection()`/`fetch_all()`,
no solo a "Base de Datos" — incluye Sincronización.

**Regla para código nuevo que use Postgres**: nunca abrir conexiones sueltas fuera
del pool, y agrupar consultas en vez de hacer una por tabla/fila cuando se pueda.

## Sincronización real Sheets → Postgres (2026-07-09)

La página "Sincronización" (`SyncPage.tsx`) y el botón "Sincronizar" de Reportes
usaban `mock/client.ts` — `runSync()` literalmente generaba un número aleatorio y
esperaba 1.5s, nunca tocó ni Sheets ni Postgres. Reemplazado por
`backend/app/sync_service.py`: sincroniza de verdad las 7 tablas de soporte,
UPSERT por clave natural (idempotente), con `POST /api/preview/sync` y
`GET /api/preview/sync/runs` guardando historial real en la tabla `sync_runs`
(se le agregó una columna `detalle JSONB` para el desglose por tabla).

## Exportación a Excel para Administrador (2026-07-09)

Página nueva "Base de Datos" (`DatabasePage.tsx` + `backend/app/admin_export.py`),
solo rol ADMINISTRADOR. Cada tabla de Postgres = una hoja del .xlsx descargado, con
selección de filas por ID y filtro de texto.

**Seguridad aplicada en el export** (`EXPORTABLES` dict en `admin_export.py`):
- `password_hash` nunca sale — excluido siempre, sin excepción.
- Los campos `firma_base64` (strings de ~20 KB) no se meten en el Excel — se
  reemplazan por una columna `tiene_firma` (Sí/No). `personal_certificados` conserva
  `firma_link` (la URL de origen) como referencia.
- Datetimes con timezone se limpian antes de escribir (openpyxl no los acepta).
- Solo se exponen las tablas de negocio reales — nada de tablas de sistema vacías
  (`audit_log`, `generated_reports`, etc.).

**Agrupación por selector** (2026-07-09, pedido explícito: "no como listas"): cada
tabla en `EXPORTABLES` tiene un campo `"grupo"` ("General" / "PMI" / ...). El
frontend arma el selector de grupos dinámicamente a partir de eso — agregar un grupo
nuevo (cuando se migre SCAN C, 570, 510 o Espesores) es solo agregar entradas al
dict con su `"grupo"`, no requiere tocar `DatabasePage.tsx`.

## UI: menú superior en vez de sidebar (2026-07-09)

`AppShell.tsx` cambió de barra lateral izquierda fija a **menú superior en dos
filas** (branding+usuario arriba, navegación horizontal debajo) — pedido explícito
del usuario ("me parece muy cliché" la barra lateral). Con hasta 8 ítems para
ADMINISTRADOR, la fila de navegación scrollea horizontal si hiciera falta; en mobile
colapsa a un dropdown con botón hamburguesa.

**Bug de layout encontrado y corregido en el camino**: la tabla de "Base de Datos"
(hasta 15 columnas en algunas tablas) empujaba toda la página más ancha que la
pantalla, cortando botones fuera del viewport. Causa: un hijo de CSS Grid con
contenido ancho no se encoge sin `min-width: 0` explícito — por defecto es `auto`, y
un `overflow-auto` puesto más adentro no sirve de nada si el contenedor padre ya se
infló. Se agregó `min-w-0` al hijo de grid y `minmax(0,1fr)` al grid track. **Regla
para layouts nuevos con tablas anchas dentro de un grid/flex**: siempre `min-w-0` en
el contenedor que tiene el `overflow-auto`, si no el navegador prioriza mostrar todo
el contenido por encima de respetar el ancho del contenedor.

## Dashboard: gráfico de inspector arriba de todo (2026-07-09)

"Reportes generados por inspector" pasó a ser el primer panel del dashboard de
ADMINISTRADOR, a ancho completo (antes compartía una fila de 2 columnas con
"Servicios abiertos por supervisor") — pedido explícito por ser "el más importante".

---

## APP009 Piernas Muertas UT — reporte con lógica distinta (2026-07-09)

Pedido explícito del usuario: "la generación de reportes de este es algo
diferente, respeta esa lógica a la hora de generar este". Verificado contra
el GAS original (`APP009_Piernas_Muertas_UT.js`) y contra datos reales del
Sheet (`1M0Kv_rdvNNVREI3cjDrvW08cBgir4TR_h7lR1rUP0gE`) antes de escribir una
sola línea del motor — igual disciplina que con 570/SCAN C, pero acá SÍ
había diferencias reales que respetar:

- **Jerarquía Sistema → PM**, no un listado plano por id_informe como los
  demás tipos. `0_sistema` agrupa, `1_general` tiene un `id_pm` por pierna
  muerta (138 filas reales). El listado (`GET /api/preview/piernas_muertas`)
  expone `sistema`/`idSistema` por item y el panel (`RealPiernasMuertas
  InspectionsPanel.tsx`) agrega un selector de sistema además del buscador.
- **3 secciones en cascada** (`inspeccion`, `radiografia`, `espesores`),
  mismo patrón de `report_engine_570.py` (2 filas de capacidad en la
  plantilla, se insertan filas extra si hay más registros, offset acumulado
  entre secciones) — verificado con `openpyxl` contra la plantilla real
  (filas 19/20, 39/40, 49/50 confirmadas como 2 filas de capacidad cada una).
- **"espesores" NO tiene bloque de fotos** — a diferencia de las otras 2
  secciones. Así está en el GAS original (`SECTIONS_CONFIG.espesores` no
  tiene `photosConfig`), no es una omisión — `report_engine_piernas_muertas.py`
  respeta esto con un chequeo `"photo_sheet" in config`.
- **Sin firma.** El GAS original (`generarReporteUnico`) nunca escribe
  firma/nombre/cargo/certificación en la plantilla — la sección "REALIZADO
  POR / REVISADO POR / APROBADO POR" (filas 52-57) se deja tal cual la trae
  la plantilla. Confirmado que `1_general` ni siquiera tiene esas columnas.
- **Sin OT, sin link_reporte en el Sheet.** El GAS original rastrea reportes
  ya generados listando archivos en una carpeta de Drive por sistema
  (`REPORTES_PIERNAS_MUERTAS/{id_sistema}_{nombreSistema}/`), no con una
  columna en la hoja — no se replica ese rastreo por carpeta, así que
  `estadoReporte` siempre se reporta como PENDIENTE (no hay forma de saber,
  solo con el Sheet, si ya existe un reporte generado para un `id_pm`).

Verificado extremo a extremo: generación real de `PP509256ca` (sistema
"Recibo") produjo un .xlsx con datos generales correctos, 3 secciones (1
registro/2 fotos en inspección, 1 registro/1 foto en radiografía, 2
registros/0 fotos en espesores) y 4 imágenes insertadas — coincide exacto
con lo mostrado en el panel de la UI.

## APP015 Insp ACFM — desbloqueado (2026-07-09)

El script original en la carpeta del proyecto (`APP015_Insp_ACFM.js`) era un
stub de 6 líneas sin lógica. Se le preguntó al usuario y aportó el script
real (`ReporteACFM.gs`) junto con el ID del Sheet
(`1FCSmWeYjO6u3_jFNmAJwsLc0O4bb1WqPjkdGL-1g88Q`). Traducido a
`report_engine_acfm.py` respetando 3 particularidades reales confirmadas
contra el Sheet y la plantilla real (`ACFM.xlsx`, hoja `FORMATO`):

1. **1 sola fila de capacidad por sección**, no 2 como en 570/Piernas
   Muertas — `processSection_Excel` en el GAS inserta `n - 1` filas (no
   `max(0, n-2)`). La plantilla real tiene una fila 34 con el mismo patrón
   de merges que la 33 (aparenta capacidad de 2), pero el script nunca la
   trata como tal. Se tradujo tal cual, sin "corregir" a que coincida con
   el patrón de otros reportes.
2. **Dos secciones, la segunda sin datos propios.** `fotosGenerales` apunta
   a la hoja general con `mapping: {}` — nunca lee registros, solo ancla un
   segundo bloque de fotos independiente (`1.1_general_PHOTOS`), sin atar a
   ningún registro de `1.1_reporte_datos`.
3. **Fotos filtradas por `id_general`, no por el id de cada registro** — la
   hoja de fotos de `datosACFM` tiene ambas columnas pero el GAS solo usa
   `id_general`, así que todas las fotos del PVID aparecen juntas sin
   importar a qué fila de datos pertenecen.

**Bug real encontrado al generar el primer reporte de prueba**: la
plantilla tiene la celda `L33:M33` fusionada, pero `MAPEO_DE_CELDAS` del
GAS apunta `profundidad_mm` a `L33` (ancla) y `reporte_anexo_grafico_no` a
`M33` (dentro del mismo merge). Apps Script tolera escribir en una celda
no-ancla de un merge sin error (queda invisible detrás del merge);
openpyxl la marca de solo lectura y lanza `AttributeError`. Se agregó
`_escribir_celda()` en `report_engine_acfm.py` que detecta `MergedCell` y
omite la escritura silenciosamente — replica el efecto visual real del
Sheet original en vez de fallar o corromper el valor de la celda ancla.

A diferencia de Piernas Muertas, ACFM SÍ tiene OT, inspector y
`link_reporte` reales en el Sheet — sigue el mismo patrón de panel que
570/510 (sin selector de sistema).

Verificado extremo a extremo: 15 informes reales cargan en el listado,
detalle de `ACFM-TEST-001` muestra 2 secciones (3 registros/17 fotos en
datosACFM, 0 registros/11 fotos en fotosGenerales) y la generación real del
.xlsx completa sin errores con 31 imágenes insertadas (28 fotos + esquema +
registro + firma).

## Estandarización del nombre de hoja interna en templates_xlsx (2026-07-09)

Pedido explícito del usuario tras notar la inconsistencia: cada plantilla
`.xlsx` de `backend/app/templates_xlsx/` tenía su hoja de formato con un
nombre distinto — `FORMATO_MT`, `formato570` (minúscula), `FORMATO_VISUAL`,
`FORMATO_MATERIALES`, `FORMAT` (SCAN C), `formato` (Piernas Muertas), y
`FORMATO` (ACFM, la única ya correcta). Estandarizado a `"FORMATO"` en los
9 archivos (renombrado con openpyxl, `ws.title = "FORMATO"`) y actualizada
la constante `HOJA_FORMATO`/referencia directa en cada `report_engine_*.py`.

**Bug real encontrado en el camino**: `ESPESORES.xlsx` tenía su hoja
interna llamada `FORMATOS_SCAN_C` — resto de copiar/pegar de cuando se
armó el motor de SCAN C a partir del de Espesores. No rompía nada (el
código apuntaba al nombre exacto sin importar si tenía sentido), pero
confundía a cualquiera que abriera el archivo a mano. Corregido de paso.

**Gotcha de openpyxl encontrado**: al renombrar la única hoja de
`PIERNAS_MUERTAS.xlsx` de `"formato"` a `"FORMATO"` en un solo `save()`,
openpyxl la dejó como `"FORMATO1"` (colisión de nombre case-insensitive
consigo misma durante el mismo `wb.save()`). Se resolvió con un segundo
`load_workbook`/`save()` separado — el rename funciona bien cuando el
nombre viejo y el nuevo no coexisten en la misma sesión de escritura.

Verificado generando un reporte real de prueba para los 9 tipos (MT, PMI,
570, 510, Espesores, SCAN C Líneas, SCAN C RP, Piernas Muertas, ACFM) tras
el cambio — los 9 terminan `DONE` sin error.

## Widget flotante — mini-gráfico "Reportes generados por inspector" (2026-07-09)

Pedido explícito del usuario: "en la parte izquierda como ventana flotante,
saliera la ventana de Reportes generados por inspector el pequeño."
Construido en `frontend/src/components/layout/FloatingInspectorChartWidget.tsx`,
montado en `AppShell.tsx` (fuera del `<main>`, dentro del contenedor raíz) —
así persiste entre navegaciones de página en vez de vivir solo en el
Dashboard. Solo visible para rol ADMINISTRADOR (mismo criterio que el
gráfico grande del que es versión reducida). A diferencia del gráfico
grande (desglosado por técnica con colores), acá se suma el total por
inspector y se muestran los 8 con más reportes — el espacio es angosto
(`w-64`, fijo `left-3 top-1/2`) y desglosar por técnica no cabría legible.
Colapsable a una pestaña angosta con flecha (botón "Ocultar"/"Mostrar
reportes por inspector") para no tapar contenido de las páginas.

**Ajustes 2026-07-09 (2ª pasada, pedido explícito)**: más alto (12
inspectores en vez de 8, barras más gruesas) y con una sección nueva de
"Servicios activos" debajo del gráfico — lista los servicios con
`estado === "EN_CURSO"` (`fetchServicios()`, mismo criterio que el badge
"En curso" de `WorkOrdersPage`), mostrando `idOt` + técnica. Se cambió el
anclaje de `top-1/2 -translate-y-1/2` (centrado vertical) a `top-20` fijo
con `max-h-[calc(100vh-6rem)]` y scroll interno — centrar verticalmente ya
no funcionaba bien una vez que el contenido creció, se saldría del viewport
en pantallas bajas. Verificado en navegador: el widget renderiza, colapsa y
expande correctamente; la sección de servicios activos no aparece en los
datos actuales porque los 2 servicios reales existentes están en
`PENDIENTE` (ninguno `EN_CURSO` todavía) — comportamiento correcto del
filtro, no falta nada por corregir.

## Sincronización de PMI agregada al botón "Sincronizar" (2026-07-10)

Pedido explícito del usuario: "Que en el apartado de sincronizar tambien
sincronice las tablas de PMI." El esquema (`pmi_general`/`pmi_quimica`/
`pmi_durezas`) existía desde el 2026-07-09 pero le faltaba el script de
sync — ahora corre junto con las 7 tablas de soporte en el mismo botón
"Sincronizar ahora" (`sync_service.py`, funciones `sync_pmi_general`/
`sync_pmi_quimica`/`sync_pmi_durezas`, agregadas a `TABLAS_SYNC`).

- **`pmi_general`**: UPSERT por `id_general` (clave natural, igual que las
  demás tablas), construido dinámicamente a partir de una lista whitelist
  de 119 columnas (`PMI_GENERAL_COLUMNAS`) en vez de escribir el mapeo a
  mano — evita 119 líneas repetitivas y, si el Sheet suma una columna
  nueva, alcanza con agregarla ahí y en `pmi_schema.sql`.
- **`pmi_quimica`/`pmi_durezas`**: reemplazo completo por `id_general`
  (`DELETE` + `INSERT`) en vez de UPSERT por fila — lo que importa es el
  conjunto agregado (promedios, Carbono Equivalente, gráfico de durezas),
  no el historial de cada fila individual; la fuente de verdad son las
  filas ACTUALES del Sheet. Ambas se filtran contra los `id_general` reales
  de `1_general` antes de insertar, para no violar el FK con filas
  huérfanas (id_general borrado o mal escrito en la hoja hija).
- **`elemento`** en `pmi_quimica`: el Sheet trae "1.12%" como texto → se
  guarda como FRACCIÓN (0.0112), mismo criterio que `calcular_ce()` en
  `report_engine_pmi.py`.
- **`orden`** en `pmi_durezas` (NOT NULL, no viene en el Sheet): se asigna
  secuencial por `id_general` en el mismo orden en que aparecen las filas
  — coincide con cómo `report_engine_pmi.py` las va llenando en la tabla
  del reporte (`RANGO_DUREZAS`).
- **Parser de fecha propio para PMI** (`_parse_fecha_dmy`): la columna
  `fecha` de `1_general` viene en formato DD/MM/YYYY (confirmado con datos
  reales, ej. `18/03/2026` — el día 18 descarta MM/DD). Las otras 7 tablas
  usan `_parse_fecha` (que prueba MM/DD/YYYY) — no se unificaron para no
  arriesgar reinterpretar mal fechas de sincronizaciones ya probadas en
  producción.

**Bug de performance real encontrado al probar con datos reales**: la
primera versión hacía un `cur.execute()` por fila (mismo patrón que las
otras 7 tablas). Para `pmi_general` (114 filas) es imperceptible, pero
`pmi_quimica` (2202 filas) y `pmi_durezas` (3668 filas) tardaban **varios
minutos** por la latencia de red de cada round-trip hasta Supabase — se
interrumpió la prueba a los 3+ minutos sin haber terminado. Corregido con
`psycopg2.extras.execute_values` (inserción por lotes de 200-500 filas):
las 3 tablas completas (114 + 2202 + 3668 = 5984 filas) bajaron a **8.8
segundos** de escritura. La corrida completa desde el botón real de la UI
(que también relee las 10 hojas de Sheets desde cero, no solo escribe)
tardó ~1m30s — aceptable para un botón manual de administrador, no es un
flujo automático de alta frecuencia.

Verificado extremo a extremo: `POST /api/preview/sync` real devuelve
`{pmi_general: 114, pmi_quimica: 2202, pmi_durezas: 3668, ...}` junto con
las 7 tablas anteriores, `totalFilas: 6330`, sin errores; probado también
haciendo clic en "Ejecutar ahora" desde el navegador — el historial de
`/sync` muestra el desglose por tabla al expandir la corrida.

## Se quita el widget flotante de "reportes por inspector" (2026-07-10)

Pedido explícito del usuario: "quiero que quites esa ventana, ese grafico
como tal." Se eliminó por completo — `FloatingInspectorChartWidget.tsx`
borrado, y su montaje en `AppShell.tsx` (fuera de `<main>`) removido. El
gráfico grande equivalente ("Reportes generados por inspector") sigue
existiendo en el Dashboard, solo se quitó la versión flotante/colapsable
que aparecía en todas las páginas.

## "Nuevo Servicio" — OT deja de ser obligatoria (2026-07-10)

Pedido explícito del usuario: "lo de nuevo servicio deberia ser un listado
como el que sale en nueva ot solo que con un id servicio que se crea
automaticamente y no es obligatoria la ot."

Antes, crear un servicio desde el botón global "Nuevo Servicio" exigía una
OT — el frontend lo resolvía con un hack: creaba una OT con número
placeholder (`S/N-<timestamp>`) solo para poder colgar el servicio de ahí
(`NewServicioDirectoModal`, ver commit anterior). Eliminado por completo:

- **Backend** (`POST /api/preview/servicios`, `main.py`): `idOt` pasa de
  obligatorio a opcional. Si viene vacío, el servicio se crea sin `id_ot`
  en la hoja `servicios` (antes ese caso ni siquiera se podía dar, la
  validación cortaba con 422 "Falta idOt"). Si viene, sigue validando que
  la OT exista antes de crear el servicio.
- **Postgres** (`servicios.id_ot`): era `VARCHAR(50) NOT NULL REFERENCES
  work_orders(id_ot)` — se corrió `ALTER TABLE servicios ALTER COLUMN
  id_ot DROP NOT NULL` en Supabase y se actualizó `schema.sql` para que
  coincida. `sync_servicios()` ahora manda `NULL` en vez de `""` cuando el
  Sheet trae la celda vacía (una FK con valor `""` literal habría fallado
  igual, aunque la columna ya admitiera NULL).
- **Frontend** (`WorkOrdersPage.tsx`): `NewServicioDirectoModal` (modal
  chico, pedía cliente/ubicación para la OT placeholder) reemplazado por
  `NewServicioModal`, con la MISMA estructura visual que `NewOTModal`
  (grid de 2 columnas, mismo header/footer del modal) — pedido explícito
  de que "sea un listado como el que sale en nueva ot". Campos: Técnica
  (obligatoria) y OT asociada (`<select>` opcional con las OTs reales
  cargadas, default "Sin OT asociada"). El id_servicio se sigue generando
  automático en el backend (`SRV-XXXXXXXX`), no se pide en el formulario.
  `crearServicio()` en `previewClient.ts` cambió de firma
  `(idOt, tecnica)` a `(tecnica, idOt?)` para reflejar que la OT ahora es
  el parámetro opcional.
- Se agregó una sección nueva "Servicios sin OT asociada" en
  `WorkOrdersPage.tsx` (debajo de la grilla de OTs) — sin esto, un
  servicio creado sin OT quedaría invisible en la página, porque el
  listado de servicios por OT (`ServiciosDeOt`) solo muestra los que están
  vinculados a una.

Verificado extremo a extremo: `POST /api/preview/servicios` con solo
`{"tecnica": "MT"}` (sin idOt) crea el servicio y aparece en
`GET /api/preview/servicios` con `idOt: ""`; probado también con idOt
presente (flujo que ya funcionaba, sigue funcionando); confirmado en el
navegador que el modal nuevo tiene la misma apariencia que "Nueva OT" y
que la sección "Servicios sin OT asociada" muestra el servicio recién
creado.

## Servicios sin OT: falta el supervisor que lo solicitó (2026-07-10)

Al hacer OT opcional en la creación de un servicio (sección anterior), el
usuario notó un problema real revisando la hoja: la fila del servicio no
tenía forma de saber quién lo pidió — la hoja `servicios` nunca tuvo una
columna de supervisor (a diferencia de `work_orders`, que sí la tiene desde
el inicio). Pedido explícito: "es importante que salga el supervisor que
solicitó el servicio."

- **Columna nueva en el Sheet real**: `supervisor_usuario` agregada a
  `servicios!L1` (antes solo tenía 11 columnas, A:K). `append_row()` solo
  escribe columnas que ya existen en la fila de encabezados — sin este
  paso, mandar `supervisor_usuario` en el payload se habría descartado en
  silencio.
- **Backend** (`POST /api/preview/servicios`): `supervisorUsuario` pasa a
  ser obligatorio (422 si falta) — mismo criterio que `work_orders`: se
  toma SIEMPRE del usuario autenticado que hace la petición, nunca de un
  `<select>` a elegir.
- **Fallback para servicios viejos con OT** (`GET /api/preview/servicios`):
  los servicios creados antes de que existiera esta columna, pero que sí
  tienen `id_ot`, muestran el supervisor de esa OT como respaldo (se
  construye un diccionario `id_ot -> supervisor_usuario` leyendo
  `work_orders` una sola vez, solo si hace falta). Los servicios viejos
  SIN OT (2 casos de prueba creados hoy antes de este cambio) quedan sin
  supervisor conocido — no hay forma de recuperar ese dato retroactivamente.
- **Postgres**: `servicios.supervisor_usuario VARCHAR(50) REFERENCES
  users(usuario)` agregada con `ALTER TABLE` en Supabase + `schema.sql`
  actualizado; `sync_servicios()` la sincroniza.
- **Frontend**: `RealServicio.supervisorUsuario`, `crearServicio()` cambia
  de firma a `(tecnica, supervisorUsuario, idOt?)` — ambos call sites
  (`NewServicioModal` y el botón rápido "+ Generar servicio X" dentro de
  una OT) pasan `user.usuario` del contexto de auth. Se muestra "Solicitó:
  {supervisor}" en las filas de servicios (dentro de una OT y en la
  sección "Servicios sin OT asociada"), y el modal de creación muestra
  "Solicitante: {nombre} (tú)" igual que el modal de OT.

Verificado extremo a extremo: crear servicio sin `supervisorUsuario` da
422; con él, se crea y aparece con el supervisor correcto; los 4 servicios
viejos vinculados a una OT ahora muestran el supervisor de esa OT vía el
fallback (`crojas` en los casos reales); confirmado en el navegador tanto
en la vista expandida de una OT como en "Servicios sin OT asociada".

## Tanda de 8 pedidos: EquiposPage, Servicios, advertencias y revisor PMI (2026-07-10)

El usuario mandó una lista numerada de 8 cambios en un solo mensaje. Antes de
tocar código se investigó el estado real de cada uno (agente de
investigación dedicado) y se preguntó al usuario el alcance de los dos
puntos más grandes/ambiguos (6 y 8) antes de implementar, para no rehacer
trabajo. Resumen de lo que se hizo, punto por punto:

**1. Reloj + modo oscuro/claro (EquiposPage).** Tailwind v4 no trae
`darkMode` en config JS — se usa `@custom-variant dark (&:where(.dark, .dark
*));` en `index.css`. `ThemeContext.tsx` nuevo (mismo patrón que
`AuthContext.tsx`): persiste en localStorage, aplica/quita la clase `.dark`
en `<html>`. El toggle y el reloj (`RelojActual`, actualiza cada segundo)
viven en `EquiposPage.tsx`. **Alcance deliberadamente limitado**: por ahora
SOLO `EquiposPage.tsx` tiene estilos `dark:` aplicados — el resto de
páginas no cambia visualmente todavía al togglear (retrofit completo del
resto de la app queda pendiente, es un trabajo aparte).

**2. Fechas de calibración — investigación de datos reales.** No hay
ninguna fórmula automática (no es `fecha_calibracion + N meses`): el campo
`fecha_vencimiento_calibracion` es 100% entrada manual en
`equipos_ensayo`. Se investigaron los 64 equipos reales y se encontraron 2
problemas de datos concretos (no de código):
  - **4 equipos con `fecha_calibración == fecha_vencimiento`**
    (EQ-0027, EQ-0028, EQ-0034, EQ-0059 — todos REDDY-32/ACFM). Probable
    error de tipeo (alguien copió la misma fecha en los dos campos). NO se
    corrigió automáticamente — no hay forma de adivinar la fecha correcta,
    hay que corregirlo a mano en el Sheet.
  - **35 de 64 equipos sin `fecha_vencimiento_calibracion`** — la UI
    anterior los trataba silenciosamente como "todo bien" (el chequeo
    `dias <= 60` da `false` con fecha vacía). Corregido en el punto 5.

**3. "Roster de certificados" → "Certificados".** Cambiado el label del
tab (`EquiposPage.tsx`) y el texto descriptivo bajo el tab ("Roster maestro
de RRHH" → "Listado maestro de RRHH"). El identificador interno
`Tab = "roster"` no se tocó (no es visible al usuario).

**4. Nombre/cédula ya no editables en la tabla de Certificados.**
Frontend: las celdas de `nombre`/`cc` en `CertificadosTab` pasan de
`ComboSelect`/`<input>` a texto plano; se sacaron de `CertificadoEdit`
(el tipo de los campos editables). Backend: se sacaron de
`_CAMPOS_CERTIFICADO_PERSONAL` (el PATCH ya no las acepta, defensa en
profundidad). Siguen siendo editables al CREAR un certificado nuevo — solo
se bloqueó la edición inline de un registro existente.

**5. Advertencia "faltan N días para vencer" (2 meses antes).** Helper
compartido `estadoFechaVencimiento()` en `EquiposPage.tsx` (usado por
Equipos Y Certificados): calcula `vencido` / `por_vencer` (≤60 días) /
`vigente` / `sin_fecha`. Componente `AvisoVencimiento` muestra el texto
bajo el campo de fecha ("Faltan 12 días para vencer", "Vencido hace 182
días", "Sin fecha registrada"). Esto también resuelve el hallazgo del
punto 2: los 35 equipos sin fecha ahora se ven con una advertencia
explícita en vez de "todo bien" silencioso.

**6. Página "Órdenes de Trabajo" → "Servicios" (OT deja de ser el
concepto central).** Confirmado con el usuario: "ocultar OT de la UI,
mantener el dato" (no borrar `work_orders` ni su sync). Reescrita
`WorkOrdersPage.tsx` completa: se quitó la grilla de tarjetas de OT, el
botón "Nueva OT" y `NewOTModal` (código muerto, borrado). La página ahora
es un listado plano de TODOS los servicios (`fetchServicios()` sin
filtro), con la OT (si tiene) como una columna más ("OT asociada"), no
como estructura. El modal "Nuevo Servicio" sigue con OT opcional (ya se
había hecho eso 2026-07-10 más temprano). Nav renombrado: "Órdenes de
Trabajo"/"Mis OTs" → "Servicios"/"Mis Servicios" (`navConfig.ts`). La ruta
`/ots` NO se renombró (detalle interno, no visible al usuario).

**7. Columna de advertencias en las tablas de reporte.** Antes,
`_tiene_certificado_para_tecnica` (main.py) solo generaba un toast DESPUÉS
de generar el reporte, y solo chequeaba EXISTENCIA de certificado, nunca
vencimiento. Nueva función `_advertencias_generacion(nombre, tecnica)`:
  - Certificado: "Sin certificado de X registrado" o "Certificado de X
    vencido" (usa `_calcular_estado_certificado`, ya existía para el
    roster) — antes un certificado vencido no generaba ninguna advertencia.
  - Equipos: "Equipos de X sin calibración vigente registrada", vía
    `_TECNICA_A_CATEGORIAS_EQUIPO` — mapeo conservador técnica→categoría de
    equipo (MT, PMI→CMAT, ESPESORES, SCANC_LINEAS/RP→PAUT_SCANC, ACFM). Se
    dejaron AFUERA 570/510/PIERNAS_MUERTAS a propósito: no hay una
    categoría de equipo identificable con confianza en los datos reales
    para esas técnicas, y prefiero no mostrar una advertencia inventada.
  - Conectado a las 7 funciones `list_*_inspections` relevantes (no
    Piernas Muertas, que no maneja certificación por diseño). Campo
    `advertencias: string[]` nuevo en los 7 tipos `*PreviewItem` del
    frontend. Componente compartido `AdvertenciasCell.tsx` (ícono ⚠ +
    texto ámbar) agregado a las 7 tablas de listado como columna nueva.
  - Verificado con datos reales: 49 de 50 informes MT muestran "Equipos de
    MT sin calibración vigente registrada" — confirmado que es correcto
    (los 3 equipos categoría MT reales no tienen ninguno con calibración
    vigente hoy), no un bug de la lógica.

**8. Firma de "revisor" en PMI — confirmado con el usuario: solo mejorar
PMI, no extender a los 9 formatos todavía.** El flujo ya existía
(`ConfigurarLoteModal`, solo para generación por LOTE) pero pedía
nombre/cargo a mano y requería volver a subir la imagen de firma cada vez,
incluso para revisores que ya son usuarios registrados con firma en la
plataforma. Mejora: selector "Revisor registrado" (`<select>` poblado con
`fetchRealUsers()`) tanto en `ConfigurarLoteModal` COMO en la generación
INDIVIDUAL (que antes no tenía ninguna forma de elegir revisor, quedaba
fijo al usuario autenticado). Al elegir alguien de la lista, el backend
resuelve su nombre/cargo/firma automáticamente (mismo mecanismo que ya
existía para "tu propia firma" en `_generar_bytes_pmi`, generalizado — no
hubo que tocar el backend, `overrides.supervisor_usuario` ya aceptaba
cualquier usuario, no solo el que hace la petición). El campo manual queda
como respaldo para revisores que no están en la plataforma, con prioridad
sobre la selección.

Verificado extremo a extremo en el navegador para los 8 puntos: reloj y
modo oscuro visibles y funcionales en Equipos; nombre/cédula de solo
lectura con "Vencido hace 182 días" real en la tabla; página "Servicios"
sin grilla de OT, con "Sin OT"/OT real por fila; columna "Advertencias" con
texto real en MT/PMI; selector de revisor con usuarios reales (incluye "—
sin firma cargada" cuando aplica) funcionando en ambos modales de PMI. Sin
errores de consola en ningún caso.

## EquiposPage: se quita el tab "Usuarios de la webapp" y se agregan filtros por columna (2026-07-14)

Pedido explícito: "En la parte de equipos, donde sale usuarios webapp elimina esa
parte... que se pueda filtrar desde cada tabla osea que debajo del enunciado de la
columna que se pueda filtrar."

- `EquiposPage.tsx`: se eliminó por completo el tab `personal` ("Usuarios de la
  webapp") — el componente `PersonalUsuariosTab`, el modal `CertificatesModal`, y su
  entrada en `TABS`. `Tab` ahora es solo `"equipos" | "roster"` y el tab por defecto
  pasa a ser `"equipos"`. Las funciones `fetchRealUsers`/`fetchUserCertificates`/
  `updateUserCertificates` siguen existiendo en `previewClient.ts` y se usan en
  `UsersPage.tsx` y en el selector de revisor de PMI — no se tocaron, solo se dejaron
  de importar en `EquiposPage.tsx`.
- En `EquiposFisicosTab` y `CertificadosTab`: se reemplazó la barra de filtros de
  arriba de la tabla (buscador + selects sueltos) por una segunda fila dentro del
  `<thead>`, con un input o select de filtro debajo de cada encabezado de columna
  (Categoría, Equipo, Serie, Serial ADC, Vencimiento, Observaciones, Estado en
  Equipos físicos; Nombre, CC, Técnica, Nivel, # Certificado, Estado en
  Certificados). Cada filtro es un estado independiente (`filtroCategoria`,
  `filtroEquipo`, `filtroSerie`, etc.) que entra al `useMemo` de `filtered`.
- Verificado en navegador (`localhost:5174/equipos`): el tab "Usuarios de la webapp"
  ya no aparece, el filtro de categoría "MT" filtra la tabla correctamente, la
  pestaña Certificados muestra su propia fila de filtros, y no hay errores de
  consola. `npx tsc --noEmit` sin errores.

## 570: bloques Revisado por/Aprobado por — Espesores: bloque Aprobado por (2026-07-14)

Pedido explícito: en 570, "que al seleccionar bastante, me dé la libertad de
colocar el revisado por" en Y165 (firma)/Y166 (nombre)/Y167 (cargo)/Y168
(certificado)/Y169 (fecha, automática) — y lo mismo para "Aprobado por" en la
columna AN (AN165-169). En Espesores, mismo patrón para "Revisado por" (ya
existía en P40-44) y agregar "Aprobado por" en AC40-44.

- `report_engine_570.py`: nuevos bloques `CELDA_FIRMA_REVISOR`/
  `CELDAS_TEXTO_REVISOR` (Y165-169) y `CELDA_FIRMA_APROBADOR`/
  `CELDAS_TEXTO_APROBADOR` (AN165-169), verificados contra la plantilla real
  (celdas combinadas vacías, listas para llenarse). Se leen de
  `fila_general['revisor_*']`/`'aprobador_*'` (nombre/cargo/certificado/
  firma_link); la fecha siempre es `datetime.now()`, nunca viene de overrides.
- `report_engine_espesores.py`: nuevo bloque `CELDA_FIRMA_APROBADOR`/
  `CELDA_NOMBRE_APROBADOR`/etc. (AC40-44), mismo patrón que el bloque
  "Revisado por" (P40-44) que ya existía desde antes.
- `main.py`: nuevo helper `_resolver_bloque_firma(fila_general, overrides,
  prefijo)` — generaliza el patrón de dos vías ya usado para `supervisor_*`
  en PMI/Espesores (override manual `<prefijo>_nombre_manual`/etc. con
  prioridad sobre `<prefijo>_usuario` resuelto contra la hoja `usuarios`).
  Usado en `_generar_bytes_570` (revisor + aprobador) y
  `_generar_bytes_espesores` (aprobador; el bloque "revisor" de Espesores
  sigue usando el nombre histórico `supervisor_*`, sin renombrar, para no
  romper el modal de lote ya en producción).
- Frontend: `Real570InspectionsPanel.tsx` y `RealEspesoresInspectionsPanel.tsx`
  ganan selects "Revisor"/"Aprobador" (usuarios registrados en la
  plataforma, con opción "— Ninguno —") junto al botón "Generar reporte",
  mismo patrón ya usado en PMI.
- **Bug encontrado y corregido durante la verificación**: el primer intento
  de escribir en columnas de dos letras (AN, AC) usaba `celda[0]`/`celda[1:]`
  para separar columna/fila — funciona para columnas de una letra (J, P, Y)
  pero rompe con "AN165" (da columna "A" y fila "N165", que no es un
  entero). Corregido con un helper `_col_fila(celda)` basado en regex
  (`re.match(r"([A-Z]+)(\d+)", celda)`) en ambos motores.
- **Segundo problema, de infraestructura, no de código**: la verificación end
  to end falló varias veces con el mismo error viejo pese a haber corregido
  el bug — causa real: un proceso `python3.11.exe` huérfano (hijo del
  reloader de `uvicorn --reload` de una sesión anterior) seguía escuchando
  en el puerto 8000 y respondiendo con el código viejo, mientras
  `Get-Process`/`tasklist` no lo listaban por PID (gotcha ya documentado en
  memoria de esta sesión: los procesos `python3.11.exe` a veces no aparecen
  con las mismas herramientas que `python.exe`). Se identificó vía
  `Get-NetTCPConnection -LocalPort 8000` (mostraba el PID real del
  listener) y se mató con `Stop-Process -Id <pid> -Force`.
- Verificado con datos reales vía `curl` directo al backend (no solo en el
  navegador): reporte de 570 (`Reporte_api570_c06ab277`) con revisor="admin"
  (Diego Alejandro Hernandez) y aprobador="angela" (Angela Suarez) — Y166-169
  y AN166-169 quedaron con nombre/cargo/certificado/fecha correctos.
  Reporte de Espesores (`REPORT_SCAN9556eeca`) con los mismos overrides —
  P49-52 y AC49-52 (offset +9 filas por lecturas/fotos insertadas) quedaron
  correctos. `npx tsc --noEmit` sin errores.

## Pendiente (no resuelto, anotado para no perderlo)

- Conectar AppSheet directo a `pmi_general` en Postgres en vez de a la hoja de
  Sheets — es el objetivo final de haber hecho el espejo 1:1, todavía no se hizo
  (requiere configurar esto DENTRO de AppSheet, no es código).
- Evaluar si vale la pena migrar 570/510/SCAN C/Espesores/Piernas Muertas/ACFM
  con el mismo patrón de PMI.
- Corregir a mano en el Sheet los 4 equipos con fecha_calibracion ==
  fecha_vencimiento_calibracion (EQ-0027, EQ-0028, EQ-0034, EQ-0059) — no se
  puede adivinar la fecha correcta desde el código.
- Retrofit de modo oscuro al resto de páginas (hoy solo EquiposPage
  responde al toggle).
- Extender la firma de "revisor" (con selector de usuario registrado, ver
  punto 8) a los otros 8 motores de reporte — hoy solo PMI la tiene
  completa; 570 tiene la plantilla y el código de escritura de celda ya
  listos mas el backend nunca los alimenta (`_generar_bytes_570` no arma
  `supervisor_*`), sería el candidato más rápido de extender.

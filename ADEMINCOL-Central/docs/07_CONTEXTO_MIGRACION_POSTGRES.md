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

**Si migrado a Postgres** (tablas de soporte, tienen sync real):
`users`, `work_orders`, `servicios`, `equipos_ensayo`, `personal_certificados`,
`certificados_usuarios`, `consecutivos_reportes` — ver `backend/db/schema.sql`.

**Esquema creado, sin datos todavía** (PMI, la "prueba piloto" del plan original):
`pmi_general`, `pmi_quimica`, `pmi_durezas` — ver `backend/db/pmi_schema.sql`.
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

## Pendiente (no resuelto, anotado para no perderlo)

- Migrar datos reales de PMI (Sheets → `pmi_general`/`pmi_quimica`/`pmi_durezas`) —
  el esquema ya existe, falta el script de sync (sería el 4º después de
  usuarios/equipos/certificados/consecutivos).
- Conectar AppSheet directo a `pmi_general` en Postgres en vez de a la hoja de
  Sheets — es el objetivo final de haber hecho el espejo 1:1, todavía no se hizo
  (requiere configurar esto DENTRO de AppSheet, no es código).
- Evaluar si vale la pena migrar 570/510/SCAN C/Espesores/Piernas Muertas/ACFM
  con el mismo patrón de PMI.

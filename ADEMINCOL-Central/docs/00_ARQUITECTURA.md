# Fase 0 — Arquitectura y decisiones de diseño

Leer completo antes de escribir código. Aquí están las decisiones YA TOMADAS y su porqué.
No re-decidir nada de esta lista sin consultar al usuario.

---

## 1. Decisiones tomadas

### D1. AppSheet se queda (por ahora)
Los inspectores ya están entrenados en AppSheet, funciona offline en campo, y
reemplazarlo detendría la operación. La plataforma nueva **lee** los Google Sheets
que AppSheet alimenta; no los modifica.

**Futuro (fase 7+, fuera de alcance):** una PWA propia en React podría reemplazar
AppSheet. La arquitectura lo permite porque la captura está desacoplada del resto.

### D2. Google Sheets sigue siendo el punto de entrada, PostgreSQL es la fuente de verdad
- Sheets = buffer de captura (AppSheet escribe ahí).
- PostgreSQL = donde vive la data consolidada, con historial e integridad.
- El sync copia Sheets → Postgres. **Nunca al revés** (excepto el campo
  `link_reporte`, ver D6).

### D3. Los reportes Excel se generan en el backend con openpyxl, NO en GAS
Razones:
- GAS tiene límite de 6 minutos por ejecución → reportes grandes fallan.
- openpyxl no tiene límite, corre en el servidor, y las plantillas `.xlsx`
  se versionan en Git.
- La lógica ya probada de los scripts GAS (mapeo de celdas, imágenes flotantes
  centradas, filas dinámicas) se **traduce** a Python — ver 04_GENERACION_REPORTES.md.

### D4. Stack fijo
| Capa | Tecnología | Versión mínima |
|------|-----------|----------------|
| Backend | FastAPI + SQLAlchemy 2.x + Alembic | Python 3.11 |
| BD | PostgreSQL | 15 |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | Node 20 |
| Auth | JWT (access 30 min + refresh 7 días) con `python-jose` | — |
| Passwords | `bcrypt` (directo, NO `passlib` — bug de compat. con bcrypt>=4.1, ver 02_BACKEND_FASTAPI.md) | — |
| Excel | `openpyxl` | 3.1+ |
| Sheets API | `google-api-python-client` + service account | — |
| Contenedores | Docker Compose | — |

### D5. Tres roles, mismos que webapp-supervisores
`ADMINISTRADOR`, `SUPERVISOR`, `INSPECTOR`. Permisos:

| Acción | Admin | Supervisor | Inspector |
|--------|:-----:|:----------:|:---------:|
| CRUD usuarios | ✅ | ❌ | ❌ |
| Ver indicadores globales | ✅ | ❌ | ❌ |
| CRUD OTs | ✅ | ✅ | ❌ |
| Ver OTs asignadas | ✅ | ✅ | ✅ (solo suyas) |
| Generar reportes | ✅ | ✅ | ❌ |
| Descargar reportes | ✅ | ✅ | ✅ (solo suyos) |
| Forzar sync manual | ✅ | ✅ | ❌ |

### D6. Escritura de vuelta a Sheets: SOLO `link_reporte`
Cuando el supervisor genera un reporte, el backend escribe la URL del reporte en la
columna `link_reporte` de la hoja general correspondiente (igual que hacen hoy los
scripts GAS). Es la única escritura permitida hacia Sheets, para que AppSheet pueda
mostrar el link al inspector.

### D7. Orden de implementación de reportes (decidido por el usuario)
1. **MT (Partículas Magnéticas)** — piloto. Es el mejor documentado (APP022) y de
   complejidad media.
2. **PMI (Caracterización de Materiales)** — segundo. Referencia:
   `ADEMINCOL-Scripts/APP004_Caract_Mat_PMI/APP004_Caract_Mat_PMI.js`.
3. Después: VT soldadas (APP034), Espesores UT (APP001) y el resto.

El motor de reportes debe ser **genérico desde el día 1** (definiciones por tipo de
reporte en archivos de configuración, no código duplicado).

### D8. Firmas de usuarios: base64 en la base de datos (decidido por el usuario)
Las firmas de supervisores e inspectores se guardan como **base64 en una columna TEXT
de PostgreSQL** (`users.firma_base64`), no como archivos en disco. Razones:
- Una firma pesa 10-100 KB → tamaño trivial para Postgres.
- El backup de la BD incluye las firmas automáticamente (un solo artefacto que respaldar).
- Sin riesgo de BD y carpeta de archivos des-sincronizadas.
- El motor de reportes las decodifica directo (`base64.b64decode`) para insertarlas
  en el Excel, sin tocar disco.

Reglas: validar en el upload que sea PNG/JPEG y máximo 2 MB; recomendar PNG con fondo
transparente para que la firma se vea limpia sobre el formato.
**Requisito operativo:** antes de salir a producción, recolectar la firma de TODOS los
supervisores e inspectores activos (cada usuario puede subirla desde su perfil; el
admin también puede subirla por cualquier usuario).

### D9. Ubicación del proyecto
`ADEMINCOL-Central/` vive DENTRO de `ADEMINCOL-Scripts/` (repositorio Git
`ADC_Scripts_Generacion_de_reportes`), que es el resguardo principal. Cualquier
modificación de arquitectura se hace en los docs de esta carpeta.

### D10. Backend de preview (temporal, sin BD) — ya construido
Antes de llegar a la Fase 1, se construyó `backend/app/main.py` + `report_engine_mt.py`:
lee Google Sheets en vivo (sin caché, sin auth) y genera el reporte MT REAL con la
plantilla verificada (`templates_xlsx/MT.xlsx`), incluyendo imágenes centradas y filas
dinámicas — ver `backend/README.md`. El frontend lo consume en la pestaña MT de
Inspecciones (`components/domain/RealMtInspectionsPanel.tsx`), que reemplazó los datos
simulados de MT (el mock de PMI/VT/UT sigue vigente hasta que se conecten).
**Este motor de reportes YA resuelve gran parte de la Fase 4 para MT** — cuando se
llegue a esa fase, se generaliza (config por tipo) en vez de reescribirse desde cero.

### D11. Usuarios/OTs: BD temporal en Google Sheets + AppSheet (decidido por el usuario, 2026-07-02)
Antes de construir PostgreSQL (Fase 1), se prueba todo el flujo de usuarios/roles/firmas/OTs
con una hoja de Google Sheets administrada por AppSheet — ver `sheets-db/CrearHojasBD.gs`.
Razones: cero fricción de infraestructura para probar, AppSheet da captura gratis, y las
columnas están diseñadas idénticas a `users`/`work_orders` en `01_BASE_DE_DATOS.md`, así
que migrar a Postgres después es copiar filas, no rediseñar.
- Las hojas creadas: `usuarios` (con columna `firma` tipo Signature de AppSheet) y
  `work_orders`, mismas columnas que las tablas Postgres ya documentadas.
- `password_hash` se genera con `sheets-db/hashear_password.py` (bcrypt directo) y se
  pega manualmente — AppSheet no tiene funciones de hash, por eso este paso es aparte.
- **Esto NO reemplaza el plan de PostgreSQL** — es el "gemelo" de prueba que el usuario
  pidió explícitamente. Cuando se construya la Fase 1 real, este Sheet se usa como fuente
  para poblar la BD real (mismo patrón que el sync de MT).
- ⚠️ `passlib[bcrypt]` NO FUNCIONA (ver D-nota en Paso 2.4 de `02_BACKEND_FASTAPI.md`) —
  usar `bcrypt` directo en cualquier lugar que necesite hashear contraseñas.

### D12. "Equipos" = equipo de trabajo (certificados de inspectores), NO equipos físicos
Duda resuelta con el usuario 2026-07-03: la pantalla "Equipos" (`/equipos`,
`EquiposPage.tsx`) gestiona los **certificados de los inspectores/supervisores**
(ASNT, SNT-TC-1A, etc.), reutilizando `usuarios` + una tabla nueva
`certificados_usuarios` (1 usuario → N certificados, con fecha de emisión/vencimiento
y link a PDF). **No existe ni se necesita una tabla de "equipos físicos" de END** —
ese concepto no está en el alcance actual. Si en el futuro se requiere inventario de
equipos de ensayo (durómetros, gausímetros, etc.) con sus propias fechas de calibración,
sería una tabla nueva y separada (`equipos_ensayo`), no lo que ya existe.

### D13. Firma capturada en el perfil: prioridad sobre firma_link del Sheet — ya conectado
El `SignaturePad` (`components/ui/SignaturePad.tsx`, canvas HTML5 o subida de imagen)
guarda la firma en base64 en `usuarios.firma` (BD Sheets). El motor de reportes
(`_buscar_firma_usuario()` en `main.py`) la usa con **prioridad sobre** `firma_link` del
Sheet de origen (MT/PMI), buscando por nombre con match tolerante (ver función,
confirmado el 2026-07-03 que los nombres casi nunca son idénticos entre sistemas —
ej. "Diego Alejandro Hernandez" en BD vs "...Hernandez Blanco" en el informe — se hace
match si el nombre más corto está contenido como subconjunto de palabras en el más largo).
`descargar_imagen()` (en `image_utils.py`) soporta both URLs http(s) y data URIs
`data:image/...;base64,...`.

### D14. PMI (Caracterización de Materiales) conectado — segundo tipo de reporte real
Igual que MT: `report_engine_pmi.py` + endpoints `/api/preview/pmi*` +
`RealPmiInspectionsPanel.tsx`, verificado con datos e imágenes reales el 2026-07-03.
Diferencias clave frente a MT:
- Usa **rangos fijos** en la plantilla (química: 18 slots, durezas: 59 slots) — NO hace
  falta insertar filas dinámicamente, así que no aplica el problema de merges/alturas que
  tuvo MT.
- El Carbono Equivalente (CE) se recalcula en Python (`calcular_ce()`) en vez de depender
  del trigger de Apps Script — el trigger de Sheets solo corre cuando AppSheet escribe,
  no bajo demanda.
- Hojas usadas: `1_general`, `2_quimica`, `3_durezas`. Hojas NO usadas por el reporte
  (confirmado contra el GAS real): `map`, `map_v2`, `0_1_Quimica`, `0_referencias`,
  `1_1_metalografia`, `1_2_analisis_de_componentes`, `1_2_1_quimica`,
  `FORMATO_MATERIALES_ADC`, `A370` — catálogos/versiones viejas, mismo patrón que
  `1.map`/`6.complementos` en el Sheet de MT.
- Gap conocido heredado del script GAS original (no introducido aquí, documentado en
  `report_engine_pmi.py`): la tabla de química de la plantilla tiene 21 slots físicos
  pero el mapeo solo usa 18 — informes con más de 18 elementos analizados pierden los
  extra, igual que en producción hoy.
- Dos campos del mapeo original (`1_M_Abrasivo`→F54, `1_M_Res_Vol_Dilusor`→AB76) apuntan
  a una celda que no es la esquina superior-izquierda de su combinación; se omiten con
  warning en vez de fallar el reporte completo (openpyxl es más estricto que Sheets aquí).

### D15. Bugs corregidos en la Fase 0/preview que aplican a la futura Fase 4
- `sheets_client.update_cell_by_key()` solo soportaba columnas A-Z (`chr(65+i)`) — se
  rompía en hojas anchas como `1_general` (113 columnas, `link_reporte` cae en la
  columna DH). Reemplazado por `_column_letter()` con conversión base-26 completa.
- `insertar_imagen_centrada()` (antes duplicada en cada motor, ahora en
  `image_utils.py` compartido) tenía el mismo límite de una sola letra al calcular el
  ancho de columna — reemplazado por `get_column_letter()` de openpyxl.
- Ambos fixes son relevantes para la Fase 4 real: cualquier tipo de reporte con
  plantillas anchas (>26 columnas) o Sheets con muchas columnas los necesita.

### D16. Modelo OT → Servicio → Técnica (reunión con el jefe, 2026-07-03)
Redefinición del flujo de creación de trabajo, a partir de retroalimentación directa
del jefe (ver `docs/ESTANDAR_COLUMNAS_APPSHEET.md` para el detalle de columnas y el
paso a paso de AppSheet):

- **La OT ya no lleva supervisor ni inspector seleccionables.** El supervisor de una OT
  es siempre quien la crea (usuario autenticado) — se quitó el `<select>` de supervisor
  del modal de creación. El inspector NUNCA se elige en la OT.
- **"Generar servicio"**: desde una OT, el supervisor elige qué técnicas se van a
  ejecutar (hoy: `MT`, `PMI`). Cada técnica elegida crea un registro independiente en
  la nueva hoja `servicios` (BD Sheets, `sheets-db/CrearHojasBD.gs`), con columnas
  `id_servicio, id_ot, tecnica, estado, inspector_usuario, fecha_creacion, fecha_inicio,
  fecha_fin, duracion_min, id_informe_generado, created_at`.
- **`id_servicio` es un valor alfanumérico libre, NO correlacionado con `id_ot`**
  (decisión explícita del usuario: "DEBERIAS SER INDEPOENDIENTE UN VALRO ALFA NUMERICO
  LIBRE") — hoy se genera como `SRV-XXXXXXXX` (uuid4 hex, 8 chars).
- **El inspector se autoasigna después** (vía AppSheet, no lo elige el supervisor) —
  el campo `inspector_usuario` de `servicios` queda vacío al crearse.
- **Certificados ligados a técnica, no genéricos**: `certificados_usuarios` ahora
  requiere un campo `tecnica` (MT/PMI...). Al generar un reporte, el backend
  (`_tiene_certificado_para_tecnica()` en `main.py`) revisa si el inspector tiene
  certificado para esa técnica específica y, si no, agrega una **advertencia no
  bloqueante** (`warnings: string[]` en el job de generación) — el reporte se genera
  igual, pero el supervisor ve el aviso en la webapp.
- **Pestaña "Inspecciones" renombrada a "Reportes"** en toda la navegación (el jefe:
  "La opestala de inspoector e realemnte deberia llamarse repoortes").
- **Explícitamente deprioritizado por el usuario, NO construir todavía**:
  - Equipos físicos de ensayo (solo se construyó certificados de personal, que es
    distinto — ver D12).
  - Tocar las hojas de producción de AppSheet (MT, PMI) para agregar `id_servicio`,
    `fecha_inicio`, `fecha_fin`, `finalizado` — el usuario dijo explícitamente "No,
    solo documentémoslo por ahora". Documentado en `ESTANDAR_COLUMNAS_APPSHEET.md`.
  - Configurar el botón "Finalizado" dentro de AppSheet (se hace manualmente en la UI
    de AppSheet, no por API) — el usuario eligió que se documente el paso a paso en
    vez de que se intente automatizar.

### D17. Equipos, roster de certificados y consecutivo global de reportes (2026-07-07)
A partir de `PERSONAL_EQUIPO_CONSEC.xlsx` (equipos físicos, roster de personal con
certificados, y el histórico de consecutivos de reporte), se agregaron 3 tablas nuevas
a la BD Sheets, siguiendo el mismo patrón de D11 (Sheets temporal, columnas iguales a
como vivirán en Postgres). Ya creadas y con los datos reales importados
(2026-07-07, vía Python + service account, mismo mecanismo que la migración de
`servicios`/`tecnica` del 2026-07-03 — no requirió pasos manuales en Sheets).

**`equipos_ensayo`** — resuelve el pendiente de D12/D16 ("equipos lo dejamos de
pendiente"). Inventario de equipos FÍSICOS (durómetros, gausímetros, cámaras
termográficas, equipos PAUT/MX2/GWT/PCM/CMAT/ACFM/PT...). 64 equipos importados.
- `serial_adc` es la ÚNICA columna que debe seleccionar el inspector en AppSheet (no la
  serie de fábrica) — consistente con lo pedido en la reunión original.
- A diferencia del Excel de origen (una columna de fecha de calibración POR AÑO —
  obliga a agregar una columna nueva cada año), aquí hay solo DOS columnas fijas:
  `fecha_calibracion` (última) y `fecha_vencimiento_calibracion` (próxima). El
  supervisor actualiza estas DOS celdas cuando el equipo se recalibra — no hace falta
  rediseñar la tabla cada año. **Pendiente de construir**: la pantalla/endpoint para
  que el supervisor edite estas fechas desde la webapp (hoy solo existe el dato
  importado; falta la UI de edición y la advertencia de "equipo con calibración
  vencida", mencionada en la reunión original junto con la de certificados).

**`personal_certificados`** — roster MAESTRO de certificados de TODO el personal de
ADEMINCOL (65 personas, 251 certificados, 29 técnicas), no solo de quienes ya tienen
usuario en la webapp. Se identifica por `cc` (cédula), no por `usuario` (login) —
es un concepto distinto y más amplio que `certificados_usuarios` (D-nota original):
- `certificados_usuarios` sigue existiendo tal cual, para certificados de usuarios YA
  REGISTRADOS en la plataforma (vinculados por login) — es lo que usa hoy
  `_tiene_certificado_para_tecnica()` para la advertencia al generar reportes.
- `personal_certificados` es la fuente real de verdad de RRHH — incluye técnicas que
  todavía no tienen reporte automatizado en la webapp (API 653, CWI, TOFD, etc., ver
  `TECNICAS_PERSONAL_VALIDAS` en `CrearHojasBD.gs`, más amplia que `TECNICAS_VALIDAS`).
- **Camino natural a futuro** (no hecho todavía): que la advertencia de "inspector sin
  certificado" busque primero en `personal_certificados` (por nombre/cc, mismo match
  tolerante que `_buscar_firma_usuario`) en vez de únicamente en `certificados_usuarios`
  — así no habría que dar de alta manualmente en la webapp a alguien que ya está en el
  roster de RRHH para que la advertencia funcione.

**`consecutivos_reportes`** — contador GLOBAL de números de reporte. `secuencia` es el
entero autoincremental real; `consecutivo` es el texto ya usado en producción por
ADEMINCOL: `R-ADC-{secuencia}-{TECNICA}-{ABV_CLIENTE}-{INICIALES_RESPONSABLE}`
(ej. `R-ADC-22-MT-CENIT-DH`). 21 consecutivos históricos importados (secuencia 1-21).
- **Objetivo** (pendiente de construir en el backend): que los campos "Reporte N" /
  `reporte_n` (MT) / `n_reporte` (PMI) / `consecutivo` (570, 510) dejen de escribirse a
  mano en AppSheet y en su lugar el backend calcule
  `MAX(secuencia) + 1` sobre esta tabla al generar el reporte, arme el string con el
  mismo patrón, y agregue una fila nueva aquí — un único consecutivo para TODA la
  empresa sin importar la técnica, igual que ya se hace manualmente hoy.

**Alcance de esta fase:** solo se crearon las tablas y se importaron los datos reales.
Faltan 3 piezas de backend/frontend para que esto se sienta terminado (no pedidas
explícitamente en este mensaje, quedan para la siguiente iteración):
1. Endpoint + UI para que el supervisor actualice `fecha_calibracion`/
   `fecha_vencimiento_calibracion` de un equipo desde `/equipos`.
2. Advertencia de "equipo con calibración vencida" al generar un reporte (mismo patrón
   que la de certificado, usando `equipos_ensayo`).

### D18. Medición de Espesores (UT) conectado — quinto tipo de reporte real (2026-07-09)
Igual que 570/510: `report_engine_espesores.py` + endpoints `/api/preview/espesores*` +
`RealEspesoresInspectionsPanel.tsx`, verificado con datos e imágenes reales el 2026-07-09.
Sheet `DB_INSP_Medicion_Espesores` (`1_general` / `2_lecturas_tomadas` / `3_fotografias`),
plantilla `FORMATOS_SCAN_C` exportada e incorporada como `templates_xlsx/ESPESORES.xlsx`.

- A diferencia de 570/510 (15/11 secciones) hay UNA sola tabla dinámica de lecturas
  (capacidad nativa 2 filas, igual que MT) — pero es la única de los 5 motores cuya tabla
  depende de fórmulas vivas por fila (MÁXIMO/MÍNIMO/PROMEDIO/%PÉRDIDA, columnas
  Z/AB/AD/AF/AH), que hay que propagar a cada fila insertada (`_copiar_formulas_lecturas`,
  traducción de `copiarFormulasLecturas()`/`ajustarFormulaPorFila()` del GAS original).
- El script GAS que pegó el usuario (`Reporte_Medicion_Espesores.gs`) tenía la plantilla
  correcta pero **dos mapeos de celda incorrectos y uno vestigial**, encontrados al
  verificar celda por celda contra `ESPESORES.xlsx` (mismo rigor que D14 con PMI):
  `bloque_calibracion` apuntaba a la celda de la ETIQUETA en vez del valor (`AE23` en vez
  de `AI23`), `procedimiento` caía dentro del merge de una etiqueta sin ser su celda
  ancla (`P25` en vez de `R25`), y `link_foto_equipo`→`D21` no tiene efecto porque esa
  columna no existe en la hoja real `1_general` — se descartó.
- Se agregó el bloque "Revisado por" (P40-44) con el mismo patrón de firma automática del
  supervisor ya establecido en D14/PMI (P223-226) — el GAS original solo llenaba
  "Realizado por" (columna del inspector).
- **Estandarización aplicada a los 5 motores en esta misma tarea** (no solo a Espesores):
  el fix de "valores numéricos sin formato" que D15 dejó documentado como propio de PMI
  se extrajo a `report_utils.py` (`valor_tipado()`) y se aplicó también en MT/570/510, que
  tenían el mismo problema sin reportar.
- **Bug nuevo encontrado y corregido** (no heredado de 570/510, pero el mismo patrón
  existe ahí sin corregir — ver tarea flotante creada 2026-07-09): al insertar filas para
  un segundo bloque de fotos, la inserción ocurría exactamente en la posición de la fila
  patrón de descripción, dejándola en blanco (pierde alto 19.5px y estilo) antes de
  usarla como fuente para copiar a los bloques siguientes. Corregido insertando después
  de esa fila, no en ella (mismo principio que ya usa la tabla de lecturas/resultados en
  los 5 motores).
3. Generación automática del consecutivo (`consecutivos_reportes`) en vez de que el
   inspector lo escriba a mano en el Sheet de cada técnica.

---

## 2. Diagrama de componentes

```
┌─────────────┐     ┌──────────────────┐
│  AppSheet    │────►│  Google Sheets    │  (por cada tipo de inspección:
│  (inspector) │     │  (BDs actuales)   │   MT, VT, UT... sin cambios)
└─────────────┘     └────────┬─────────┘
                             │ lectura via Sheets API (service account)
                             ▼
                    ┌──────────────────┐
                    │  Sync Service     │  APScheduler cada 5 min
                    │  (en FastAPI)     │  + endpoint manual POST /sync
                    └────────┬─────────┘
                             │ upsert
                             ▼
┌─────────────┐     ┌──────────────────┐     ┌────────────────┐
│  React SPA   │◄───►│  FastAPI          │◄───►│  PostgreSQL     │
│  (supervisor,│ JWT │  /api/v1/...      │     │                │
│   admin)     │     └────────┬─────────┘     └────────────────┘
└─────────────┘              │
                             ▼
                    ┌──────────────────┐
                    │  Report Engine    │  openpyxl + plantillas .xlsx
                    │  (services/)      │  → guarda archivo + escribe
                    └──────────────────┘    link_reporte de vuelta a Sheets
```

---

## 3. Modelo de datos conceptual

- **users** — cuentas con rol, certificado y firma.
- **work_orders (OTs)** — eje central: contrato, cliente, supervisor, inspector, estado.
- **report_types** — catálogo: MT, VT_SOLDADAS, UT_ESPESORES... con su config de plantilla.
- **inspections** — una inspección = un `id_informe` de un Sheet. Vinculada a OT (nullable
  al inicio: los Sheets actuales no tienen OT; se vinculan después desde la UI).
- **inspection_data** — filas hijas (resultados, indicaciones, fotos) en JSONB, tal como
  vienen del Sheet. Esto evita crear 30 tablas distintas por tipo de inspección.
- **generated_reports** — historial: quién generó, cuándo, checksum, ruta del archivo.
- **sync_runs** — log de cada corrida del sync (inicio, fin, filas procesadas, errores).
- **audit_log** — antes/después de cada cambio en users, OTs.

Detalle completo del esquema en `01_BASE_DE_DATOS.md`.

---

## 4. Por qué JSONB para los datos de inspección

Cada tipo de inspección tiene columnas distintas en su Sheet (MT tiene indicaciones,
UT tiene 16 mediciones, VT tiene fotos de 3 columnas...). Crear tablas relacionales
para cada tipo multiplicaría el esquema ×30 y cada nuevo formato requeriría migración.

Con JSONB:
- El sync copia las filas del Sheet tal cual (`{"item": 1, "evaluacion": "ACEPTADO", ...}`).
- El motor de reportes lee el JSONB y lo mapea a celdas según la config del tipo.
- PostgreSQL indexa JSONB (`GIN`) si hace falta filtrar.

**Excepción:** los campos que la UI necesita filtrar/mostrar en listas
(id_informe, fecha, cliente, estado del reporte) SÍ son columnas reales en `inspections`.

---

## 5. Qué se reutiliza del código existente

| Origen | Destino | Cómo |
|--------|---------|------|
| `APP022_Partic_Magn_MT.js` — mapeos de celdas | `backend/app/services/report_configs/mt.py` | Copiar el dict `MAPEO_CELDAS_GENERAL_MT` casi literal |
| `insertarImagenFlotante_*()` (GAS) | `backend/app/services/report_engine.py` → `insert_centered_image()` | Traducir a openpyxl (ver 04) |
| `webapp-supervisores/server.py` — endpoints y seed | `backend/app/api/` | Rediseñar con SQLAlchemy, NO copiar (tiene contraseñas en texto plano) |
| `webapp-supervisores/Index.html` — vistas y navegación por rol | `frontend/src/pages/` | Referencia de UX; reescribir en React |
| Estilo ADEMINCOL (Inter, rojo `#dc2626`, header border-b-4) | `frontend/tailwind.config.js` | Tokens de diseño |
| CSVs de formatos en las carpetas APP0XX | `backend/app/templates_xlsx/` | Convertir a plantillas .xlsx reales (pedir al usuario los .xlsx originales) |

## 6. Qué NO hacer

- ❌ NO modificar los Google Sheets existentes (estructura, nombres de hojas, columnas).
- ❌ NO tocar los scripts GAS actuales: siguen operativos como respaldo durante la migración.
- ❌ NO guardar contraseñas en texto plano ni usar MD5. Solo `bcrypt` directo (no `passlib`).
- ❌ NO usar `passlib[bcrypt]` — falla con bcrypt>=4.1 (ver 02_BACKEND_FASTAPI.md, Paso 2.4).
- ❌ NO hardcodear IDs de Spreadsheets, credenciales ni rutas: todo por variables de entorno.
- ❌ NO usar SQLite "mientras tanto": PostgreSQL desde el día 1 (Docker lo hace trivial).
- ❌ NO crear tablas por cada tipo de inspección: usar JSONB (sección 4).

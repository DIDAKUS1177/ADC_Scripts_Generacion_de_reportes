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
| Passwords | `passlib[bcrypt]` | — |
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
- ❌ NO guardar contraseñas en texto plano ni usar MD5. Solo bcrypt via passlib.
- ❌ NO hardcodear IDs de Spreadsheets, credenciales ni rutas: todo por variables de entorno.
- ❌ NO usar SQLite "mientras tanto": PostgreSQL desde el día 1 (Docker lo hace trivial).
- ❌ NO crear tablas por cada tipo de inspección: usar JSONB (sección 4).

# ADEMINCOL Central — Plataforma unificada de reportes de inspección

Guía maestra para construir la aplicación que unifica: captura en campo (AppSheet),
sincronización de datos, generación de reportes Excel y gestión de OTs/usuarios.

## Flujo objetivo

```
INSPECTOR                    SISTEMA                              SUPERVISOR
   │                            │                                     │
   ▼                            ▼                                     ▼
AppSheet ──► Google Sheets ──► Sync (FastAPI) ──► PostgreSQL ──► React WebApp
 (campo,      (BD actual,       (cada 5 min o        (fuente        │
  offline)     sin cambios)      webhook)             de verdad)     ▼
                                                              Genera reporte Excel
                                                              (openpyxl + plantilla)
                                                                     │
                                                                     ▼
                                                              Descarga / historial
```

**Decisión clave: NO se toca el flujo del inspector.** AppSheet y los Google Sheets
actuales siguen funcionando exactamente igual. La nueva plataforma LEE de los Sheets
y construye todo lo demás encima. Esto permite migrar sin detener la operación.

## Orden de ejecución de las fases

| Fase | Documento | Qué se construye | Depende de |
|------|-----------|------------------|------------|
| 0 | [docs/00_ARQUITECTURA.md](docs/00_ARQUITECTURA.md) | Leer antes de escribir código | — |
| 1 | [docs/01_BASE_DE_DATOS.md](docs/01_BASE_DE_DATOS.md) | PostgreSQL + esquema + migraciones | — |
| 2 | [docs/02_BACKEND_FASTAPI.md](docs/02_BACKEND_FASTAPI.md) | API REST + auth JWT + roles | Fase 1 |
| 3 | [docs/03_SINCRONIZACION_SHEETS.md](docs/03_SINCRONIZACION_SHEETS.md) | Sync Google Sheets → PostgreSQL | Fase 2 |
| 4 | [docs/04_GENERACION_REPORTES.md](docs/04_GENERACION_REPORTES.md) | Motor de reportes Excel (openpyxl) | Fase 2 |
| 5 | [docs/05_FRONTEND_REACT.md](docs/05_FRONTEND_REACT.md) | SPA React con roles | Fase 2 |
| 6 | [docs/06_DESPLIEGUE.md](docs/06_DESPLIEGUE.md) | Docker Compose + producción | Todas |

**Reglas para el modelo que ejecute esto:** leer [docs/CONVENCIONES.md](docs/CONVENCIONES.md)
ANTES de escribir cualquier línea de código. Contiene la definición de "hecho",
las convenciones de nombres y los errores que NO se deben cometer.

## Estructura final del proyecto

```
ADEMINCOL-Central/
├── README.md                  ← este archivo
├── docs/                      ← guías de cada fase
├── backend/                   ← FastAPI (Fase 2, 3, 4)
│   ├── app/
│   │   ├── main.py
│   │   ├── core/              (config, seguridad, db)
│   │   ├── models/            (SQLAlchemy)
│   │   ├── schemas/           (Pydantic)
│   │   ├── api/               (routers)
│   │   ├── services/          (sync, reportes)
│   │   └── templates_xlsx/    (plantillas Excel)
│   ├── alembic/               (migraciones)
│   ├── tests/
│   └── requirements.txt
├── frontend/                  ← React + TypeScript + Vite (Fase 5)
│   └── src/
│       ├── api/               (cliente HTTP)
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── types/
└── docker-compose.yml         ← Fase 6
```

## Estado de avance

Marcar aquí al completar cada fase (el modelo ejecutor DEBE actualizar esta tabla):

- [x] **Mockup de frontend** (`frontend/`) — SPA completa con datos 100% simulados
      (`src/mock/`), SIN conexión a backend/BD real. Sirve para validar UX y flujos
      con el usuario antes de construir el backend. Ver detalle abajo.
- [ ] Fase 1 — Base de datos
- [ ] Fase 2 — Backend FastAPI
- [ ] Fase 3 — Sincronización Sheets
- [ ] Fase 4 — Generación de reportes
- [ ] Fase 5 — Frontend React (conectar el mockup a la API real — reemplazar `src/mock/client.ts` por `src/api/*.ts`)
- [ ] Fase 6 — Despliegue

### Detalle del mockup de frontend (completado)

- Ruta: `frontend/` (Vite + React 19 + TypeScript strict + Tailwind v4 + React Router).
- Cuentas demo: `admin` / `crojas` / `mortiz` / `jperez` / `ltorres`, contraseña `Demo2026*`.
- Cubre: login, dashboard con indicadores por rol, listado de inspecciones (MT/PMI/VT/UT)
  con filtros y generación de reportes (simulada, con 10% de fallo aleatorio para probar
  el estado de error), detalle de inspección con tabs, OTs, gestión de usuarios (admin),
  panel de sincronización (admin) y perfil con firma.
- **Sin conexión real**: todos los datos viven en `frontend/src/mock/data.ts` y
  `frontend/src/mock/client.ts` simula latencia de red. Cuando el backend de la Fase 2
  exista, ese archivo se reemplaza por llamadas axios reales sin tocar los componentes
  (misma forma de datos, mismos tipos en `src/types/index.ts`).
- Ejecutar: `cd frontend && npm install && npm run dev`.

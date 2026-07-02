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

- [ ] Fase 1 — Base de datos
- [ ] Fase 2 — Backend FastAPI
- [ ] Fase 3 — Sincronización Sheets
- [ ] Fase 4 — Generación de reportes
- [ ] Fase 5 — Frontend React
- [ ] Fase 6 — Despliegue

# Fase 1 — Base de datos PostgreSQL

> ⚠️ **Este documento describe el plan ORIGINAL (Docker + Alembic + SQLAlchemy), que
> no fue lo que terminó pasando.** En la práctica se usó un proyecto de Supabase ya
> existente, sin Docker ni Alembic. Ver **`07_CONTEXTO_MIGRACION_POSTGRES.md`** para
> lo que realmente se construyó (esquema real, bugs encontrados, decisiones). Este
> archivo queda como referencia histórica del plan original, no como estado actual.

**Objetivo:** PostgreSQL corriendo en Docker con el esquema completo y migraciones Alembic.
**Resultado verificable:** `docker compose up db` + `alembic upgrade head` deja todas las
tablas creadas y el seed de datos de desarrollo cargado.

---

## Paso 1.1 — Levantar PostgreSQL con Docker

Crear `docker-compose.yml` en la raíz de `ADEMINCOL-Central/` (versión mínima; la
completa se hace en Fase 6):

```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ademincol
      POSTGRES_PASSWORD: ${DB_PASSWORD:-dev_password_cambiar}
      POSTGRES_DB: ademincol_central
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ademincol"]
      interval: 5s
      retries: 5

volumes:
  pgdata:
```

Verificar: `docker compose up -d db` y luego `docker compose ps` debe mostrar `healthy`.

## Paso 1.2 — Esquema completo

Crear los modelos SQLAlchemy en `backend/app/models/`. Un archivo por dominio:
`user.py`, `work_order.py`, `inspection.py`, `report.py`, `sync.py`, `audit.py`.

### SQL de referencia (la migración Alembic debe producir exactamente esto)

```sql
CREATE TYPE user_role AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'INSPECTOR');
CREATE TYPE ot_status AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'CANCELADA');
CREATE TYPE report_status AS ENUM ('PENDIENTE', 'GENERANDO', 'GENERADO', 'ERROR');
CREATE TYPE sync_status AS ENUM ('RUNNING', 'SUCCESS', 'ERROR');

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    usuario         VARCHAR(50) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,          -- bcrypt, NUNCA texto plano
    correo          VARCHAR(255) UNIQUE,
    rol             user_role NOT NULL,
    cargo           VARCHAR(100),
    certificado     VARCHAR(100),
    firma_base64    TEXT,                            -- imagen PNG/JPEG en base64 (D8)
    firma_mime      VARCHAR(20),                     -- 'image/png' | 'image/jpeg'
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE work_orders (
    id              SERIAL PRIMARY KEY,
    numero          VARCHAR(50) UNIQUE NOT NULL,
    contrato        VARCHAR(100),
    cliente         VARCHAR(200),
    ubicacion       VARCHAR(200),
    supervisor_id   INTEGER REFERENCES users(id),
    inspector_id    INTEGER REFERENCES users(id),
    fecha_inicio    DATE,
    fecha_fin       DATE,
    estado          ot_status NOT NULL DEFAULT 'PENDIENTE',
    descripcion     TEXT,
    observaciones   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Catálogo de tipos de reporte. Se llena por seed, la UI de admin puede editarlo.
CREATE TABLE report_types (
    id              SERIAL PRIMARY KEY,
    codigo          VARCHAR(30) UNIQUE NOT NULL,     -- 'MT', 'VT_SOLDADAS', 'UT_ESPESORES'
    nombre          VARCHAR(200) NOT NULL,
    spreadsheet_id  VARCHAR(100) NOT NULL,           -- ID del Google Sheet fuente
    sheet_general   VARCHAR(100) NOT NULL,           -- nombre de la hoja general
    config_json     JSONB NOT NULL DEFAULT '{}',     -- hojas hijas, columnas clave, etc.
    template_file   VARCHAR(200),                    -- nombre del .xlsx en templates_xlsx/
    activo          BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE inspections (
    id              SERIAL PRIMARY KEY,
    report_type_id  INTEGER NOT NULL REFERENCES report_types(id),
    id_informe      VARCHAR(100) NOT NULL,           -- el id del Sheet (clave de negocio)
    work_order_id   INTEGER REFERENCES work_orders(id),  -- nullable: se vincula luego
    cliente         VARCHAR(200),
    fecha           DATE,
    reporte_n       VARCHAR(50),
    estado_reporte  report_status NOT NULL DEFAULT 'PENDIENTE',
    datos_generales JSONB NOT NULL DEFAULT '{}',     -- fila completa de la hoja general
    sheet_row       INTEGER,                          -- nº de fila en el Sheet (para write-back)
    synced_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (report_type_id, id_informe)
);

-- Filas hijas: resultados, indicaciones, fotos... tal cual vienen del Sheet
CREATE TABLE inspection_data (
    id              SERIAL PRIMARY KEY,
    inspection_id   INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    sheet_name      VARCHAR(100) NOT NULL,           -- '3.resultados_inspeccion', etc.
    row_index       INTEGER NOT NULL,                -- orden original en el Sheet
    data            JSONB NOT NULL,
    UNIQUE (inspection_id, sheet_name, row_index)
);
CREATE INDEX idx_inspection_data_gin ON inspection_data USING GIN (data);

CREATE TABLE generated_reports (
    id              SERIAL PRIMARY KEY,
    inspection_id   INTEGER NOT NULL REFERENCES inspections(id),
    generated_by    INTEGER NOT NULL REFERENCES users(id),
    file_path       VARCHAR(500) NOT NULL,           -- /storage/reportes/...
    file_name       VARCHAR(300) NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_runs (
    id              SERIAL PRIMARY KEY,
    report_type_id  INTEGER REFERENCES report_types(id),  -- NULL = corrida global
    status          sync_status NOT NULL DEFAULT 'RUNNING',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    rows_upserted   INTEGER DEFAULT 0,
    error_detail    TEXT
);

CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    accion          VARCHAR(50) NOT NULL,            -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'
    tabla           VARCHAR(50) NOT NULL,
    registro_id     INTEGER,
    antes           JSONB,
    despues         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## Paso 1.3 — Alembic

1. `pip install alembic` (ya en requirements de Fase 2).
2. `alembic init alembic` dentro de `backend/`.
3. Configurar `alembic/env.py` para leer `DATABASE_URL` de la variable de entorno y
   usar `Base.metadata` de los modelos.
4. `alembic revision --autogenerate -m "esquema inicial"` y revisar que la migración
   generada coincida con el SQL de referencia (los ENUMs a veces requieren ajuste manual
   con `sa.Enum(..., name='user_role')`).
5. `alembic upgrade head`.

## Paso 1.4 — Seed de desarrollo

Crear `backend/app/core/seed.py` con una función `seed_dev()` que inserte (solo si las
tablas están vacías):

- 1 admin: usuario `admin`, contraseña `Admin2026!` (hasheada con bcrypt).
- 2 supervisores y 2 inspectores de prueba.
- Los 3 report_types iniciales:

| codigo | spreadsheet_id | sheet_general | orden |
|--------|----------------|---------------|-------|
| `MT` | `1J3FcVxay3dNQMG9SnOwfTccezzuBlaL-PPSiEq7Icy8` | `2.general_particulas_magneticas` | 1º — piloto |
| `PMI` | (pedir al usuario; referencia en `APP004_Caract_Mat_PMI.js`) | (pedir al usuario) | 2º |
| `VT_SOLDADAS` | `1rYzawJni4_zZwYRud6_WQqmsrMYpLKtQydKcavzydUw` | `2.general_visual_uniones_soldadas` | 3º |
| `UT_ESPESORES` | (pedir al usuario el ID) | (pedir al usuario) | 4º |

El `config_json` de cada tipo se define en la Fase 3 (contiene las hojas hijas y la
columna FK). Dejar `'{}'` por ahora.

## Criterios de aceptación de la Fase 1

- [ ] `docker compose up -d db` levanta Postgres healthy.
- [ ] `alembic upgrade head` corre sin errores en BD limpia.
- [ ] `alembic downgrade base` + `upgrade head` también funciona (migraciones reversibles).
- [ ] `seed_dev()` es idempotente (correrla dos veces no duplica datos).
- [ ] Ninguna contraseña en texto plano en ningún archivo.
- [ ] Marcar la fase en el README raíz.

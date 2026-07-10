-- =============================================================================
-- Esquema PostgreSQL — ADEMINCOL Central
-- =============================================================================
-- Extiende el esquema original de docs/01_BASE_DE_DATOS.md (users, work_orders,
-- report_types, inspections, inspection_data, generated_reports, sync_runs,
-- audit_log) con las 5 tablas que se agregaron DESPUÉS a la BD temporal de
-- Sheets (sheets-db/CrearHojasBD.gs, decisiones D16/D17): servicios,
-- equipos_ensayo, personal_certificados, certificados_usuarios,
-- consecutivos_reportes.
--
-- Principio seguido en TODO este archivo (el mismo que ya se usó al diseñar
-- las hojas de Sheets): columnas idénticas en nombre y significado a su
-- versión en Sheets, para que la migración sea copiar filas, no traducirlas.
-- Las relaciones usan como FK la CLAVE DE NEGOCIO (id_ot, usuario, cc...), no
-- el id SERIAL interno — son las columnas que Sheets/AppSheet ya conocen y
-- escriben hoy.
--
-- "Primera prueba" (2026-07-09): esto NO incluye todavía los datos de
-- inspección de las técnicas que aún no se han migrado (MT/570/510/
-- Espesores) — esos siguen viviendo en Sheets/AppSheet por ahora. PMI SÍ se
-- incluye (ver pmi_schema.sql, se corre justo después de este archivo) como
-- primer caso real de un tipo de reporte, porque era la "prueba piloto".
--
-- Destino: instancia de Supabase ya conectada por el usuario vía pgAdmin
-- (servidor "ADC_REPORT", base "postgres", esquema "public" — no usa
-- auth.users de Supabase, este proyecto ya tiene su propio modelo de
-- usuarios con bcrypt, ver docs/01_BASE_DE_DATOS.md D8/D11). Se corre a mano
-- desde el Query Tool de pgAdmin, NO por Docker/Alembic — ver el mensaje de
-- la conversación para el paso a paso.
-- =============================================================================

-- ---- Tipos ENUM ----
-- report_type_code: solo las técnicas con motor de reporte YA construido en
-- la webapp (TECNICAS_VALIDAS en CrearHojasBD.gs). NO usar para
-- personal_certificados/consecutivos_reportes, que usan una lista mucho más
-- amplia (TECNICAS_PERSONAL_VALIDAS, 29 técnicas) y sigue creciendo — un
-- ENUM ahí obligaría a una migración cada vez que RRHH certifique una
-- técnica nueva; se dejan como TEXT en esas tablas.
CREATE TYPE report_type_code AS ENUM ('MT', 'PMI', '570', '510', 'ESPESORES');

CREATE TYPE user_role AS ENUM ('ADMINISTRADOR', 'SUPERVISOR', 'INSPECTOR');
CREATE TYPE ot_status AS ENUM ('PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'CANCELADA');
CREATE TYPE report_status AS ENUM ('PENDIENTE', 'GENERANDO', 'GENERADO', 'ERROR');
CREATE TYPE sync_status AS ENUM ('RUNNING', 'SUCCESS', 'ERROR');
CREATE TYPE cert_estado AS ENUM ('VIGENTE', 'VENCIDA');

-- =============================================================================
-- Tablas originales (docs/01_BASE_DE_DATOS.md, Fase 1) — sin cambios de
-- estructura, solo repetidas aquí para que este archivo se pueda aplicar solo.
-- =============================================================================

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    nombre          TEXT NOT NULL,
    usuario         VARCHAR(50) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,          -- bcrypt, NUNCA texto plano
    correo          VARCHAR(255),                     -- NO único: 2 cuentas reales
                                                        -- ("admin" y "diego123") comparten
                                                        -- el mismo correo (misma persona,
                                                        -- 2 logins) — verificado 2026-07-09
    rol             user_role NOT NULL,
    cargo           VARCHAR(100),
    certificado     VARCHAR(100),                   -- obsoleto, usar certificados_usuarios
    firma_base64    TEXT,                            -- "data:image/png;base64,..." (D8)
    firma_mime      VARCHAR(20),                     -- 'image/png' | 'image/jpeg'
    activo          BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_correo ON users(correo);

CREATE TABLE work_orders (
    id              SERIAL PRIMARY KEY,
    id_ot           VARCHAR(50) UNIQUE NOT NULL,      -- clave real de Sheets ("OT-0001") — es
                                                        -- lo que servicios.id_ot referencia, NO
                                                        -- 'numero'. Bug encontrado 2026-07-09: la
                                                        -- primera versión de este archivo NO tenía
                                                        -- esta columna y el FK de servicios apuntaba
                                                        -- (mal) a 'numero'.
    numero          VARCHAR(50) UNIQUE NOT NULL,      -- número visible al usuario, ej. "OT-2026-0142"
    contrato        VARCHAR(100),
    cliente         VARCHAR(200),
    ubicacion       VARCHAR(200),
    supervisor_usuario VARCHAR(50) REFERENCES users(usuario), -- SIEMPRE quien crea la OT (D16)
    fecha_inicio    DATE,
    fecha_fin       DATE,
    estado          ot_status NOT NULL DEFAULT 'PENDIENTE',
    descripcion     TEXT,
    observaciones   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE report_types (
    id              SERIAL PRIMARY KEY,
    codigo          report_type_code UNIQUE NOT NULL,
    nombre          VARCHAR(200) NOT NULL,
    spreadsheet_id  VARCHAR(100) NOT NULL,
    sheet_general   VARCHAR(100) NOT NULL,
    config_json     JSONB NOT NULL DEFAULT '{}',
    template_file   VARCHAR(200),
    activo          BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE inspections (
    id              SERIAL PRIMARY KEY,
    report_type_id  INTEGER NOT NULL REFERENCES report_types(id),
    id_informe      VARCHAR(100) NOT NULL,
    work_order_id   INTEGER REFERENCES work_orders(id),
    cliente         VARCHAR(200),
    fecha           DATE,
    reporte_n       VARCHAR(50),
    estado_reporte  report_status NOT NULL DEFAULT 'PENDIENTE',
    datos_generales JSONB NOT NULL DEFAULT '{}',
    sheet_row       INTEGER,
    synced_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (report_type_id, id_informe)
);

CREATE TABLE inspection_data (
    id              SERIAL PRIMARY KEY,
    inspection_id   INTEGER NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
    sheet_name      VARCHAR(100) NOT NULL,
    row_index       INTEGER NOT NULL,
    data            JSONB NOT NULL,
    UNIQUE (inspection_id, sheet_name, row_index)
);
CREATE INDEX idx_inspection_data_gin ON inspection_data USING GIN (data);

CREATE TABLE generated_reports (
    id              SERIAL PRIMARY KEY,
    inspection_id   INTEGER NOT NULL REFERENCES inspections(id),
    generated_by    INTEGER NOT NULL REFERENCES users(id),
    file_path       VARCHAR(500) NOT NULL,
    file_name       VARCHAR(300) NOT NULL,
    checksum_sha256 VARCHAR(64) NOT NULL,
    duration_ms     INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_runs (
    id              SERIAL PRIMARY KEY,
    report_type_id  INTEGER REFERENCES report_types(id),  -- NULL = corrida global (sync_service.py)
    status          sync_status NOT NULL DEFAULT 'RUNNING',
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at     TIMESTAMPTZ,
    rows_upserted   INTEGER DEFAULT 0,
    error_detail    TEXT,
    detalle         JSONB DEFAULT '{}'  -- NUEVA (2026-07-09): desglose por
                                         -- tabla {"usuarios": 5, "servicios": 2, ...},
                                         -- usada por el botón real de
                                         -- "Sincronizar" (reemplaza el mock)
);

CREATE TABLE audit_log (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(id),
    accion          VARCHAR(50) NOT NULL,
    tabla           VARCHAR(50) NOT NULL,
    registro_id     INTEGER,
    antes           JSONB,
    despues         JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Tablas nuevas (D16/D17) — "primera prueba" de migración, 2026-07-09.
-- =============================================================================

-- Modelo OT -> Servicio -> Técnica (D16). Cada técnica que el supervisor
-- elige al "generar servicio" desde una OT crea UNA fila aquí.
-- id_ot es NULLABLE desde 2026-07-10 (pedido explícito: "no es obligatoria
-- la ot") — un servicio se puede crear suelto y vincularse a una OT más
-- adelante; antes el frontend rodeaba el requisito creando una OT
-- placeholder ("S/N-...") solo para poder crear el servicio.
CREATE TABLE servicios (
    id                  SERIAL PRIMARY KEY,
    id_servicio         VARCHAR(20) UNIQUE NOT NULL,   -- 'SRV-XXXXXXXX', alfanumérico libre (D16)
    id_ot               VARCHAR(50) REFERENCES work_orders(id_ot),
    tecnica             report_type_code NOT NULL,
    estado              ot_status NOT NULL DEFAULT 'PENDIENTE',
    inspector_usuario   VARCHAR(50) REFERENCES users(usuario),  -- NULL hasta autoasignación en AppSheet
    supervisor_usuario  VARCHAR(50) REFERENCES users(usuario),  -- quién solicitó el servicio (2026-07-10,
                                                           -- columna agregada a la hoja real; antes no
                                                           -- existía y un servicio sin OT quedaba sin
                                                           -- forma de saber quién lo pidió)
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT now(),
    fecha_inicio        TIMESTAMPTZ,                     -- la llena AppSheet al abrir el formulario
    fecha_fin           TIMESTAMPTZ,                     -- la llena AppSheet al marcar "Finalizado"
    duracion_min        INTEGER,                         -- calculado: fecha_fin - fecha_inicio
    id_informe_generado VARCHAR(100),                    -- FK "blanda" a inspections.id_informe
                                                           -- (no FK real: el informe puede no
                                                           -- existir todavía cuando se crea el servicio)
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_servicios_id_ot ON servicios(id_ot);
CREATE INDEX idx_servicios_inspector ON servicios(inspector_usuario);

-- Inventario de equipos físicos de ensayo (D17). El inspector en AppSheet
-- solo selecciona `serial_adc`, nunca la serie de fábrica.
CREATE TABLE equipos_ensayo (
    id                              SERIAL PRIMARY KEY,
    id_equipo                       VARCHAR(20) UNIQUE NOT NULL,   -- 'EQ-0001'
    categoria                       VARCHAR(50) NOT NULL,          -- ver CATEGORIAS_EQUIPO_VALIDAS
    equipo                          VARCHAR(200) NOT NULL,         -- nombre/modelo comercial
    serie                           VARCHAR(100),                  -- número de serie de fábrica
    serial_adc                      VARCHAR(20),                    -- identificador interno ADC —
                                                                     -- NO único: hay 6 códigos repetidos
                                                                     -- en los datos reales (ADC131,
                                                                     -- ADC235, ADC134, EXT29, EXT23,
                                                                     -- ADC776 — verificado 2026-07-09,
                                                                     -- antes de migrar). Corregido en
                                                                     -- vivo en Supabase con ALTER TABLE
                                                                     -- DROP CONSTRAINT — este archivo ya
                                                                     -- sale bien para que una recreación
                                                                     -- desde cero no repita el error.
    fecha_calibracion               DATE,
    fecha_vencimiento_calibracion   DATE,
    activo                           BOOLEAN NOT NULL DEFAULT true,
    observaciones                   TEXT,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_equipos_categoria ON equipos_ensayo(categoria);
CREATE INDEX idx_equipos_serial_adc ON equipos_ensayo(serial_adc);

-- Roster MAESTRO de certificados de TODO el personal de ADEMINCOL (D17),
-- identificado por cédula (cc) — NO requiere que la persona tenga usuario en
-- la webapp. Grano: una fila por (persona, técnica certificada) — `cc` SE
-- REPITE entre filas de la misma persona.
CREATE TABLE personal_certificados (
    id                  SERIAL PRIMARY KEY,
    id_certificado      VARCHAR(20) UNIQUE NOT NULL,
    nombre              TEXT NOT NULL,
    cc                  VARCHAR(20),                    -- cédula, se repite entre filas de la persona.
                                                          -- Nullable: 3 de 251 personas reales no la
                                                          -- tienen registrada (verificado 2026-07-09,
                                                          -- antes de migrar) — Juan David Vega, Richard
                                                          -- Campos Contreras, Sergio Alberto Suarez Castro
    numero_certificado  VARCHAR(50),
    tecnica             VARCHAR(50) NOT NULL,          -- TECNICAS_PERSONAL_VALIDAS, lista amplia (no ENUM)
    nivel               VARCHAR(10),                    -- I | II | III
    fecha_emision       DATE,
    fecha_vencimiento   DATE,
    estado              cert_estado,                    -- se recalcula en el backend desde fecha_vencimiento
    firma_link          TEXT,                            -- histórico/auditoría (de dónde salió firma_base64)
    firma_base64        TEXT,                            -- "data:image/png;base64,..." — dato operativo real
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_personal_cert_cc ON personal_certificados(cc);
CREATE INDEX idx_personal_cert_tecnica ON personal_certificados(tecnica);
CREATE INDEX idx_personal_cert_nombre ON personal_certificados(nombre);

-- Certificados de usuarios YA REGISTRADOS en la webapp (login), usados hoy
-- por _tiene_certificado_para_tecnica() para la advertencia al generar un
-- reporte. Concepto distinto de personal_certificados (D17): este es solo
-- del subconjunto de personal con cuenta en la plataforma.
CREATE TABLE certificados_usuarios (
    id                  SERIAL PRIMARY KEY,
    id_certificado      VARCHAR(20) UNIQUE NOT NULL,
    usuario             VARCHAR(50) NOT NULL REFERENCES users(usuario),
    tecnica             report_type_code NOT NULL,
    nombre_certificado  VARCHAR(200),
    entidad_emisora     VARCHAR(100),
    fecha_emision       DATE,
    fecha_vencimiento   DATE,
    link_pdf            TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cert_usuarios_usuario ON certificados_usuarios(usuario);

-- Consecutivo GLOBAL de números de reporte (D17), para que "Reporte N" no se
-- siga escribiendo a mano en cada técnica.
CREATE TABLE consecutivos_reportes (
    secuencia               SERIAL PRIMARY KEY,             -- el contador real, autoincremental
    consecutivo              VARCHAR(100) UNIQUE NOT NULL,    -- 'R-ADC-{secuencia}-{TECNICA}-{CLIENTE}-{INICIALES}'
    tecnica                   VARCHAR(50) NOT NULL,
    cliente                   VARCHAR(200),
    abv_cliente               VARCHAR(20),
    alcance                   TEXT,
    abv_alcance               VARCHAR(50),
    fecha_ejecucion           DATE,
    fecha_entrega_reporte     DATE,
    dias                      INTEGER,                        -- informativo: entrega - ejecución
    responsable               VARCHAR(200),
    iniciales_responsable     VARCHAR(10),
    comentarios               TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_consecutivos_tecnica ON consecutivos_reportes(tecnica);

-- =============================================================================
-- PMI (Caracterización de Materiales) — 2026-07-09
-- =============================================================================
-- Se corre DESPUÉS de schema.sql. A diferencia de la primera versión de este
-- archivo, `pmi_general` es un espejo COMPLETO de la hoja real '1_general'
-- (119 columnas, ver PMI_SPREADSHEET_ID en sheets_client.py) en vez de dejar
-- los datos generales como JSONB dentro de `inspections` — decisión del
-- usuario 2026-07-09: "Debe ser una tabla, porque vamos a conectar AppSheet
-- a él". AppSheet necesita ver columnas reales para poder bindear cada
-- campo del formulario; un JSONB no sirve como fuente de datos de AppSheet.
--
-- `pmi_general` es AUTÓNOMA: su clave primaria es `id_general` (el mismo
-- texto que ya usa hoy id_general en Sheets/AppSheet — 'CARACT_MATE...'),
-- NO un id SERIAL de `inspections`. No depende de `inspections`/
-- `report_types` para existir. `pmi_quimica`/`pmi_durezas` cuelgan
-- directamente de `pmi_general(id_general)`.
--
-- ⚠️ Muchos nombres de columna empiezan con un dígito ("1_m_procedimiento",
-- "2_q_tecnica", "3_d_marca_durometro" — igual que en el Sheet real, ver
-- CELDAS_GENERALES en report_engine_pmi.py). Postgres NO permite
-- identificadores que empiecen con número sin comillas dobles — hay que
-- escribirlos SIEMPRE entre comillas dobles ("1_m_procedimiento", no
-- 1_m_procedimiento a secas) tanto en este CREATE TABLE como en cualquier
-- SELECT/INSERT futuro. Se mantienen los nombres tal cual (no se les agregó
-- un prefijo de letra) a propósito: es justo lo que permite que AppSheet
-- reconozca los mismos campos que ya conoce del Sheet, sin tener que volver
-- a bindear cada control del formulario.
--
-- Tipos: por defecto TEXT. Se tipó más estricto SOLO donde los datos reales
-- (114 filas verificadas) lo sostienen sin riesgo:
--   - finalizado: 'FALSE'/'TRUE' consistente en las 114 filas -> BOOLEAN.
--   - ce (Carbono Equivalente): decimales limpios ('1.21', '0.09') -> NUMERIC.
--   - fecha: DD/MM/YYYY consistente -> DATE.
--   - fecha_inicio/fecha_fin: vacías en las 114 filas hoy, pero es el mismo
--     patrón de timestamp que ya define ESTANDAR_COLUMNAS_APPSHEET.md -> TIMESTAMPTZ.
-- Todo lo demás se dejó en TEXT aunque "pareciera" numérico
-- (n_reporte/nps/espesor_min_pulg/espesor_min_mm), porque los datos reales
-- traen texto no numérico mezclado — ej. n_reporte tiene valores como
-- 'DIEGO' o 'R4363-ADP2-CMAT-YUM-REC-TAPA', no solo números. Forzar
-- NUMERIC ahí rompería la migración en cuanto llegue la primera fila así.
--
-- ⚠️ Encontrado al revisar los datos reales, no resuelto aquí — avisar antes
-- de migrar: `id_informe`, `id_servicio`, `nombre_supervisor`, `fecha_inicio`,
-- `fecha_fin` YA EXISTEN como columnas en el Sheet real pero están vacías en
-- las 114 filas actuales (0 de 114). Y `id_informe` parece redundante con
-- `id_general` (que sí tiene datos en las 114 filas) — probablemente se
-- agregó siguiendo ESTANDAR_COLUMNAS_APPSHEET.md ("id_informe (o
-- id_general...)") sin notar que PMI ya tenía id_general cumpliendo ese rol.
-- Se replican tal cual abajo (mismo criterio de espejo 1:1), pero antes de
-- usarlas para algo real conviene decidir si id_informe se elimina o si de
-- verdad va a tener un uso distinto a id_general.
-- =============================================================================

CREATE TABLE pmi_general (
    -- ---- Identificación y datos generales ----
    id_general                      TEXT PRIMARY KEY,
    fecha_llenado                   TEXT,    -- timestamp del Sheet corrupto (ej. "30/12/1899 16:46:28",
                                              -- epoch de Sheets mal formateado) — no se tipa a fecha
    cliente                         TEXT,
    contrato                        TEXT,
    n_reporte                       TEXT,
    ot                              TEXT,
    fecha                           DATE,
    departamento                    TEXT,
    ciudad                          TEXT,
    troncal                         TEXT,
    "estación"                      TEXT,
    sistema                         TEXT,
    linea                           TEXT,
    pk                              TEXT,
    equipo_inspeccionado            TEXT,
    tag                             TEXT,
    descripcion_componente          TEXT,
    material_referencia             TEXT,
    material_referencia_2           TEXT,
    estado_componente               TEXT,
    observacion_estado              TEXT,
    ubicacion_componente            TEXT,
    dimensiones                     TEXT,
    nps                             TEXT,
    espesor_min_pulg                TEXT,
    espesor_min_mm                  TEXT,
    plano_referencia                TEXT,
    observaciones_generales         TEXT,
    image                           TEXT,   -- link de imagen (foto general)
    comentario_1                    TEXT,
    link_foto                       TEXT,
    foto                            TEXT,

    -- ---- 1. Metalografía ----
    "1_m_procedimiento"             TEXT,
    "1_m_tecnica"                   TEXT,
    "1_m_normas_referencia"         TEXT,
    "1_m_equipo_desbaste"           TEXT,
    "1_m_marca_desbaste"            TEXT,
    "1_m_modelo_desbaste"           TEXT,
    "1_m_serie_desbaste"            TEXT,
    "1_m_abrasivo"                  TEXT,
    "1_m_micro_marca"               TEXT,
    "1_m_micro_modelo"              TEXT,
    "1_m_micro_serie"               TEXT,
    "1_m_micro_lentes"              TEXT,
    "1_m_material_analizar"         TEXT,
    "1_m_tiempo_ataque_seg"         TEXT,
    "1_m_reactivo_norma"            TEXT,
    "1_m_calc_vol_solucion"         TEXT,
    "1_m_calc_conc_acido_base"      TEXT,
    "1_m_calc_conc_deseada"         TEXT,
    "1_m_res_vol_acido"             TEXT,
    "1_m_res_vol_dilusor"           TEXT,
    "1_m_aumentos_metalografias"    TEXT,
    "1_m_image_2"                   TEXT,
    "1_m_comentario_2"              TEXT,
    "1_m_image_3"                   TEXT,
    "1_m_comentario_3"              TEXT,
    "1_m_image_4"                   TEXT,
    "1_m_comentario_4"              TEXT,
    "1_m_analisis_inclusiones"      TEXT,
    "1_m_image_5"                   TEXT,
    "1_m_comentario_5"              TEXT,
    "1_m_analisis_de_inclusiones"   TEXT,
    "1_m_image_6"                   TEXT,
    "1_m_comentario_6"              TEXT,
    "1_m_tamano_grano"              TEXT,
    "1_m_fases"                     TEXT,
    "1_m_porceso_fabricacion"       TEXT,
    "1_m_defectos"                  TEXT,
    "1_m_analisis_metalografico"    TEXT,

    -- ---- 2. Química (los valores repetidos por elemento van en pmi_quimica) ----
    "2_q_procedimiento"             TEXT,
    "2_q_tecnica"                   TEXT,
    "2_q_normas_referencia"         TEXT,
    "2_q_equipo_desbaste"           TEXT,
    "2_q_marca_desbaste"            TEXT,
    "2_q_modelo_desbaste"           TEXT,
    "2_q_serie_desbaste"            TEXT,
    "2_q_fecha_calibracion"         TEXT,
    "2_q_image_7"                   TEXT,
    "2_q_comentario_7"              TEXT,
    "2_q_image_8"                   TEXT,
    "2_q_comentario_8"              TEXT,

    -- ---- 3. Dureza (los valores repetidos van en pmi_durezas) ----
    "3_d_procedimiento"             TEXT,
    "3_d_tecnica"                   TEXT,
    "3_d_normas_referencia"         TEXT,
    "3_d_marca_durometro"           TEXT,
    "3_d_modelo_durometro"          TEXT,
    "3_d_serie_durometro"           TEXT,
    "3_d_fecha_calibracion"         TEXT,
    "3_d_ubicacion_horaria"         TEXT,
    "3_d_escala_dureza"             TEXT,
    "3_d_tolerancia"                TEXT,
    "3_d_material_referencia"       TEXT,
    "3_d_image_9"                   TEXT,
    "3_d_comentario_9"              TEXT,
    "3_d_image_10"                  TEXT,
    "3_d_comentario_10"             TEXT,
    "3_d_analisis_mecanicas"        TEXT,

    -- ---- Imágenes sueltas adicionales ----
    link_imagen_2                   TEXT,
    link_imagen_3                   TEXT,
    link_imagen_4                   TEXT,
    link_imagen_5                   TEXT,
    link_imagen_6                   TEXT,
    link_imagen_7                   TEXT,
    link_imagen_8                   TEXT,
    link_imagen_9                   TEXT,
    link_imagen_10                  TEXT,

    -- ---- Firma / responsable / resultado ----
    firma                            TEXT,
    nombre                           TEXT,   -- inspector responsable
    cargo                            TEXT,
    link_firma                       TEXT,
    link_reporte                     TEXT,
    ce                               NUMERIC(6, 4),  -- Carbono Equivalente

    -- ---- Columnas operativas (ESTANDAR_COLUMNAS_APPSHEET.md) — YA EXISTEN
    -- en el Sheet real pero vacías en las 114 filas actuales, ver nota arriba ----
    id_informe                       TEXT,   -- ⚠️ probable duplicado de id_general, ver nota arriba
    nombre_supervisor                TEXT,
    id_servicio                      TEXT REFERENCES servicios(id_servicio),
    fecha_inicio                     TIMESTAMPTZ,
    fecha_fin                        TIMESTAMPTZ,
    finalizado                       BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX idx_pmi_general_cliente ON pmi_general(cliente);
CREATE INDEX idx_pmi_general_fecha ON pmi_general(fecha);
CREATE INDEX idx_pmi_general_nombre ON pmi_general(nombre);
CREATE INDEX idx_pmi_general_id_servicio ON pmi_general(id_servicio);

-- =============================================================================
-- Química y durezas — cuelgan de pmi_general (id_general TEXT), no de una
-- tabla genérica de inspecciones.
-- =============================================================================

-- Cada fila = una medición de un elemento químico, para un informe.
CREATE TABLE pmi_quimica (
    id              SERIAL PRIMARY KEY,
    id_general      TEXT NOT NULL REFERENCES pmi_general(id_general) ON DELETE CASCADE,
    elemento        VARCHAR(30) NOT NULL,      -- 'C (Carbono)', 'Mn (Manganeso)'...
    -- Guardado como FRACCIÓN (0.0112 = 1.12%), no como el número de
    -- porcentaje (1.12) — mismo criterio que se acaba de corregir en
    -- report_engine_pmi.py (2026-07-09): el Sheet trae "1.12%" como texto,
    -- eso son 1.12 puntos porcentuales = 0.0112 como fracción.
    valor_fraccion  NUMERIC(7, 5) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pmi_quimica_id_general ON pmi_quimica(id_general);
CREATE INDEX idx_pmi_quimica_elemento ON pmi_quimica(elemento);

-- Cada fila = una medición de dureza, para un informe.
CREATE TABLE pmi_durezas (
    id              SERIAL PRIMARY KEY,
    id_general      TEXT NOT NULL REFERENCES pmi_general(id_general) ON DELETE CASCADE,
    orden           INTEGER NOT NULL,           -- posición en la tabla del reporte
    dureza          NUMERIC(8, 2),
    ksi             NUMERIC(8, 2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pmi_durezas_id_general ON pmi_durezas(id_general);

-- Ejemplo: carbono equivalente promedio por cliente.
-- SELECT g.cliente, AVG(q.valor_fraccion) AS carbono_promedio
-- FROM pmi_quimica q
-- JOIN pmi_general g ON g.id_general = q.id_general
-- WHERE q.elemento ILIKE 'C (%'
-- GROUP BY g.cliente
-- ORDER BY carbono_promedio DESC;

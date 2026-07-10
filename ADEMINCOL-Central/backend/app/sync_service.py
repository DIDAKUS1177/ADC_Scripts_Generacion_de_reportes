"""
Sincronización REAL Sheets -> Postgres, 2026-07-09. Reemplaza el botón
"Sincronizar" que hasta ahora llamaba a un mock (`frontend/src/mock/client.ts`
`runSync()`, que solo esperaba 1.5s y devolvía un número aleatorio — nunca
tocó ni Sheets ni Postgres). Cubre las 7 tablas de soporte:
usuarios, work_orders, servicios, equipos_ensayo, personal_certificados,
certificados_usuarios, consecutivos_reportes.

2026-07-10: se agregan las 3 tablas de PMI (pmi_general, pmi_quimica,
pmi_durezas) — el esquema ya existía desde el 2026-07-09 (ver
db/pmi_schema.sql) pero le faltaba el script de sync. Los datos de
inspección de las demás técnicas (MT/570/510/Espesores/SCAN C/Piernas
Muertas/ACFM) siguen siendo solo Sheets/AppSheet, sin espejo en Postgres —
PMI es la única migrada porque el usuario pidió explícitamente que
AppSheet pudiera leer directo de `pmi_general` más adelante (necesita
columnas reales, no JSONB).

Reutiliza el mismo patrón ya probado en db/migrar_equipos_personal.py
(UPSERT por clave natural, idempotente).
"""
import logging
from datetime import date, datetime

from psycopg2.extras import execute_values

from .db import get_connection
from .sheets_client import read_sheet_as_dicts, BD_SPREADSHEET_ID, PMI_SPREADSHEET_ID

logger = logging.getLogger("sync_service")


def _parse_fecha(valor: str) -> date | None:
    valor = (valor or "").strip()
    if not valor:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(valor, fmt).date()
        except ValueError:
            continue
    return None


def _parse_timestamp(valor: str) -> datetime | None:
    valor = (valor or "").strip()
    if not valor:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(valor, fmt)
        except ValueError:
            continue
    return None


def _parse_bool(valor: str) -> bool:
    return (valor or "").strip().upper() in ("TRUE", "VERDADERO", "SI", "SÍ", "1")


def _parse_fecha_dmy(valor: str) -> date | None:
    """DD/MM/YYYY — confirmado 2026-07-10 contra datos reales de
    `1_general.fecha` de PMI (ej. '18/03/2026', día=18 descarta MM/DD).
    No se unifica con `_parse_fecha` (usada por las otras 7 tablas, que
    prueba MM/DD/YYYY) para no arriesgar reinterpretar mal fechas de
    sincronizaciones ya probadas en producción."""
    valor = (valor or "").strip()
    if not valor:
        return None
    try:
        return datetime.strptime(valor, "%d/%m/%Y").date()
    except ValueError:
        return None


def _parse_float(valor: str) -> float | None:
    valor = (valor or "").strip().replace("%", "").replace(",", ".")
    if not valor:
        return None
    try:
        return float(valor)
    except ValueError:
        return None


def _parse_int(valor: str) -> int | None:
    valor = (valor or "").strip()
    if not valor:
        return None
    try:
        return int(float(valor))
    except ValueError:
        return None


def sync_usuarios() -> int:
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "usuarios")
    # La hoja tiene ~1000 filas heredadas del import inicial pero solo unas
    # pocas con datos reales (usuario no vacío) — el resto son filas en
    # blanco que no representan cuentas reales.
    filas = [r for r in filas if r.get("usuario", "").strip()]
    roles_validos = {"ADMINISTRADOR", "SUPERVISOR", "INSPECTOR"}

    sql = """
        INSERT INTO users (nombre, usuario, password_hash, correo, rol, cargo,
                            certificado, firma_base64, activo)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (usuario) DO UPDATE SET
            nombre = EXCLUDED.nombre, correo = EXCLUDED.correo, rol = EXCLUDED.rol,
            cargo = EXCLUDED.cargo, certificado = EXCLUDED.certificado,
            firma_base64 = EXCLUDED.firma_base64, activo = EXCLUDED.activo,
            updated_at = now()
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            for r in filas:
                rol = r.get("rol", "").strip().upper()
                if rol not in roles_validos:
                    logger.warning("usuario %s con rol inválido %r, se omite", r.get("usuario"), rol)
                    continue
                cur.execute(sql, (
                    r.get("nombre", "").strip() or None,
                    r["usuario"].strip(),
                    r.get("password_hash", "").strip() or "SIN_HASH",
                    r.get("correo", "").strip() or None,
                    rol,
                    r.get("cargo", "").strip() or None,
                    r.get("certificado", "").strip() or None,
                    r.get("firma", "").strip() or None,
                    _parse_bool(r.get("activo", "")),
                ))
        conn.commit()
    return len(filas)


def sync_work_orders() -> int:
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "work_orders")
    # id_ot es la clave real de Sheets (la que usa servicios.id_ot para
    # referenciar la OT) — numero es solo el número visible al usuario, NO
    # es lo mismo. Bug encontrado 2026-07-09: el FK de servicios apuntaba
    # a work_orders.numero, que nunca iba a calzar con id_ot.
    filas = [r for r in filas if r.get("id_ot", "").strip()]
    estados_validos = {"PENDIENTE", "EN_CURSO", "COMPLETADA", "CANCELADA"}

    sql = """
        INSERT INTO work_orders (id_ot, numero, contrato, cliente, ubicacion,
                                  supervisor_usuario, fecha_inicio, fecha_fin,
                                  estado, descripcion, observaciones)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id_ot) DO UPDATE SET
            numero = EXCLUDED.numero,
            contrato = EXCLUDED.contrato, cliente = EXCLUDED.cliente,
            ubicacion = EXCLUDED.ubicacion, supervisor_usuario = EXCLUDED.supervisor_usuario,
            fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin,
            estado = EXCLUDED.estado, descripcion = EXCLUDED.descripcion,
            observaciones = EXCLUDED.observaciones, updated_at = now()
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            for r in filas:
                estado = r.get("estado", "").strip().upper() or "PENDIENTE"
                if estado not in estados_validos:
                    estado = "PENDIENTE"
                cur.execute(sql, (
                    r["id_ot"].strip(),
                    r.get("numero", "").strip() or None,
                    r.get("contrato", "").strip() or None,
                    r.get("cliente", "").strip() or None,
                    r.get("ubicacion", "").strip() or None,
                    r.get("supervisor_usuario", "").strip() or None,
                    _parse_fecha(r.get("fecha_inicio", "")),
                    _parse_fecha(r.get("fecha_fin", "")),
                    estado,
                    r.get("descripcion", "").strip() or None,
                    r.get("observaciones", "").strip() or None,
                ))
        conn.commit()
    return len(filas)


def sync_servicios() -> int:
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "servicios")
    filas = [r for r in filas if r.get("id_servicio", "").strip()]
    tecnicas_validas = {"MT", "PMI", "570", "510", "ESPESORES"}
    estados_validos = {"PENDIENTE", "EN_CURSO", "COMPLETADA", "CANCELADA"}

    sql = """
        INSERT INTO servicios (id_servicio, id_ot, tecnica, estado, inspector_usuario,
                                fecha_creacion, fecha_inicio, fecha_fin, duracion_min,
                                id_informe_generado)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id_servicio) DO UPDATE SET
            estado = EXCLUDED.estado, inspector_usuario = EXCLUDED.inspector_usuario,
            fecha_inicio = EXCLUDED.fecha_inicio, fecha_fin = EXCLUDED.fecha_fin,
            duracion_min = EXCLUDED.duracion_min, id_informe_generado = EXCLUDED.id_informe_generado
    """
    saltadas = 0
    with get_connection() as conn:
        with conn.cursor() as cur:
            for r in filas:
                tecnica = r.get("tecnica", "").strip().upper()
                if tecnica not in tecnicas_validas:
                    saltadas += 1
                    continue
                estado = r.get("estado", "").strip().upper() or "PENDIENTE"
                if estado not in estados_validos:
                    estado = "PENDIENTE"
                cur.execute(sql, (
                    r["id_servicio"].strip(),
                    r.get("id_ot", "").strip(),
                    tecnica,
                    estado,
                    r.get("inspector_usuario", "").strip() or None,
                    _parse_timestamp(r.get("fecha_creacion", "")),
                    _parse_timestamp(r.get("fecha_inicio", "")),
                    _parse_timestamp(r.get("fecha_fin", "")),
                    _parse_int(r.get("duracion_min", "")),
                    r.get("id_informe_generado", "").strip() or None,
                ))
        conn.commit()
    if saltadas:
        logger.warning("servicios: %d filas con técnica no reconocida, omitidas", saltadas)
    return len(filas) - saltadas


def sync_equipos() -> int:
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "equipos_ensayo")
    filas = [r for r in filas if r.get("id_equipo", "").strip()]
    sql = """
        INSERT INTO equipos_ensayo (id_equipo, categoria, equipo, serie, serial_adc,
                                     fecha_calibracion, fecha_vencimiento_calibracion,
                                     activo, observaciones)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id_equipo) DO UPDATE SET
            categoria = EXCLUDED.categoria, equipo = EXCLUDED.equipo, serie = EXCLUDED.serie,
            serial_adc = EXCLUDED.serial_adc, fecha_calibracion = EXCLUDED.fecha_calibracion,
            fecha_vencimiento_calibracion = EXCLUDED.fecha_vencimiento_calibracion,
            activo = EXCLUDED.activo, observaciones = EXCLUDED.observaciones
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            for r in filas:
                cur.execute(sql, (
                    r["id_equipo"].strip(),
                    r.get("categoria", "").strip() or None,
                    r.get("equipo", "").strip() or None,
                    r.get("serie", "").strip() or None,
                    r.get("serial_adc", "").strip() or None,
                    _parse_fecha(r.get("fecha_calibracion", "")),
                    _parse_fecha(r.get("fecha_vencimiento_calibracion", "")),
                    _parse_bool(r.get("activo", "")),
                    r.get("observaciones", "").strip() or None,
                ))
        conn.commit()
    return len(filas)


def sync_personal_certificados() -> int:
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "personal_certificados")
    filas = [r for r in filas if r.get("id_certificado", "").strip()]
    estados_validos = {"VIGENTE", "VENCIDA"}

    sql = """
        INSERT INTO personal_certificados (id_certificado, nombre, cc, numero_certificado,
                                            tecnica, nivel, fecha_emision, fecha_vencimiento,
                                            estado, firma_link, firma_base64)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id_certificado) DO UPDATE SET
            nombre = EXCLUDED.nombre, cc = EXCLUDED.cc,
            numero_certificado = EXCLUDED.numero_certificado, tecnica = EXCLUDED.tecnica,
            nivel = EXCLUDED.nivel, fecha_emision = EXCLUDED.fecha_emision,
            fecha_vencimiento = EXCLUDED.fecha_vencimiento, estado = EXCLUDED.estado,
            firma_link = EXCLUDED.firma_link, firma_base64 = EXCLUDED.firma_base64
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            for r in filas:
                estado = r.get("estado", "").strip().upper()
                cur.execute(sql, (
                    r["id_certificado"].strip(),
                    r.get("nombre", "").strip() or None,
                    r.get("cc", "").strip() or None,
                    r.get("numero_certificado", "").strip() or None,
                    r.get("tecnica", "").strip() or None,
                    r.get("nivel", "").strip() or None,
                    _parse_fecha(r.get("fecha_emision", "")),
                    _parse_fecha(r.get("fecha_vencimiento", "")),
                    estado if estado in estados_validos else None,
                    r.get("firma_link", "").strip() or None,
                    r.get("firma_base64", "").strip() or None,
                ))
        conn.commit()
    return len(filas)


def sync_certificados_usuarios() -> int:
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "certificados_usuarios")
    filas = [r for r in filas if r.get("id_certificado", "").strip()]
    tecnicas_validas = {"MT", "PMI", "570", "510", "ESPESORES"}

    sql = """
        INSERT INTO certificados_usuarios (id_certificado, usuario, tecnica,
                                            nombre_certificado, entidad_emisora,
                                            fecha_emision, fecha_vencimiento, link_pdf)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id_certificado) DO UPDATE SET
            usuario = EXCLUDED.usuario, tecnica = EXCLUDED.tecnica,
            nombre_certificado = EXCLUDED.nombre_certificado,
            entidad_emisora = EXCLUDED.entidad_emisora,
            fecha_emision = EXCLUDED.fecha_emision, fecha_vencimiento = EXCLUDED.fecha_vencimiento,
            link_pdf = EXCLUDED.link_pdf
    """
    saltadas = 0
    with get_connection() as conn:
        with conn.cursor() as cur:
            for r in filas:
                tecnica = r.get("tecnica", "").strip().upper()
                if tecnica not in tecnicas_validas:
                    saltadas += 1
                    continue
                cur.execute(sql, (
                    r["id_certificado"].strip(),
                    r.get("usuario", "").strip() or None,
                    tecnica,
                    r.get("nombre_certificado", "").strip() or None,
                    r.get("entidad_emisora", "").strip() or None,
                    _parse_fecha(r.get("fecha_emision", "")),
                    _parse_fecha(r.get("fecha_vencimiento", "")),
                    r.get("link_pdf", "").strip() or None,
                ))
        conn.commit()
    if saltadas:
        logger.warning("certificados_usuarios: %d filas con técnica no reconocida, omitidas", saltadas)
    return len(filas) - saltadas


def sync_consecutivos_reportes() -> int:
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "consecutivos_reportes")
    filas = [r for r in filas if r.get("consecutivo", "").strip()]

    sql = """
        INSERT INTO consecutivos_reportes (secuencia, consecutivo, tecnica, cliente,
                                            abv_cliente, alcance, abv_alcance,
                                            fecha_ejecucion, fecha_entrega_reporte, dias,
                                            responsable, iniciales_responsable, comentarios)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (consecutivo) DO UPDATE SET
            tecnica = EXCLUDED.tecnica, cliente = EXCLUDED.cliente,
            abv_cliente = EXCLUDED.abv_cliente, alcance = EXCLUDED.alcance,
            abv_alcance = EXCLUDED.abv_alcance, fecha_ejecucion = EXCLUDED.fecha_ejecucion,
            fecha_entrega_reporte = EXCLUDED.fecha_entrega_reporte, dias = EXCLUDED.dias,
            responsable = EXCLUDED.responsable,
            iniciales_responsable = EXCLUDED.iniciales_responsable,
            comentarios = EXCLUDED.comentarios
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            for r in filas:
                secuencia = _parse_int(r.get("secuencia", ""))
                if secuencia is None:
                    continue
                cur.execute(sql, (
                    secuencia,
                    r["consecutivo"].strip(),
                    r.get("tecnica", "").strip() or None,
                    r.get("cliente", "").strip() or None,
                    r.get("abv_cliente", "").strip() or None,
                    r.get("alcance", "").strip() or None,
                    r.get("abv_alcance", "").strip() or None,
                    _parse_fecha(r.get("fecha_ejecucion", "")),
                    _parse_fecha(r.get("fecha_entrega_reporte", "")),
                    _parse_int(r.get("dias", "")),
                    r.get("responsable", "").strip() or None,
                    r.get("iniciales_responsable", "").strip() or None,
                    r.get("comentarios", "").strip() or None,
                ))
            # secuencia se inserta explícita (son filas históricas) — hay que
            # correr el contador de la sequence por encima del máximo
            # importado, si no el próximo INSERT sin secuencia explícita
            # (nextval automático) podría chocar con un valor ya usado.
            cur.execute(
                "SELECT setval(pg_get_serial_sequence('consecutivos_reportes', 'secuencia'), "
                "COALESCE((SELECT MAX(secuencia) FROM consecutivos_reportes), 1))"
            )
        conn.commit()
    return len(filas)


# =============================================================================
# PMI (Caracterización de Materiales) — 2026-07-10. `pmi_general` es un
# espejo 1:1 de la hoja real '1_general' (119 columnas, mismos nombres
# exactos, incluida la tilde de "estación" y los que empiezan con dígito
# como "1_m_procedimiento" — ver pmi_schema.sql). Construir el INSERT a
# partir de esta lista evita escribir 119 mapeos a mano y, si el Sheet
# suma una columna nueva, alcanza con agregarla acá Y en pmi_schema.sql.
# =============================================================================

PMI_GENERAL_COLUMNAS = [
    "id_general", "fecha_llenado", "cliente", "contrato", "n_reporte", "ot", "fecha",
    "departamento", "ciudad", "troncal", "estación", "sistema", "linea", "pk",
    "equipo_inspeccionado", "tag", "descripcion_componente", "material_referencia",
    "material_referencia_2", "estado_componente", "observacion_estado",
    "ubicacion_componente", "dimensiones", "nps", "espesor_min_pulg", "espesor_min_mm",
    "plano_referencia", "observaciones_generales", "image", "comentario_1", "link_foto", "foto",
    "1_m_procedimiento", "1_m_tecnica", "1_m_normas_referencia", "1_m_equipo_desbaste",
    "1_m_marca_desbaste", "1_m_modelo_desbaste", "1_m_serie_desbaste", "1_m_abrasivo",
    "1_m_micro_marca", "1_m_micro_modelo", "1_m_micro_serie", "1_m_micro_lentes",
    "1_m_material_analizar", "1_m_tiempo_ataque_seg", "1_m_reactivo_norma",
    "1_m_calc_vol_solucion", "1_m_calc_conc_acido_base", "1_m_calc_conc_deseada",
    "1_m_res_vol_acido", "1_m_res_vol_dilusor", "1_m_aumentos_metalografias",
    "1_m_image_2", "1_m_comentario_2", "1_m_image_3", "1_m_comentario_3",
    "1_m_image_4", "1_m_comentario_4", "1_m_analisis_inclusiones", "1_m_image_5",
    "1_m_comentario_5", "1_m_analisis_de_inclusiones", "1_m_image_6", "1_m_comentario_6",
    "1_m_tamano_grano", "1_m_fases", "1_m_porceso_fabricacion", "1_m_defectos",
    "1_m_analisis_metalografico",
    "2_q_procedimiento", "2_q_tecnica", "2_q_normas_referencia", "2_q_equipo_desbaste",
    "2_q_marca_desbaste", "2_q_modelo_desbaste", "2_q_serie_desbaste", "2_q_fecha_calibracion",
    "2_q_image_7", "2_q_comentario_7", "2_q_image_8", "2_q_comentario_8",
    "3_d_procedimiento", "3_d_tecnica", "3_d_normas_referencia", "3_d_marca_durometro",
    "3_d_modelo_durometro", "3_d_serie_durometro", "3_d_fecha_calibracion",
    "3_d_ubicacion_horaria", "3_d_escala_dureza", "3_d_tolerancia", "3_d_material_referencia",
    "3_d_image_9", "3_d_comentario_9", "3_d_image_10", "3_d_comentario_10",
    "3_d_analisis_mecanicas",
    "link_imagen_2", "link_imagen_3", "link_imagen_4", "link_imagen_5", "link_imagen_6",
    "link_imagen_7", "link_imagen_8", "link_imagen_9", "link_imagen_10",
    "firma", "nombre", "cargo", "link_firma", "link_reporte", "ce",
    "id_informe", "nombre_supervisor", "id_servicio", "fecha_inicio", "fecha_fin", "finalizado",
]


def _valor_pmi_general(row: dict, col: str):
    raw = (row.get(col, "") or "").strip()
    if col == "fecha":
        return _parse_fecha_dmy(raw)
    if col in ("fecha_inicio", "fecha_fin"):
        return _parse_timestamp(raw)
    if col == "ce":
        return _parse_float(raw)
    if col == "finalizado":
        return _parse_bool(raw)
    return raw or None


def sync_pmi_general() -> int:
    filas = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "1_general")
    filas = [r for r in filas if r.get("id_general", "").strip()]

    columnas_sql = ", ".join(f'"{c}"' for c in PMI_GENERAL_COLUMNAS)
    update_sql = ", ".join(
        f'"{c}" = EXCLUDED."{c}"' for c in PMI_GENERAL_COLUMNAS if c != "id_general"
    )
    sql = f"""
        INSERT INTO pmi_general ({columnas_sql})
        VALUES %s
        ON CONFLICT (id_general) DO UPDATE SET {update_sql}
    """
    valores = [tuple(_valor_pmi_general(r, c) for c in PMI_GENERAL_COLUMNAS) for r in filas]
    with get_connection() as conn:
        with conn.cursor() as cur:
            if valores:
                execute_values(cur, sql, valores, page_size=200)
        conn.commit()
    return len(filas)


def sync_pmi_quimica() -> int:
    """Reemplazo completo por id_general en vez de UPSERT por id_quimica —
    lo que importa acá es el conjunto agregado (promedios, Carbono
    Equivalente), no el historial fila por fila; la fuente de verdad son
    las filas ACTUALES del Sheet. Filtra contra los id_general reales de
    '1_general' para no violar el FK con filas huérfanas.

    Inserción por LOTES (`execute_values`), no fila por fila — con ~2200
    filas reales, un `execute()` por fila tardaba varios minutos por la
    latencia de red hasta Supabase (confirmado 2026-07-10, ver bitácora);
    en lotes de 500 baja a segundos."""
    generales = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "1_general")
    ids_validos = {r["id_general"].strip() for r in generales if r.get("id_general", "").strip()}

    filas = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "2_quimica")
    filas = [
        r for r in filas
        if r.get("id_general", "").strip() in ids_validos and r.get("elemento", "").strip()
    ]

    # Sheet trae "1.12%" como texto -> se guarda como FRACCIÓN (0.0112),
    # mismo criterio que calcular_ce() en report_engine_pmi.py.
    valores = []
    for r in filas:
        valor_pct = _parse_float(r.get("valor", ""))
        if valor_pct is None:
            continue
        valores.append((r["id_general"].strip(), r["elemento"].strip()[:30], round(valor_pct / 100, 5)))

    ids_generales = sorted({v[0] for v in valores})
    with get_connection() as conn:
        with conn.cursor() as cur:
            if ids_generales:
                cur.execute("DELETE FROM pmi_quimica WHERE id_general = ANY(%s)", (ids_generales,))
            if valores:
                execute_values(
                    cur,
                    "INSERT INTO pmi_quimica (id_general, elemento, valor_fraccion) VALUES %s",
                    valores, page_size=500,
                )
        conn.commit()
    return len(valores)


def sync_pmi_durezas() -> int:
    """Mismo criterio de reemplazo completo + inserción por lotes que
    pmi_quimica. `orden` no viene en el Sheet — se asigna secuencial por
    id_general en el mismo orden en que aparecen las filas (coincide con
    cómo report_engine_pmi.py las va llenando en la tabla del reporte,
    RANGO_DUREZAS)."""
    generales = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "1_general")
    ids_validos = {r["id_general"].strip() for r in generales if r.get("id_general", "").strip()}

    filas = read_sheet_as_dicts(PMI_SPREADSHEET_ID, "3_durezas")
    filas = [r for r in filas if r.get("id_general", "").strip() in ids_validos]

    contador: dict[str, int] = {}
    valores = []
    for r in filas:
        id_gen = r["id_general"].strip()
        contador[id_gen] = contador.get(id_gen, 0) + 1
        valores.append((id_gen, contador[id_gen], _parse_float(r.get("dureza", "")), _parse_float(r.get("ksi", ""))))

    ids_generales = sorted(contador.keys())
    with get_connection() as conn:
        with conn.cursor() as cur:
            if ids_generales:
                cur.execute("DELETE FROM pmi_durezas WHERE id_general = ANY(%s)", (ids_generales,))
            if valores:
                execute_values(
                    cur,
                    "INSERT INTO pmi_durezas (id_general, orden, dureza, ksi) VALUES %s",
                    valores, page_size=500,
                )
        conn.commit()
    return len(valores)


TABLAS_SYNC = {
    "usuarios": sync_usuarios,
    "work_orders": sync_work_orders,
    "servicios": sync_servicios,
    "equipos_ensayo": sync_equipos,
    "personal_certificados": sync_personal_certificados,
    "certificados_usuarios": sync_certificados_usuarios,
    "consecutivos_reportes": sync_consecutivos_reportes,
    "pmi_general": sync_pmi_general,
    "pmi_quimica": sync_pmi_quimica,
    "pmi_durezas": sync_pmi_durezas,
}


def sincronizar_todo() -> dict[str, int | str]:
    """Corre las sincronizaciones en orden (respeta dependencias de FK:
    usuarios/work_orders antes que servicios/certificados_usuarios;
    pmi_general antes que pmi_quimica/pmi_durezas).
    Devuelve {tabla: filas_sincronizadas} o {tabla: "ERROR: ..."} si una
    tabla específica falla — una tabla rota no debe tumbar la sincronización
    completa."""
    resultado: dict[str, int | str] = {}
    for tabla, fn in TABLAS_SYNC.items():
        try:
            resultado[tabla] = fn()
        except Exception as e:
            logger.exception("Error sincronizando %s", tabla)
            resultado[tabla] = f"ERROR: {e}"
    return resultado

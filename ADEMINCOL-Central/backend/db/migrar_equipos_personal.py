"""
Primera prueba real de migración Sheets -> Postgres (2026-07-09): las 2 hojas
más chicas y ya bien conocidas, `equipos_ensayo` y `personal_certificados`.

Idempotente: usa UPSERT (INSERT ... ON CONFLICT DO UPDATE) por la clave
natural de cada hoja (id_equipo / id_certificado), así que correr esto varias
veces no duplica filas — sirve tanto para la carga inicial como para
resincronizar más adelante.

Uso: python db/migrar_equipos_personal.py   (desde backend/)
"""
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import get_connection
from app.sheets_client import read_sheet_as_dicts, BD_SPREADSHEET_ID


def parse_fecha(valor: str) -> date | None:
    """Fechas reales verificadas en las 2 hojas (2026-07-09): mezcla de ISO
    (YYYY-MM-DD) y US (M/D/YYYY, confirmado sin ambigüedad — nunca el primer
    número es >12 en ninguna fila de ninguna de las 2 hojas). Ningún valor
    fuera de esos 2 formatos en los datos reales; si algo no calza con
    ninguno, se deja NULL en vez de reventar la migración completa."""
    valor = (valor or "").strip()
    if not valor:
        return None
    for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
        try:
            return datetime.strptime(valor, fmt).date()
        except ValueError:
            continue
    print(f"  ADVERTENCIA: fecha no reconocida {valor!r}, se deja NULL")
    return None


def parse_bool(valor: str) -> bool:
    return (valor or "").strip().upper() == "TRUE"


def migrar_equipos():
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "equipos_ensayo")
    filas = [r for r in filas if r.get("id_equipo", "").strip()]
    print(f"equipos_ensayo: {len(filas)} filas en Sheets")

    sql = """
        INSERT INTO equipos_ensayo
            (id_equipo, categoria, equipo, serie, serial_adc,
             fecha_calibracion, fecha_vencimiento_calibracion, activo, observaciones)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id_equipo) DO UPDATE SET
            categoria = EXCLUDED.categoria,
            equipo = EXCLUDED.equipo,
            serie = EXCLUDED.serie,
            serial_adc = EXCLUDED.serial_adc,
            fecha_calibracion = EXCLUDED.fecha_calibracion,
            fecha_vencimiento_calibracion = EXCLUDED.fecha_vencimiento_calibracion,
            activo = EXCLUDED.activo,
            observaciones = EXCLUDED.observaciones
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
                    parse_fecha(r.get("fecha_calibracion", "")),
                    parse_fecha(r.get("fecha_vencimiento_calibracion", "")),
                    parse_bool(r.get("activo", "")),
                    r.get("observaciones", "").strip() or None,
                ))
        conn.commit()
    print(f"equipos_ensayo: {len(filas)} filas insertadas/actualizadas en Postgres")


def migrar_personal_certificados():
    filas = read_sheet_as_dicts(BD_SPREADSHEET_ID, "personal_certificados")
    filas = [r for r in filas if r.get("id_certificado", "").strip()]
    print(f"personal_certificados: {len(filas)} filas en Sheets")

    sql = """
        INSERT INTO personal_certificados
            (id_certificado, nombre, cc, numero_certificado, tecnica, nivel,
             fecha_emision, fecha_vencimiento, estado, firma_link, firma_base64)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id_certificado) DO UPDATE SET
            nombre = EXCLUDED.nombre,
            cc = EXCLUDED.cc,
            numero_certificado = EXCLUDED.numero_certificado,
            tecnica = EXCLUDED.tecnica,
            nivel = EXCLUDED.nivel,
            fecha_emision = EXCLUDED.fecha_emision,
            fecha_vencimiento = EXCLUDED.fecha_vencimiento,
            estado = EXCLUDED.estado,
            firma_link = EXCLUDED.firma_link,
            firma_base64 = EXCLUDED.firma_base64
    """
    # estado en Sheets ya viene VIGENTE/VENCIDA (ver COLUMNAS_PERSONAL_CERTIFICADOS
    # en CrearHojasBD.gs) — coincide 1:1 con el ENUM cert_estado. Si viene
    # vacío o distinto, se deja NULL en vez de fallar el INSERT completo.
    estados_validos = {"VIGENTE", "VENCIDA"}
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
                    parse_fecha(r.get("fecha_emision", "")),
                    parse_fecha(r.get("fecha_vencimiento", "")),
                    estado if estado in estados_validos else None,
                    r.get("firma_link", "").strip() or None,
                    r.get("firma_base64", "").strip() or None,
                ))
        conn.commit()
    print(f"personal_certificados: {len(filas)} filas insertadas/actualizadas en Postgres")


if __name__ == "__main__":
    migrar_equipos()
    migrar_personal_certificados()

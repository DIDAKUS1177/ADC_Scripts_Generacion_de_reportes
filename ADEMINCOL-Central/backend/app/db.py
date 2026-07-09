"""
Conexión a Postgres (Supabase, proyecto "ADC_REPORT"). Lee DATABASE_URL de
backend/.env (gitignored, nunca se sube).

Pool de conexiones (2026-07-09): abrir una conexión nueva contra Supabase
tarda ~1 segundo (va por internet, no es localhost) — medido en vivo:
`psycopg2.connect()` solo, sin query, ya tarda ~1s. La primera versión de
este archivo abría una conexión NUEVA por cada fetch_all()/get_connection(),
así que una pantalla que hacía 14 consultas (el sidebar de "Base de Datos",
2 por tabla × 7 tablas) tardaba 19 segundos — no por Postgres en sí, sino
por reconectar 14 veces. Con el pool, las conexiones se abren una sola vez
al arrancar el backend y se reutilizan.
"""
import atexit
import os

import psycopg2
import psycopg2.extras
from psycopg2 import pool as pg_pool
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

_pool: pg_pool.ThreadedConnectionPool | None = None


def _get_pool() -> pg_pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        if not DATABASE_URL:
            raise RuntimeError("Falta DATABASE_URL en backend/.env")
        # minconn=2: deja 2 conexiones ya abiertas y listas (evita pagar el
        # ~1s de conexión en la primera consulta de cada request).
        # maxconn=10: FastAPI corre los endpoints sync en un threadpool —
        # con varias pestañas/usuarios a la vez puede haber consultas
        # concurrentes, 10 da margen sin abrir demasiadas hacia Supabase.
        _pool = pg_pool.ThreadedConnectionPool(minconn=2, maxconn=10, dsn=DATABASE_URL)
    return _pool


@atexit.register
def _cerrar_pool():
    if _pool is not None:
        _pool.closeall()


@contextmanager
def get_connection():
    """Context manager que presta una conexión del pool y la devuelve al
    salir — mismo `with get_connection() as conn:` que ya usaba todo el
    código (sync_service.py, main.py), no hizo falta tocar esos archivos."""
    conn = _get_pool().getconn()
    try:
        yield conn
    except Exception:
        conn.rollback()  # no dejar una transacción a medias en el pool
        raise
    finally:
        _get_pool().putconn(conn)


def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    """Ejecuta un SELECT y devuelve una lista de dicts (columna -> valor)."""
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, params)
            return [dict(row) for row in cur.fetchall()]

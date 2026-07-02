"""
Cliente de solo lectura contra Google Sheets, usado por el endpoint de
preview (backend/app/main.py). Es deliberadamente simple: sin caché, sin
reintentos, sin base de datos. Ver docs/03_SINCRONIZACION_SHEETS.md — el
SheetsClient real de la Fase 3 reemplaza esto con manejo de errores robusto.
"""
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_PATH = Path(__file__).resolve().parent.parent / "credentials" / "service-account.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

MT_SPREADSHEET_ID = "1J3FcVxay3dNQMG9SnOwfTccezzuBlaL-PPSiEq7Icy8"

_service = None


def get_sheets_service():
    global _service
    if _service is None:
        creds = service_account.Credentials.from_service_account_file(
            str(CREDENTIALS_PATH), scopes=SCOPES
        )
        _service = build("sheets", "v4", credentials=creds)
    return _service


def read_sheet_as_dicts(spreadsheet_id: str, sheet_name: str) -> list[dict]:
    """Lee una hoja completa y la devuelve como lista de dicts {header: valor}.
    Headers normalizados con strip() + lower() (ver hallazgo del espacio en
    'observaciones ' documentado en 03_SINCRONIZACION_SHEETS.md)."""
    service = get_sheets_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'")
        .execute()
    )
    rows = result.get("values", [])
    if not rows:
        return []
    headers = [str(h).strip().lower() for h in rows[0]]
    out = []
    for row in rows[1:]:
        padded = row + [""] * (len(headers) - len(row))
        out.append(dict(zip(headers, padded)))
    return out

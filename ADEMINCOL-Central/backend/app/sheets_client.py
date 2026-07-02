"""
Cliente contra Google Sheets, usado por el backend de preview
(backend/app/main.py). Lectura de las BDs de inspección (MT) y
lectura/escritura de la BD temporal de usuarios/OTs (ver
sheets-db/CrearHojasBD.gs y decisión D11 en docs/00_ARQUITECTURA.md).
El SheetsClient robusto de la Fase 3 (retries, backoff) reemplaza esto.
"""
from pathlib import Path

from google.oauth2 import service_account
from googleapiclient.discovery import build

CREDENTIALS_PATH = Path(__file__).resolve().parent.parent / "credentials" / "service-account.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

MT_SPREADSHEET_ID = "1J3FcVxay3dNQMG9SnOwfTccezzuBlaL-PPSiEq7Icy8"
# BD temporal usuarios/work_orders creada con sheets-db/CrearHojasBD.gs
BD_SPREADSHEET_ID = "1HVGz6v06ML1Ohg3z6n8HS_97etWChev7fkwDgEPOIMo"

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


def get_sheet_headers(spreadsheet_id: str, sheet_name: str) -> list[str]:
    service = get_sheets_service()
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=spreadsheet_id, range=f"'{sheet_name}'!1:1")
        .execute()
    )
    rows = result.get("values", [[]])
    return [str(h).strip().lower() for h in rows[0]]


def append_row(spreadsheet_id: str, sheet_name: str, data: dict) -> None:
    """Agrega una fila al final, alineando los valores con los headers reales."""
    headers = get_sheet_headers(spreadsheet_id, sheet_name)
    row = [data.get(h, "") for h in headers]
    service = get_sheets_service()
    service.spreadsheets().values().append(
        spreadsheetId=spreadsheet_id,
        range=f"'{sheet_name}'",
        valueInputOption="USER_ENTERED",
        insertDataOption="INSERT_ROWS",
        body={"values": [row]},
    ).execute()


def update_cell_by_key(
    spreadsheet_id: str,
    sheet_name: str,
    key_column: str,
    key_value: str,
    column_to_update: str,
    new_value,
) -> bool:
    """Busca la fila donde key_column == key_value y actualiza una columna.
    Devuelve True si la encontró y actualizó."""
    headers = get_sheet_headers(spreadsheet_id, sheet_name)
    if key_column not in headers or column_to_update not in headers:
        return False
    rows = read_sheet_as_dicts(spreadsheet_id, sheet_name)
    for idx, row in enumerate(rows):
        if str(row.get(key_column, "")).strip() == str(key_value).strip():
            fila_sheet = idx + 2  # +1 por header, +1 porque Sheets es 1-indexado
            col_letra = chr(65 + headers.index(column_to_update))
            service = get_sheets_service()
            service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{sheet_name}'!{col_letra}{fila_sheet}",
                valueInputOption="USER_ENTERED",
                body={"values": [[new_value]]},
            ).execute()
            return True
    return False

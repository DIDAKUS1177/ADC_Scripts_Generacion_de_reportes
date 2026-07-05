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


def _column_letter(index: int) -> str:
    """Índice 0-based -> letra(s) de columna estilo Excel (0='A', 25='Z',
    26='AA'...). `chr(65 + index)` que se usaba antes solo servía hasta la
    columna Z (26) — se rompía en hojas anchas como '1_general' de PMI, que
    tiene 113 columnas (link_reporte cae en la columna DH)."""
    index += 1
    letters = ""
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        letters = chr(65 + remainder) + letters
    return letters

CREDENTIALS_PATH = Path(__file__).resolve().parent.parent / "credentials" / "service-account.json"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

MT_SPREADSHEET_ID = "1J3FcVxay3dNQMG9SnOwfTccezzuBlaL-PPSiEq7Icy8"
# PMI = Caracterización de Materiales. Hojas usadas: 1_general, 2_quimica,
# 3_durezas (verificado 2026-07-03). Hojas NO usadas por el reporte actual:
# map, map_v2, 0_1_Quimica, 0_referencias, 1_1_metalografia,
# 1_2_analisis_de_componentes, 1_2_1_quimica, FORMATO_MATERIALES_ADC, A370
# — parecen catálogos/tablas de referencia de AppSheet o versiones viejas,
# igual que "1.map"/"6.complementos" en el Sheet de MT.
PMI_SPREADSHEET_ID = "1F4bR_f0Vyap9yY8iLXrOw75ni3rk1_D1s7xSPlEDosw"
# API 570 (Inspección Visual de Tubería). Hoja general/activadora:
# '#1_informaciongeneral' (id_api570). 15 secciones independientes, cada una
# con su propia hoja de datos + hoja de fotos (`#N_seccion` / `#N_seccion_photos`)
# — ver report_engine_570.py, SECTIONS_CONFIG. `ot` es texto libre, no una FK
# a nuestra BD de OTs (decisión 2026-07-03: OT no es obligatoria para 570).
SHEET_570_ID = "1Qlq1F07XvONIvQAo4-BFuhy9zohn-Z1q17-BOFIwWFI"
HOJA_570_GENERAL = "#1_informaciongeneral"
# API 510 (Inspección Visual de Recipientes a Presión). A diferencia de 570,
# los datos y las fotos viven en DOS spreadsheets separados. Hoja
# general/activadora: '0.pv_general' (pvid). 11 secciones — ver
# report_engine_510.py, SECTIONS_CONFIG. `ot` también es texto libre.
SHEET_510_DATOS_ID = "1RTgmI6Ftwuf3b00ELIgnQZrBvbN3Jiw36HBCAbTWuwY"
SHEET_510_FOTOS_ID = "1i_pHG65ljg5NidkQa_n611PPSOmVcmNUNZ4mY-mqrpI"
HOJA_510_GENERAL = "0.pv_general"
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
        # Con headers DUPLICADOS gana la PRIMERA columna (no la última, que
        # es lo que hacía dict(zip())): iguala el comportamiento de
        # headers.indexOf() de los scripts GAS originales. Caso real: la hoja
        # '#1_informaciongeneral' de 570 tiene 'fecha' dos veces (fecha de
        # inspección y fecha de la firma) y se estaba leyendo la equivocada.
        d: dict = {}
        for h, v in zip(headers, padded):
            if h not in d:
                d[h] = v
        out.append(d)
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
            col_letra = _column_letter(headers.index(column_to_update))
            service = get_sheets_service()
            service.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=f"'{sheet_name}'!{col_letra}{fila_sheet}",
                valueInputOption="USER_ENTERED",
                body={"values": [[new_value]]},
            ).execute()
            return True
    return False

def delete_rows_by_key(
    spreadsheet_id: str,
    sheet_name: str,
    key_column: str,
    key_value: str
) -> int:
    """Elimina todas las filas donde key_column == key_value."""
    headers = get_sheet_headers(spreadsheet_id, sheet_name)
    if key_column not in headers: return 0
    rows = read_sheet_as_dicts(spreadsheet_id, sheet_name)
    
    service = get_sheets_service()
    sheet_metadata = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
    sheet_id = next(s['properties']['sheetId'] for s in sheet_metadata['sheets'] if s['properties']['title'] == sheet_name)
    
    requests = []
    # Iterar en reverso para borrar de abajo hacia arriba sin afectar índices
    deleted_count = 0
    for idx, row in reversed(list(enumerate(rows))):
        if str(row.get(key_column, "")).strip() == str(key_value).strip():
            # API usa 0-index. index 0 = headers, index 1 = row[0] de la data
            row_index = idx + 1 
            requests.append({
                "deleteDimension": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "startIndex": row_index,
                        "endIndex": row_index + 1
                    }
                }
            })
            deleted_count += 1
            
    if requests:
        service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={"requests": requests}
        ).execute()
        
    return deleted_count


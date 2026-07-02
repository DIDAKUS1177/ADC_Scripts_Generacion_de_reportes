# Backend

## `app/main.py` — API de preview (temporal)

Lee datos reales de Google Sheets sin base de datos ni autenticación. Sirve para
validar visualmente en el frontend que la conexión con Sheets funciona, mientras
se construyen las Fases 1-4 (`ADEMINCOL-Central/docs/`).

**No es el backend final.** No tiene auth, no tiene caché, no maneja reintentos.
Se reemplaza por el backend completo (FastAPI + PostgreSQL + JWT) descrito en
`docs/02_BACKEND_FASTAPI.md`.

### Ejecutar

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Requiere `backend/credentials/service-account.json` (no se sube a git — ver
`docs/03_SINCRONIZACION_SHEETS.md`, Paso 3.1).

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | chequeo de salud |
| GET | `/api/preview/mt` | lista de informes MT desde `2.general_particulas_magneticas` |
| GET | `/api/preview/mt/{id_informe}` | detalle con resultados e indicaciones vinculadas |

El frontend los consume desde `frontend/src/api/previewClient.ts` en la pantalla
`/preview-real-mt` (botón "Ver datos reales (Sheets MT)" en Inspecciones).

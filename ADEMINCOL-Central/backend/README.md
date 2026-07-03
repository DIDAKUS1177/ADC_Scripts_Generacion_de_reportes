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
| GET | `/api/preview/mt/{id_informe}` | detalle con resultados, indicaciones y fotos |
| POST | `/api/preview/mt/{id_informe}/generar-reporte` | inicia generación asíncrona (devuelve `jobId`) |
| GET | `/api/preview/pmi` | lista de informes PMI desde `1_general` |
| GET | `/api/preview/pmi/{id_general}` | detalle con química, durezas, fotos y CE calculado |
| POST | `/api/preview/pmi/{id_general}/generar-reporte` | inicia generación asíncrona (devuelve `jobId`) |
| GET | `/api/preview/jobs/{job_id}` | estado del job (`RUNNING`/`DONE`/`ERROR`, `pct`, `etapa`) |
| GET | `/api/preview/jobs/{job_id}/descargar` | descarga el `.xlsx` cuando el job está `DONE` |
| GET/POST | `/api/preview/usuarios` | listar / crear usuarios (BD Sheets, password hasheada con bcrypt) |
| PATCH | `/api/preview/usuarios/{usuario}/activo` | activar/desactivar |
| PATCH | `/api/preview/usuarios/{usuario}/firma` | guarda firma en base64 (desde `SignaturePad`) |
| GET/PATCH | `/api/preview/usuarios/{usuario}/certificados` | certificados del usuario (tabla `certificados_usuarios`) |
| GET/POST | `/api/preview/ots` | listar / crear órdenes de trabajo (BD Sheets) |

El frontend los consume desde `frontend/src/api/previewClient.ts`. MT y PMI se ven
en Inspecciones (pestañas MT/PMI), usuarios/certificados en `/usuarios` y `/equipos`,
OTs en `/ots`.

### Motores de reporte

- `app/report_engine_mt.py` — MT, con inserción dinámica de filas (resultados/fotos).
- `app/report_engine_pmi.py` — PMI, con rangos fijos (química 18 slots, durezas 59 slots)
  y cálculo de Carbono Equivalente (`calcular_ce()`).
- `app/image_utils.py` — funciones compartidas (descarga + inserción centrada de
  imágenes) usadas por ambos motores.

Ver decisiones D10-D15 en `docs/00_ARQUITECTURA.md` para el detalle de cada bug
encontrado y corregido durante la construcción de esta capa de preview.

# Fase 2 — Backend FastAPI

**Objetivo:** API REST con autenticación JWT, roles y CRUD completo.
**Resultado verificable:** `uvicorn app.main:app` corre, `/docs` muestra todos los
endpoints, y los tests de `tests/` pasan.

---

## Paso 2.1 — Estructura del proyecto

```
backend/
├── app/
│   ├── main.py                 # FastAPI app, CORS, routers, startup
│   ├── core/
│   │   ├── config.py           # Settings con pydantic-settings (lee .env)
│   │   ├── database.py         # engine, SessionLocal, get_db()
│   │   ├── security.py         # hash/verify password, create/decode JWT
│   │   └── seed.py
│   ├── models/                 # SQLAlchemy (Fase 1)
│   ├── schemas/                # Pydantic: UserOut, OTCreate, InspectionOut...
│   ├── api/
│   │   ├── deps.py             # get_current_user, require_role(...)
│   │   └── v1/
│   │       ├── auth.py
│   │       ├── users.py
│   │       ├── work_orders.py
│   │       ├── inspections.py
│   │       ├── reports.py      # (implementación real en Fase 4)
│   │       ├── sync.py         # (implementación real en Fase 3)
│   │       └── dashboard.py
│   └── services/               # (Fases 3 y 4)
├── tests/
│   ├── conftest.py             # BD de test + client fixture
│   ├── test_auth.py
│   ├── test_users.py
│   └── test_work_orders.py
├── .env.example
├── requirements.txt
└── alembic/
```

## Paso 2.2 — requirements.txt

```
fastapi>=0.110
uvicorn[standard]
sqlalchemy>=2.0
psycopg2-binary
alembic
pydantic-settings
python-jose[cryptography]
passlib[bcrypt]
python-multipart
google-api-python-client
google-auth
openpyxl>=3.1
apscheduler
pytest
httpx
```

## Paso 2.3 — Configuración (.env)

`.env.example` (el `.env` real va en `.gitignore`):

```env
DATABASE_URL=postgresql://ademincol:dev_password_cambiar@localhost:5432/ademincol_central
JWT_SECRET=generar_con_openssl_rand_hex_32
JWT_ALGORITHM=HS256
ACCESS_TOKEN_MINUTES=30
REFRESH_TOKEN_DAYS=7
GOOGLE_SERVICE_ACCOUNT_FILE=./credentials/service-account.json
STORAGE_DIR=./storage
CORS_ORIGINS=http://localhost:5173
```

`core/config.py` usa `pydantic_settings.BaseSettings` — NUNCA leer env vars con
`os.environ` directo en el resto del código.

## Paso 2.4 — Seguridad

`core/security.py`:

```python
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta, timezone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str: ...
def verify_password(plain: str, hashed: str) -> bool: ...
def create_access_token(user_id: int, rol: str) -> str: ...
def create_refresh_token(user_id: int) -> str: ...
```

`api/deps.py`:

```python
def get_current_user(token = Depends(oauth2_scheme), db = Depends(get_db)) -> User:
    # decodifica JWT, busca user activo, 401 si falla

def require_role(*roles: str):
    # dependency factory: raise 403 si current_user.rol not in roles
```

Reglas:
- Login fallido: respuesta genérica "Credenciales inválidas" (no revelar si el usuario existe).
- Rate limit de login: máximo 5 intentos por usuario por 15 min (tabla en memoria o
  `slowapi`; suficiente algo simple).
- Todo endpoint excepto `/auth/login` y `/health` requiere token.

## Paso 2.5 — Endpoints

Prefijo global `/api/v1`.

### auth.py
| Método | Ruta | Body | Respuesta |
|--------|------|------|-----------|
| POST | `/auth/login` | `{usuario, password}` | `{access_token, refresh_token, user}` |
| POST | `/auth/refresh` | `{refresh_token}` | `{access_token}` |
| GET | `/auth/me` | — | `UserOut` |
| POST | `/auth/change-password` | `{actual, nueva}` | 204 |

### users.py — todo requiere `require_role('ADMINISTRADOR')` excepto ver/editar el propio perfil
| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/users` | filtros: `?rol=&activo=&q=` (búsqueda por nombre) |
| POST | `/users` | crea con password temporal; audit_log |
| PATCH | `/users/{id}` | audit_log con antes/después |
| DELETE | `/users/{id}` | **soft delete** (`activo=false`), nunca DELETE físico |
| POST | `/users/{id}/firma` | multipart upload; validar content-type image/png|jpeg y máx 2 MB; guardar como base64 en `users.firma_base64` + `firma_mime` (decisión D8). Un usuario puede subir la SUYA; el admin la de cualquiera |
| GET | `/users/{id}/firma` | devuelve la imagen decodificada (`Response(content=..., media_type=firma_mime)`) para preview en la UI |

### work_orders.py — admin y supervisor
| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/ots` | filtros `?estado=&supervisor_id=&inspector_id=&q=`; paginado `?page=&size=` (default size=50). Inspector solo ve las suyas. |
| POST | `/ots` | valida `numero` único |
| PATCH | `/ots/{id}` | audit_log |
| GET | `/ots/{id}` | incluye inspecciones vinculadas |

### inspections.py
| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/inspections` | filtros `?report_type=&estado_reporte=&ot_id=&q=`; paginado |
| GET | `/inspections/{id}` | datos generales + hijas agrupadas por sheet_name |
| PATCH | `/inspections/{id}/link-ot` | body `{work_order_id}` — vincular a una OT |

### dashboard.py
| Método | Ruta | Notas |
|--------|------|-------|
| GET | `/dashboard` | según rol: admin ve totales globales (OTs por estado, reportes generados/mes, inspecciones pendientes por tipo); supervisor ve solo lo suyo |

### Stubs para fases posteriores
- `POST /sync/run` → 501 hasta Fase 3.
- `POST /inspections/{id}/generate-report` → 501 hasta Fase 4.
- `GET /reports/{id}/download` → 501 hasta Fase 4.

## Paso 2.6 — Tests mínimos obligatorios

Con `pytest` + `httpx.AsyncClient` + BD de test (puede ser el mismo Postgres con
schema `test_` o BD `ademincol_test`):

1. Login OK devuelve token válido; login con password mala devuelve 401.
2. Endpoint protegido sin token → 401; con rol insuficiente → 403.
3. Crear usuario como admin funciona; como supervisor → 403.
4. Soft delete: el usuario borrado no aparece en GET /users?activo=true pero existe en BD.
5. Crear OT con número duplicado → 409.
6. Inspector solo ve sus OTs.

## Criterios de aceptación de la Fase 2

- [ ] `uvicorn app.main:app --reload` levanta sin errores.
- [ ] `/docs` (Swagger) muestra todos los endpoints con schemas.
- [ ] Los 6 tests mínimos pasan con `pytest`.
- [ ] `git grep -i "password.*=.*['\"]"` no encuentra contraseñas hardcodeadas (excepto seed, que usa hash).
- [ ] CORS solo permite el origen del frontend.
- [ ] Actualizar tabla de avance del README raíz.

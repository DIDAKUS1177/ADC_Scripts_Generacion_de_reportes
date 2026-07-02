# Fase 6 — Despliegue

**Objetivo:** Todo el stack corriendo con un solo comando en desarrollo, y guía para
producción.
**Resultado verificable:** `docker compose up` levanta db + backend + frontend y la
app funciona end-to-end.

---

## Paso 6.1 — docker-compose.yml completo

```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ademincol
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ademincol_central
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ademincol"]
      interval: 5s
      retries: 5

  backend:
    build: ./backend
    env_file: ./backend/.env
    depends_on:
      db: { condition: service_healthy }
    volumes:
      - ./backend/credentials:/app/credentials:ro
      - storage:/app/storage          # firmas y reportes persisten
    ports: ["8000:8000"]
    command: >
      sh -c "alembic upgrade head &&
             uvicorn app.main:app --host 0.0.0.0 --port 8000"

  frontend:
    build: ./frontend
    ports: ["5173:80"]                # nginx sirviendo el build
    depends_on: [backend]

volumes:
  pgdata:
  storage:
```

- `backend/Dockerfile`: `python:3.11-slim`, instalar requirements, copiar app.
- `frontend/Dockerfile`: multi-stage — `node:20` para `npm run build`, luego
  `nginx:alpine` sirviendo `dist/` con proxy `/api` → `backend:8000`.

## Paso 6.2 — Variables y secretos

- Un solo `.env` raíz para compose (`DB_PASSWORD`) + `backend/.env` para la app.
- **Checklist de secretos** (verificar antes de cada push):
  - [ ] `.env`, `backend/.env`, `backend/credentials/` en `.gitignore`
  - [ ] `JWT_SECRET` distinto en producción (`openssl rand -hex 32`)
  - [ ] `DB_PASSWORD` distinto en producción

## Paso 6.3 — Backups

Script `scripts/backup.ps1` (Windows, donde corre hoy) o cron en el servidor:

```
pg_dump -U ademincol ademincol_central | gzip > backups/central_$(date +%F).sql.gz
```
+ copiar la carpeta `storage/` (firmas y reportes). Retener 30 días.

## Paso 6.4 — Opciones de hosting (decisión del usuario)

| Opción | Costo aprox | Pros | Contras |
|--------|-------------|------|---------|
| **PC/servidor local de la empresa** | $0 | Sin costo, datos en casa | Depende de que el equipo esté encendido; acceso externo requiere VPN o túnel |
| **VPS (Hetzner/DigitalOcean)** | ~$6-12/mes | Simple, todo en Docker tal cual | Mantenimiento manual |
| **Google Cloud Run + Cloud SQL** | ~$15-30/mes | Escala solo, mismo ecosistema Google | Más complejo de configurar |

Recomendación: empezar en local o VPS con el compose tal cual; migrar a cloud
solo si el uso lo exige.

## Paso 6.5 — Corte de operación (cuándo apagar los scripts GAS)

NO apagar nada hasta que:
1. Los 3 tipos de reporte (MT, VT, UT) generen idéntico al GAS (validado por el usuario).
2. Dos semanas de operación en paralelo sin discrepancias.
3. Los supervisores estén usando la webapp como vía principal.

Después: dejar los scripts GAS en el repo como referencia histórica (no borrar).

## Criterios de aceptación de la Fase 6

- [ ] `docker compose up` en máquina limpia deja la app funcionando end-to-end.
- [ ] Las migraciones corren automáticamente al arrancar el backend.
- [ ] Reportes y firmas sobreviven a `docker compose down && up` (volúmenes).
- [ ] Backup y restore probados una vez (restaurar en BD de prueba).
- [ ] Actualizar tabla de avance del README raíz.

# Fase 5 — Frontend React

**Objetivo:** SPA en React + TypeScript con el estilo ADEMINCOL, navegación por rol
y todos los flujos: login, usuarios, OTs, inspecciones y generación de reportes.
**Resultado verificable:** un supervisor puede loguearse, ver inspecciones
sincronizadas, generar un reporte y descargarlo, todo desde el navegador.

---

## Paso 5.1 — Setup

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm i react-router-dom @tanstack/react-query axios lucide-react
npm i -D tailwindcss postcss autoprefixer
```

Referencia de diseño: `ADEMINCOL-Scripts/APP014_Supervisores/webapp-supervisores/Index.html`
(replicar look & feel, no el código).

Tokens de diseño en `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: { brand: { DEFAULT: '#dc2626', dark: '#b91c1c' } },
    fontFamily: { sans: ['Inter', 'sans-serif'] },
  }
}
```
Sello visual ADEMINCOL: header blanco con `border-b-4 border-brand`, texto
"ADEMINCOL" en negrita itálica, iconos Lucide.

## Paso 5.2 — Estructura

```
frontend/src/
├── api/
│   ├── client.ts          # axios con baseURL + interceptor JWT + refresh automático
│   ├── auth.ts, users.ts, ots.ts, inspections.ts, reports.ts, sync.ts
├── types/index.ts         # interfaces espejo de los schemas Pydantic
├── context/AuthContext.tsx # user, token, login(), logout()
├── components/
│   ├── layout/            # AppShell (sidebar + header), Sidebar, ProtectedRoute
│   ├── ui/                # Button, Modal, Table, Badge, Toast, Spinner, Pagination
│   └── domain/            # UserFormModal, OTFormModal, SignatureUpload, ReportStatusBadge
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── UsersPage.tsx           (solo admin)
│   ├── WorkOrdersPage.tsx
│   ├── InspectionsPage.tsx     ← la pantalla central
│   ├── InspectionDetailPage.tsx
│   └── ProfilePage.tsx
└── App.tsx                # router + guards por rol
```

## Paso 5.3 — Autenticación en el cliente

- `client.ts`: interceptor request añade `Authorization: Bearer`; interceptor
  response con 401 intenta `/auth/refresh` una vez, si falla → logout + redirect.
- Tokens en `localStorage` (aceptable para app interna).
- `ProtectedRoute` recibe `roles?: Role[]`; sin permiso → redirect a dashboard.
- Menú lateral según rol (mismo mapa que webapp-supervisores):
  - ADMINISTRADOR: Dashboard, Usuarios, OTs, Inspecciones, Sync, Perfil
  - SUPERVISOR: Dashboard, OTs, Inspecciones, Perfil
  - INSPECTOR: Dashboard, Mis OTs, Mis Reportes, Perfil

## Paso 5.4 — Pantallas clave

### InspectionsPage (el corazón de la app)
- Tabla paginada (server-side, `useQuery` con los filtros como query key).
- Filtros: tipo de reporte (tabs MT / VT / UT), estado del reporte, búsqueda por
  id_informe/cliente, rango de fechas.
- Columnas: id_informe, cliente, fecha, reporte_n, OT vinculada, estado
  (badge de color: Pendiente=rojo, Generando=amarillo+spinner, Generado=verde), acciones.
- Acciones por fila: **Generar reporte**, **Descargar** (si generado), **Ver detalle**,
  **Vincular OT** (dropdown de OTs activas).
- Selección múltiple + botón "Generar seleccionados" → `/reports/generate-batch`,
  con progreso por fila (polling cada 3 s mientras haya filas GENERANDO).
- Botón "Sincronizar ahora" (admin/supervisor) → `POST /sync/run` + toast con resultado.

### InspectionDetailPage
- Datos generales en grid de 2 columnas (del JSONB).
- Tabs por hoja hija: Resultados, Indicaciones, Fotos (galería con miniaturas).
- Historial de reportes generados: quién, cuándo, descargar cada versión.

### UsersPage (admin)
- Tabla con búsqueda y filtro por rol/activo.
- Modal crear/editar: nombre, usuario, correo, cargo, rol, certificado,
  upload de firma (preview, validar 2 MB máx en el cliente TAMBIÉN).
- Desactivar con confirmación (soft delete).

### DashboardPage
- Cards por rol: OTs por estado, reportes generados este mes, inspecciones
  pendientes por tipo, última sincronización (verde <10 min, amarillo <1 h, rojo más).

## Paso 5.5 — Estados obligatorios en TODA petición

Regla sin excepciones — cada llamada a la API maneja los 4 estados:
1. **Cargando:** spinner o skeleton (nunca pantalla congelada).
2. **Éxito:** toast en mutaciones (verde, auto-cierra 3 s).
3. **Error:** toast rojo con el `detail` del backend + botón reintentar donde aplique.
4. **Vacío:** ilustración/texto "No hay datos" con acción sugerida.

React Query se configura con `retry: 1` y `staleTime: 30_000` por defecto.

## Paso 5.6 — Responsive

Los supervisores usan también tablet. Breakpoints:
- Desktop: sidebar fija.
- < lg: sidebar colapsable con hamburguesa.
- Las tablas en móvil colapsan a cards apiladas (componente `ResponsiveTable`).

## Criterios de aceptación de la Fase 5

- [ ] Flujo completo en navegador: login → ver inspecciones → generar reporte → descargar.
- [ ] Un INSPECTOR no ve (ni por URL directa) Usuarios ni Sync.
- [ ] Refresh de token automático funciona (probar con ACCESS_TOKEN_MINUTES=1).
- [ ] `npm run build` compila sin errores de TypeScript (cero `any` — regla estricta).
- [ ] Vista usable en 768 px de ancho.
- [ ] Generación masiva muestra progreso por fila.
- [ ] Actualizar tabla de avance del README raíz.

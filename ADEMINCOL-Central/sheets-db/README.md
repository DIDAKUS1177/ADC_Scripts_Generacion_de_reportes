# BD temporal en Google Sheets (para pruebas con AppSheet)

Ver decisión D11 en `../docs/00_ARQUITECTURA.md`. Esto NO reemplaza PostgreSQL — es
un puente para probar usuarios/roles/firmas/OTs sin levantar infraestructura, con
columnas idénticas a las tablas reales para que migrar después sea trivial.

## Pasos

1. Crear un Google Sheet nuevo, ej. **"ADEMINCOL_BD_Central"**.
2. Extensiones → Apps Script → pegar el contenido de `CrearHojasBD.gs`.
3. Guardar, autorizar, y ejecutar `crearEstructuraBD` una vez. Aparecerán las hojas
   `usuarios`, `work_orders` y `certificados_usuarios` con encabezados, validaciones de
   lista (rol, estado) y casilla (activo).
   - `certificados_usuarios` permite varios certificados por usuario (nombre, entidad
     emisora, fecha de emisión/vencimiento, link al PDF) — ver decisión D12 en
     `00_ARQUITECTURA.md`: es para certificaciones de personal (ASNT, SNT-TC-1A...),
     NO para equipos físicos de ensayo.
4. Ir a [app.appsheet.com](https://app.appsheet.com) → Create → From spreadsheet →
   seleccionar el Sheet.
5. En AppSheet, editar la columna `firma` de la tabla `usuarios`: tipo **Signature**.
   AppSheet la guarda como imagen en Drive y llena `firma_link` automáticamente.
6. Para crear un usuario nuevo, generar su `password_hash` primero:
   ```bash
   cd sheets-db
   pip install bcrypt
   python hashear_password.py "ContraseñaDelUsuario"
   ```
   Copiar el valor impreso en la columna `password_hash` de la fila del usuario
   (nunca pegar la contraseña en texto plano).

## Compartir con la cuenta de servicio (opcional, para que el backend lea este Sheet)

Igual que con el Sheet de MT: Compartir → `didakus@adcformatos.iam.gserviceaccount.com`
→ permiso Editor.

# Estándar de columnas para apps de AppSheet (técnicas)

Salido de la reunión con el jefe (2026-07-03). Define qué columnas debe tener
**cualquier** hoja de captura que alimente AppSheet (MT, PMI, y las que se agreguen
después: VT soldadas, UT espesores...), para que:
1. El supervisor pueda "generar servicio" y el inspector vea solo lo suyo en AppSheet.
2. Se puedan medir los tiempos de cada inspección (inicio → fin).
3. El backend pueda detectar automáticamente qué informes están vinculados a qué
   servicio/OT y avisar si el inspector no tiene certificado para esa técnica.

**Alcance de esta fase:** este documento define el estándar y dónde va cada cosa.
Las columnas NO se han agregado todavía a los Sheets de producción (MT, PMI) —
eso se hace cuando el usuario lo autorice explícitamente (ver decisión D16 en
`00_ARQUITECTURA.md`). Sí ya existen en nuestra BD de Sheets (`sheets-db/`,
hoja `servicios`) porque esa es de nuestro control total.

---

## 1. Columnas obligatorias en la hoja GENERAL de cada técnica

Toda hoja "general"/madre (equivalente a `2.general_particulas_magneticas` en MT,
`1_general` en PMI, o `#1_informaciongeneral` en 570) debe tener, ADEMÁS de sus
columnas propias de datos:

| Columna | Tipo | Quién la llena | Para qué sirve |
|---|---|---|---|
| `id_informe` (o `id_general`, `id_api570`...) | Texto, único | AppSheet (autogenerado) | Identifica el informe individual. Es la clave real para "buscar la inspección" — **nunca la OT** (ver sección 1bis) |
| `nombre_supervisor` | **Enum buscable** (no texto libre, ver sección 1bis) | El supervisor, al pre-cargar el registro general | Permite que el inspector filtre/busque "las inspecciones de mi supervisor" en AppSheet |
| `id_servicio` | Texto | **Supervisor**, al generar el servicio (o el inspector lo selecciona de una lista filtrada) | Vincula el informe con el servicio de nuestra BD (`sheets-db` → hoja `servicios` → columna `id_servicio`). Solo aplica a técnicas que SÍ pasan por el modelo OT→Servicio (hoy: MT, PMI — 570 no, ver decisión D16bis) |
| `fecha_inicio` | Fecha+hora | AppSheet, automático al ABRIR el formulario por primera vez | Inicio real de la captura |
| `fecha_fin` | Fecha+hora | AppSheet, automático al pulsar el botón **Finalizado** (ver sección 3) | Fin real de la captura — de aquí sale la duración |
| `finalizado` | Casilla (TRUE/FALSE) | AppSheet, al pulsar el botón Finalizado | Marca que el inspector considera el informe completo y listo para generar el reporte. **El botón "Generar reporte" en la webapp solo debe habilitarse si `finalizado = TRUE`** |

### Por qué `id_servicio` y no `id_ot` directo

Una OT puede tener varias técnicas (MT + PMI), cada una con su propio inspector y
sus propios tiempos. Si el informe solo tuviera `id_ot`, no se podría saber a cuál
de los dos servicios pertenece. `id_servicio` es siempre 1:1 con un informe (o un
grupo de informes de la misma técnica dentro de la misma OT).

---

## 1bis. Patrón de búsqueda "supervisor → inspección" (estándar, todas las técnicas)

Definido a partir del caso 570 (2026-07-03), pero es el patrón OFICIAL para
cualquier técnica nueva de aquí en adelante: el inspector NO escribe el ID a mano
ni lo busca a ciegas en una lista larga — primero busca a su supervisor, y eso
filtra la lista de IDs disponibles.

**En la hoja GENERAL/madre**, columna `nombre_supervisor`:

| Propiedad | Valor |
|---|---|
| Type | **Enum** |
| Base type | Text |
| Valid_if | `SORT(UNIQUE(SELECT(<hoja_general>[nombre_supervisor], TRUE)))` (idealmente contra una tabla real de supervisores si existe) |
| Input mode | **Search** |
| Editable | TRUE — la llena el supervisor al crear el registro, no el inspector |

**En cada hoja de sección/detalle que referencia la hoja general** (ej. las 15
secciones de 570, o las hojas de resultados/fotos de MT/PMI), DOS columnas:

1. `supervisor_filtro` (columna puente, NO se usa en el reporte, solo para filtrar):
   - Type: **Enum**, mismo `Valid_if` que `nombre_supervisor` de la hoja general.
   - La llena el inspector PRIMERO, antes de elegir el ID.
2. La columna que ya referencia la hoja general (`id_informe`, `id_general`,
   `id_api570`...):
   - Type: **Ref** (no texto plano) → tabla = la hoja general.
   - Input mode: **Search**.
   - `Valid_if`: `SELECT(<hoja_general>[<id>], [nombre_supervisor] = [_THIS].[supervisor_filtro])`
     — así solo aparecen los IDs del supervisor ya elegido.

Con esto el flujo del inspector en campo es: 1) busca su supervisor → 2) busca/elige
el ID de la inspección (nunca la OT, nunca a ciegas) → 3) llena los datos.

---

## 2. Cómo filtra AppSheet por `id_servicio` (diseño, para implementar cuando se autorice)

En AppSheet, la vista de captura del inspector debe filtrarse así:

```
Condición del filtro (Data → hoja general → Row filter condition):
  AND(
    [id_servicio] IN (SELECT(servicios[id_servicio],
                       AND([inspector_usuario] = USEREMAIL(),
                           [estado] <> "COMPLETADA"))),
    ...
  )
```

En la práctica, esto requiere que AppSheet tenga acceso de LECTURA a la hoja
`servicios` de nuestra BD (`sheets-db`) — hoy AppSheet solo lee el Sheet de MT/PMI,
no el de nuestra BD central. Dos formas de resolverlo (a decidir cuando se
implemente):

- **Opción A (recomendada):** copiar/sincronizar la hoja `servicios` relevante
  hacia una pestaña del MISMO spreadsheet de MT/PMI (AppSheet solo puede referenciar
  hojas de una fuente de datos a la vez fácilmente si están en el mismo archivo).
  El backend ya tiene la lógica de lectura de Sheets lista para hacer este espejo.
- **Opción B:** agregar la BD central como una segunda fuente de datos en la misma
  app de AppSheet (AppSheet soporta múltiples fuentes desde 2023). Más simple de
  configurar pero depende de que el plan de AppSheet lo permita.

## 3. Configurar el botón "Finalizado" en AppSheet (paso a paso, lo haces tú)

Esto se configura DENTRO de cada app de AppSheet — no se puede hacer por API/código.
Repetir estos pasos en la app de MT, luego en la de PMI, luego en cada técnica nueva.

1. Abre la app en [app.appsheet.com](https://app.appsheet.com) → editor.
2. **Data** → selecciona la tabla de la hoja general (ej. `2.general_particulas_magneticas`)
   → pestaña **Columns**.
3. Verifica/crea las 3 columnas de la sección 1 si no existen (`id_servicio`,
   `fecha_inicio`, `fecha_fin`, `finalizado`):
   - `fecha_inicio`: tipo **DateTime**, con Initial value = `NOW()` (así se llena sola
     al crear la fila).
   - `fecha_fin`: tipo **DateTime**, sin initial value (la llena la acción).
   - `finalizado`: tipo **Yes/No**, Initial value = `FALSE`.
4. **Behavior** → **Actions** → **New Action**:
   - Nombre: `Finalizar informe`
   - Tabla: la hoja general
   - Tipo: **Data: set the values of some columns in this row**
   - Set columns:
     - `finalizado` = `TRUE`
     - `fecha_fin` = `NOW()`
   - Icon: elige uno claro (ej. check verde).
   - **Condición de visibilidad** (importante): que solo aparezca si el informe
     no está ya finalizado — `NOT([finalizado])`.
5. **UX** → **Views** → la vista de detalle/formulario del inspector → agregar la
   acción `Finalizar informe` como botón visible (o como acción de sistema si
   prefieres que aparezca en la barra superior).
6. Prueba: abre un informe de prueba en la app (no en el navegador de escritorio,
   en el celular/tablet real que usa el inspector), llena datos, pulsa el botón,
   y verifica en el Sheet que `finalizado=TRUE` y `fecha_fin` tiene la hora correcta.

### Duración calculada

No hace falta que AppSheet calcule la duración — el backend la calcula al leer
`fecha_inicio`/`fecha_fin` (ver `sheets-db` hoja `servicios`, columna `duracion_min`).
Si se quiere ver también dentro de AppSheet, se puede agregar una columna virtual:
```
=IF(AND(ISNOTBLANK([fecha_inicio]), ISNOTBLANK([fecha_fin])),
    HOUR([fecha_fin]-[fecha_inicio])*60 + MINUTE([fecha_fin]-[fecha_inicio]),
    "")
```

---

## 4. Certificados por técnica y advertencias al generar reporte

Ya implementado en el backend de preview (`main.py`, función
`_tiene_certificado_para_tecnica`): al generar un reporte, el sistema busca en
`certificados_usuarios` (BD Sheets) si el inspector (identificado por nombre, con
match tolerante) tiene al menos un certificado con `tecnica` = la técnica del
reporte. Si no lo tiene, se muestra una advertencia **no bloqueante** en la webapp
(el reporte se genera igual, pero el supervisor ve el aviso).

Esto significa: **un certificado registrado sin `tecnica` no cuenta para nada** —
por eso el formulario de certificados (`/equipos`) ahora exige seleccionar la
técnica al crear cada certificado.

## 5. Equipos físicos de ensayo — PENDIENTE (fuera de alcance por ahora)

Se mencionó en la reunión que cada técnica debería tener su propio listado de
equipos (durómetros, gausímetros, etc.) y que el inspector solo debería
seleccionar el "serial ADC" (el identificador interno del activo). **Se decidió
dejar esto pendiente** — no se construye en esta fase. Cuando se retome, la forma
más consistente con lo ya construido sería una tabla `equipos_ensayo` en
`sheets-db` (columnas: `serial_adc`, `tecnica`, `descripcion`, `marca`, `modelo`,
`fecha_calibracion`, `fecha_vencimiento_calibracion`, `activo`), con la misma
lógica de advertencia que los certificados ("equipo con calibración vencida").

## 6. Resumen — qué se hizo YA vs qué falta

| Pieza | Estado |
|---|---|
| Tabla `servicios` en `sheets-db` (id_servicio, id_ot, tecnica, inspector, tiempos) | ✅ Hecho |
| Certificados vinculados a técnica (`certificados_usuarios.tecnica`) | ✅ Hecho |
| Advertencia de "inspector sin certificado" al generar reporte | ✅ Hecho |
| OT sin selección manual de supervisor/inspector | ✅ Hecho |
| Pestaña renombrada "Inspecciones" → "Reportes" | ✅ Hecho |
| Motor de reporte 570 (API 570 — Insp. Visual de Tubería), 15 secciones dinámicas + fotos | ✅ Hecho — no pasa por el modelo OT→Servicio, `ot` sigue siendo texto libre |
| Motor de reporte 510 (API 510 — Insp. Visual de Recipientes a Presión), 11 secciones + fotos en Sheet separado | ✅ Hecho — mismo criterio que 570 (no usa OT→Servicio) |
| Dashboard con datos reales, diferenciado por rol (admin/supervisor/inspector) | ✅ Hecho |
| Columnas `id_servicio`/`fecha_inicio`/`fecha_fin`/`finalizado` en los Sheets DE PRODUCCIÓN (MT, PMI, 570, 510) | ⏳ Pendiente — requiere autorización explícita para tocar esos Sheets |
| Botón "Finalizado" configurado en cada app de AppSheet | ⏳ Pendiente — se hace manualmente en la interfaz de AppSheet, ver sección 3 |
| Patrón "supervisor → ID de inspección" (`nombre_supervisor` Enum + `supervisor_filtro` + `Ref` filtrado, sección 1bis) | ⏳ Pendiente — documentado como estándar, falta configurarlo dentro de cada app de AppSheet (570/510 primero, luego MT/PMI si aplica) |
| Filtrado de AppSheet por `id_servicio` (Opción A o B, sección 2) | ⏳ Pendiente — depende de decidir cómo AppSheet accede a la hoja `servicios` |
| Cálculo real de `duracion_min` con datos reales | ⏳ Pendiente — depende de que las columnas de tiempo existan en producción |
| Equipos físicos de ensayo | ⏳ Pendiente — deprioritizado explícitamente |

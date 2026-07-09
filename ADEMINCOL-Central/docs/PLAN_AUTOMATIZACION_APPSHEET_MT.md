# Plan — Automatizar captura en AppSheet (piloto: MT / Partículas Magnéticas)

**Estado: PROPUESTA para revisar y confirmar — nada de esto se ha implementado.**
Este documento responde a la pregunta "¿cómo plantearías esto?" con datos reales del
Sheet de producción de MT (no supuestos). Extiende `ESTANDAR_COLUMNAS_APPSHEET.md`
(que ya cubre `id_informe/nombre_supervisor/id_servicio/fecha_inicio/fecha_fin/finalizado`
y el patrón de búsqueda supervisor→informe) con dos piezas nuevas que pediste ahora:
que `nombre` (inspector) sea lista con firma/certificado/fecha automáticos, y que el
equipo se seleccione por código ADC con el resto de datos autocompletado. Se eligió MT
como piloto porque es donde hay más columnas repetitivas manuales (ver Parte 3) y porque
`servicios.tecnica` ya soporta MT en el backend.

---

## 0. Un solo problema de fondo antes de las 3 automatizaciones

Las tres cosas que pides — autocompletar por supervisor (ya documentado), autocompletar
por inspector (nuevo), autocompletar por equipo (nuevo) — dependen de la MISMA pregunta
sin resolver, ya señalada en la sección 2 de `ESTANDAR_COLUMNAS_APPSHEET.md` pero solo
para `servicios`:

> **AppSheet, hoy, solo lee el spreadsheet de MT.** Las tablas que necesitas para
> autocompletar (`servicios`, `personal_certificados`, `equipos_ensayo`) viven en OTRO
> spreadsheet (nuestra BD central, `sheets-db`).

Antes de tocar una sola columna hay que decidir CÓMO le damos a AppSheet acceso a esas
3 tablas. Dos caminos, los mismos que ya proponía la sección 2 del estándar, aplicados
ahora a las 3 tablas en vez de solo a `servicios`:

| Opción | Cómo funciona | Pros | Contras |
|---|---|---|---|
| **A — Espejo (recomendada)** | Un job (backend, ya tenemos la lectura/escritura de Sheets lista) copia `servicios`, `personal_certificados` (filtrado a `tecnica=MT`) y `equipos_ensayo` (filtrado a `categoria=MT`) como pestañas nuevas DENTRO del spreadsheet de MT, refrescándolas cada N minutos o bajo demanda | AppSheet solo necesita configurarse una vez contra su propio spreadsheet; simple de razonar | Hay que decidir la frecuencia de refresco (los datos de certificados/equipos no cambian a cada minuto, así que un refresco manual o cada hora alcanza) |
| **B — Fuente de datos múltiple** | Agregar la BD central como una SEGUNDA fuente de datos dentro de la misma app de AppSheet | Datos siempre en vivo, sin job de sincronización | Depende de que el plan de AppSheet lo permita y de configurarlo tabla por tabla; más frágil si el plan cambia |

**Mi recomendación: Opción A**, reutilizando el mecanismo de lectura/escritura contra
Sheets que ya existe en el backend (`sheets_client.py`) — sería un endpoint o script
nuevo, no una automatización de AppSheet. Si confirmas esto, lo primero que se
construiría es ESE espejo, porque las 3 partes de abajo dependen de él.

---

## 1. Las 6 columnas estándar — estado real en MT hoy

Verificado contra el Sheet real (`2.general_particulas_magneticas`, 49 filas, 2026-07-09):

| Columna | ¿Existe en MT hoy? | Acción |
|---|---|---|
| `id_informe` | ✅ Sí | Ninguna |
| `nombre_supervisor` | ✅ Sí (y además `cod_supervisor`, que no está en el estándar — ver pregunta abajo) | Configurar como Enum buscable (sección 1bis del estándar) — hoy es texto libre |
| `id_servicio` | ❌ No | Agregar columna. Requiere la Opción A/B de la sección 0 |
| `fecha_inicio` | ❌ No | Agregar columna, `Initial value = NOW()` |
| `fecha_fin` | ❌ No | Agregar columna, la llena la acción "Finalizar informe" |
| `finalizado` | ❌ No | Agregar columna tipo Yes/No, `Initial value = FALSE` |

El paso a paso de AppSheet para las 4 columnas nuevas y el botón "Finalizado" ya está
escrito en `ESTANDAR_COLUMNAS_APPSHEET.md`, secciones 1, 1bis y 3 — no se repite aquí.
Lo único nuevo de esta parte es que ahora sí se aplicaría (antes estaba "documentado,
no construido" por decisión explícita, ver D16).

**Pregunta abierta:** `cod_supervisor` ya existe en MT y no está en el estándar. ¿Es un
código interno (tipo el `serial_adc` de equipos) que ya usan para identificar
supervisores, y deberíamos usarlo como la clave real del Ref en vez de `nombre_supervisor`
(los nombres tienen el mismo problema de variantes que ves en la Parte 2)? Si sí, cambia
el diseño del Enum/Ref de supervisor también.

---

## 2. `nombre` (inspector) como lista + firma/certificado/fecha automáticos

**Estado (2026-07-09): decisión B1 confirmada por el usuario, datos ya preparados.**
Lo que sigue en esta sección queda como referencia de lo que se hizo; falta solo
configurar el lado AppSheet (Ref + derivadas, no se puede hacer por API):
- ✅ MT (`2.general_particulas_magneticas`) homogenizado: las 7 personas del roster de
  MT que tenían variantes (acentos, mayúsculas, nombre corto/completo) ahora tienen UNA
  sola forma, igual a `personal_certificados`. Quedaron sin tocar (a propósito, no están
  en el roster certificado de MT — ver 2.1) 4 nombres: `César Fernando Hernández
  Pinilla`, `Diego Alejandro Hernandez Blanco` (dato de prueba del admin), `Karen
  Adriana Guaman Bravo` (9 filas) y `Nelson Leonardo Barrera` (4 filas) — estos dos
  últimos con bastante volumen de datos reales, vale la pena revisar por qué no tienen
  certificado de MT registrado.
- ✅ 3 personas (`Alejandro Alzate`, `Milton Pamplona`, `Sergio Fajardo`) tenían en MT un
  nombre MÁS COMPLETO que en el roster — se actualizó el roster a la versión completa
  (`Alejandro Alzate Suarez`, `Milton Augusto Pamplona Soler`, `Sergio Alejandro Fajardo
  Salamanca`) en vez de truncar los datos de producción.
- ✅ Columna `firma_link` agregada a `personal_certificados` (y a `CrearHojasBD.gs`).
  Rellenada por backfill desde el `firma_link` más reciente que cada persona ya tenía en
  el histórico de MT: **7 de 33 personas del roster de MT quedaron con firma** (las que
  ya habían hecho al menos una inspección de MT con firma capturada). Las otras 26 no
  tienen firma todavía — necesitan capturarla la primera vez (ver siguiente paso).
- ⏳ Pendiente: la vista/acción en AppSheet para que las 26 personas restantes registren
  su firma una vez, y la configuración del Ref/derivadas en la columna `nombre` de MT
  (sección 2.4) — eso sí requiere entrar a la app de AppSheet, no se hace por código.

### 2.1 Por qué esto es más urgente de lo que parece

Los 18 valores únicos que tiene la columna `nombre` en MT hoy, para un número mucho menor
de inspectores reales:

```
ALEJANDRO ALZATE SUAREZ
Angie Katerine Rodriguez Riaño          Angie Katerine Rodríguez Riaño
Cesar Jhovanny Paez Chavez              Cesar Jhovanny Páez Chávez
Cesar Paez                              César Jhovanny Páez Chávez
DIEGO ALEJANDRO HERNANDEZ BLANCO        Diego Alejandro Hernandez Blanco
Karen Adriana Guaman Bravo              Karen adriana Guaman Bravo
Nelson Leonardo Barrera                 Nelson Leonardo Barrera Díaz
Sergio Alejandro Fajardo Salamanca      Sergio Fajardo
```

Una sola persona (Cesar/César Paez/Chavez/Chávez) aparece escrita de **4 formas
distintas**. Esto no es solo un problema estético: es la razón por la que el backend
tuvo que construir un "match tolerante" (`_normalizar_nombre` + comparación por
palabras) para `_buscar_firma_usuario()` y `_tiene_certificado_para_tecnica()` en vez
de un cruce exacto — y aun así puede fallar (ver Nelson Barrera vs Nelson Barrera Díaz,
donde ninguna palabra del apellido coincide). Convertir `nombre` en una lista cerrada
elimina el problema en la raíz: ya no se puede escribir un nombre nuevo a mano.

### 2.2 Fuente de la lista

`personal_certificados` (D17), filtrada a `tecnica = "MT"` y `estado = "VIGENTE"`, tiene
**33 personas** certificadas en MT — y ya contiene (con ortografía consistente) al menos
uno de los nombres que hoy aparece mal escrito en MT (`Cesar Jhovanny Paez Chavez`,
`Nelson Leonardo Barrera`, `Sergio Fajardo`). Es la fuente correcta: es "la fuente real
de verdad de RRHH" según la propia decisión D17, y a diferencia de `usuarios` (login de
la webapp) cubre a inspectores que NUNCA han iniciado sesión en la plataforma —dato
importante, ver 2.3.

### 2.3 El problema real: la firma

Revisé cuántos inspectores tienen cuenta en la webapp (`usuarios`, hoja BD): **cero.**
Los 5 usuarios reales que existen hoy son 3 supervisores + 2 administradores — ningún
inspector. El mecanismo de firma que ya funciona (D13: `firma_base64` capturado en el
perfil de la webapp, usado en PMI para el bloque "Revisado por" del supervisor) da por
hecho que la persona tiene login — y ningún inspector lo tiene.

Certificado y fecha son datos "estáticos" (no cambian por informe) y sí pueden salir
directo de `personal_certificados` sin más vuelta. La firma es distinta: es una imagen
que hay que capturar en algún momento. Tres formas de resolverlo, sin ganador obvio —
**necesito que elijas**:

| Opción | Cómo | Esfuerzo | Nota |
|---|---|---|---|
| **B1 — Agregar firma a `personal_certificados`** | Nueva columna `firma_link` en esa tabla; cada inspector la registra UNA vez (ej. una vista/formulario "Registrar mi firma" en la misma app de AppSheet, buscando su fila por `cc`) | Bajo — 1 columna nueva + 1 vista de AppSheet | Reutiliza la tabla que ya es la fuente de verdad; NO requiere que el inspector tenga login en la webapp |
| **B2 — Dar de alta a los inspectores como usuarios de la webapp** | Cada inspector obtiene login y captura su firma con el SignaturePad que ya existe (D13) | Medio — hay que crear ~33 cuentas y que cada quien entre una vez a firmar | Reutiliza 100% el mecanismo ya construido y probado, pero es más fricción para gente que hoy solo usa AppSheet, nunca la webapp |
| **B3 — Firma en vivo cada vez (statu quo)** | Dejar `firma`/`firma_link` como están hoy: columna tipo Signature nativa de AppSheet, el inspector firma en cada informe | Cero — ya funciona así | No es "automático", pero es defendible: una firma que se reutiliza sin que la persona la ponga en ese documento específico puede no ser lo que quieras para un documento formal firmado |

**Mi recomendación: B1.** Es la que menos fricción agrega (una columna + una vez por
persona) y sigue el mismo patrón de "fuente única en `personal_certificados`" que ya
estás usando para certificados y equipos. B3 (no cambiar nada) también es una respuesta
válida si prefieres que la firma siga siendo un acto deliberado por informe — dime cuál.

### 2.4 Diseño concreto de la columna (una vez resuelto 2.3)

En `2.general_particulas_magneticas`, columna `nombre`:

| Propiedad | Valor |
|---|---|
| Type | **Ref** (no Enum simple, porque necesitamos dereferenciar certificado/fecha/firma después) |
| Tabla referenciada | `personal_certificados` (espejo, ver sección 0) |
| Valid_if / filtro | `AND([tecnica]="MT", [estado]="VIGENTE")` |
| Input mode | Search |

Columnas derivadas (virtuales o fórmula, de solo lectura, se llenan solas al elegir
`nombre`):
- `certificado` = `[nombre].[numero_certificado]`
- `fecha` (vencimiento del certificado, si es lo que se quiere mostrar) = `[nombre].[fecha_vencimiento]`
- `firma_link` = `[nombre].[firma_link]` (si se elige B1) o se deja como está (si B3)

**Nota:** `fecha` en el Sheet de MT hoy es la fecha del reporte/firma (no la de
vencimiento del certificado) — al implementar esto hay que revisar si quieres AMBAS
cosas visibles (fecha del reporte sigue siendo `NOW()` o manual; fecha de vencimiento
del certificado sería una columna nueva, informativa, para que el supervisor la vea
sin tener que ir a buscarla).

---

## 3. Equipos — código ADC autocompleta el resto

### 3.1 El problema es más grande de lo que se ve a simple vista

MT no tiene "un" equipo por informe — tiene **5 conjuntos completos** de
marca/modelo/serie/fecha de calibración, todos como texto libre hoy:

| Rol del equipo | Columnas actuales en MT |
|---|---|
| Equipo de magnetización | `marca_equipo_magnetizacion`, `modelo_equipo_magnetizacion`, `serie_equipo_magnetizacion`, `fecha_calibracion_magnetizacion` |
| Gausímetro | `marca_gausimetro`, `modelo_gausimetro`, `serie_gausimetro`, `fecha_calibracion_gausimetro` |
| Luxómetro (luz visible) | `marca_luxometro_visible`, `modelo_luxometro_visible`, `serie_luxometro_visible`, `fecha_calibracion_lux_visible` |
| Luxómetro (luz UVA) | `marca_luxometro_uva`, `modelo_luxometro_uva`, `serie_luxometro_uva`, `fecha_calibracion_lux_uva` |
| Bloque de peso/calibración | `marca_bloque_peso`, `modelo_bloque_peso`, `serie_bloque_peso`, `fecha_calibracion_bloque_peso` |

(Hay además `codigo equipo` y `codigo_equipo` — dos columnas casi iguales, probablemente
una duplicada por error de captura en algún momento. Antes de tocar nada habría que
confirmar cuál es la real y cuál se puede dejar de usar.)

### 3.2 El bloqueo real: `equipos_ensayo` no distingue estos 5 roles

Revisé los datos reales de `equipos_ensayo` (D17) filtrados a `categoria = "MT"`: **solo
3 filas**, y las 3 con `equipo = "MT"` genérico (sin distinguir si es el yugo, el
gausímetro, el luxómetro o el bloque de peso):

```
EQ-0054 | MT | ADC852 | serie 3131
EQ-0055 | MT | ADC347 | serie H11H-J07876
EQ-0056 | MT | ADC1080 | serie 220700178
```

O sea: hoy no hay forma de que, al elegir un código ADC, el sistema sepa si ese equipo
es "el gausímetro" o "el bloque de peso" — la tabla no tiene esa información todavía.
**Esto bloquea la automatización tal como la planteas** hasta resolver una de estas dos
cosas — **necesito que elijas**:

| Opción | Cómo | Esfuerzo |
|---|---|---|
| **C1 — Agregar columna `rol_equipo` a `equipos_ensayo`** | Nueva columna con valores tipo `MAGNETIZACION`, `GAUSIMETRO`, `LUXOMETRO_VISIBLE`, `LUXOMETRO_UVA`, `BLOQUE_PESO` (además de `categoria=MT` que ya existe); cada uno de los 5 selects de ADC en el formulario de MT filtra por `AND(categoria="MT", rol_equipo="GAUSIMETRO")` etc. | Bajo si ya sabemos a qué rol corresponde cada uno de los 3 equipos que hay hoy — pero probablemente haga falta ampliar el inventario, porque 3 equipos no alcanzan para cubrir 5 roles distintos |
| **C2 — Un solo select de "equipo MT" sin distinguir rol** | Los 5 campos ADC comparten el mismo filtro (`categoria="MT"`), el inspector elige el mismo equipo o equipos distintos de la misma lista sin que el sistema valide que "esto es un gausímetro" | Cero cambios en `equipos_ensayo`, pero no resuelve el problema de fondo — el inspector podría seleccionar el bloque de peso donde va el gausímetro sin que nada lo avise |

**Mi recomendación: C1**, pero antes de construirlo hace falta que confirmes/completes
qué equipos físicos corresponden a cada uno de los 5 roles — probablemente el inventario
de 3 equipos "MT" está incompleto (¿el bloque de peso y los luxómetros son equipos
separados que faltan cargar, o están mezclados con otras categorías como `NOVOTEST`,
que sí parece ser marca de instrumentos de medición?).

### 3.3 Diseño concreto (una vez resuelto 3.2)

Por cada uno de los 5 roles, en `2.general_particulas_magneticas`:

| Propiedad | Valor |
|---|---|
| Nueva columna | ej. `serial_adc_gausimetro` (Type: **Ref** → `equipos_ensayo`, espejo) |
| Valid_if | `SELECT(equipos_ensayo[serial_adc], AND([categoria]="MT", [rol_equipo]="GAUSIMETRO", [activo]=TRUE))` |
| Reemplaza a | `marca_gausimetro`, `modelo_gausimetro` (pasan a ser de solo lectura, derivadas) |

Derivadas: `marca_gausimetro` = `[serial_adc_gausimetro].[equipo]`,
`serie_gausimetro` = `[serial_adc_gausimetro].[serie]`,
`fecha_calibracion_gausimetro` = `[serial_adc_gausimetro].[fecha_calibracion_calibracion]`.
Mismo patrón ×5 (magnetización, gausímetro, luxómetro visible, luxómetro UVA, bloque de
peso). Como beneficio adicional gratis: con esto también queda lista la advertencia de
"equipo con calibración vencida" que quedó pendiente en la sección 5 del estándar
(mismo patrón que la de certificado vencido, comparando `fecha_vencimiento_calibracion`
contra hoy).

---

## 4. Quién genera el "servicio" y denominación del reporte

### 4.1 "Que el supervisor haga el servicio" — esto ya existe, falta el último tramo

Confirmado en el backend (`POST /api/preview/servicios`, ya construido y probado): el
supervisor, desde una OT en la webapp, elige la técnica (hoy `MT` o `PMI`) y se crea un
`id_servicio` nuevo (`SRV-XXXXXXXX`) en la hoja `servicios` de nuestra BD, con
`inspector_usuario` vacío a propósito — el inspector se autoasigna después. **Esto ya
funciona tal cual lo planteas; no hay que rediseñarlo.**

Lo que falta es el ÚLTIMO tramo: que ese `id_servicio` sea seleccionable dentro de
AppSheet al momento de crear el informe en MT — eso es exactamente la columna
`id_servicio` de la Parte 1, y depende del espejo de la sección 0 (AppSheet necesita
leer la hoja `servicios`, filtrada a `tecnica="MT"` y `estado != "COMPLETADA"`, filtrada
además por el supervisor ya elegido — mismo patrón `Ref` + `Valid_if` de las otras
piezas de este documento).

### 4.2 Denominación del reporte (`reporte_n`)

Hoy es texto libre y se nota: en la muestra real de MT aparecen `"Prueba 1"`,
`"_MT_5"`, `"Reporte_MT_7"`, `"Anexo 2-MT-CAR-YUM-DR4538_OT26082987"` — cuatro
convenciones distintas conviviendo. La tabla `consecutivos_reportes` (D17) ya define el
patrón real que usa ADEMINCOL y ya tiene un ejemplo real para MT:
`R-ADC-7-MT-RMA-AB`. El objetivo (ya escrito como pendiente en D17, no construido) es
que el backend calcule `MAX(secuencia)+1` al generar el reporte y arme ese string solo.

Para el piloto de MT, esto se puede resolver en dos momentos distintos — **otra
decisión abierta**:
- **Al generar el reporte** (backend, en `_generar_bytes_mt`): el inspector sigue
  escribiendo lo que quiera en AppSheet, y el backend IGNORA ese texto y calcula el
  consecutivo real al momento de generar el .xlsx. Más simple, no toca AppSheet.
- **Al crear el informe en AppSheet**: se agrega una acción/fórmula que calcula el
  consecutivo apenas se abre el formulario, para que el inspector YA VEA el número real
  en el reporte impreso/PDF que a veces se comparte antes de pasar por la webapp. Más
  fiel a "que no se escriba a mano", pero requiere que AppSheet también vea
  `consecutivos_reportes` (mismo espejo de la sección 0) y que la fórmula de
  auto-incremento no genere colisiones si dos inspectores crean un informe casi al
  mismo tiempo (con Sheets como BD esto es un riesgo real, no teórico).

**Mi recomendación:** resolverlo en el backend primero (más simple, cero riesgo de
colisión, ya tenemos casi todo el código) y dejar la versión "visible en AppSheet desde
el día 1" para una segunda vuelta si de verdad hace falta verlo antes de generar el
reporte.

---

## 5. Orden de implementación propuesto (si confirmas las decisiones abiertas)

1. Resolver las 4 preguntas abiertas de este documento (secciones 0, 2.3, 3.2, 4.2).
2. Construir el espejo (Opción A de la sección 0) — sin esto, nada de lo demás funciona.
3. Agregar a `equipos_ensayo` la columna `rol_equipo` (si se confirma C1) y completar el
   inventario de equipos de MT que falten.
4. Agregar a `personal_certificados` la columna `firma_link` (si se confirma B1) + la
   vista de AppSheet para que cada inspector la registre una vez.
5. Configurar en la app de MT de AppSheet, en este orden: las 4 columnas nuevas de la
   Parte 1 + botón Finalizado (ya documentado, ejecutar el paso a paso existente) →
   `nombre` como Ref con derivadas (Parte 2) → los 5 Ref de equipos con derivadas (Parte 3)
   → `id_servicio` como Ref filtrado por servicio+supervisor (Parte 4.1).
6. Probar con un informe real de punta a punta en el celular/tablet que usa un inspector
   de verdad, no solo en el editor de AppSheet de escritorio.
7. Si todo funciona en MT, replicar el mismo patrón en PMI (la "prueba piloto" original)
   y luego en las demás técnicas.

## 6. Resumen de lo que necesito que confirmes

1. **Sección 0**: ¿Opción A (espejo) o B (fuente múltiple) para que AppSheet vea
   `servicios`/`personal_certificados`/`equipos_ensayo`?
2. **Sección 1**: ¿`cod_supervisor` es una clave interna que deberíamos usar en vez de
   `nombre_supervisor`?
3. ~~**Sección 2.3**~~ — **Confirmado B1 y ya ejecutado** (2026-07-09): nombres
   homogenizados en MT, columna `firma_link` agregada y con backfill en
   `personal_certificados`. Ver detalle al inicio de la sección 2.
4. **Sección 3.2**: ¿C1 (agregar `rol_equipo` a `equipos_ensayo` y completar el
   inventario de MT) o C2 (un solo select sin distinguir rol)?
5. **Sección 4.2**: ¿calcular el consecutivo del reporte en el backend (recomendado) o
   también visible en vivo dentro de AppSheet?

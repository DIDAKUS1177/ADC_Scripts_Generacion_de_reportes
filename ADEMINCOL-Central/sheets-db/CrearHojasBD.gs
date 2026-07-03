/**
 * ===========================================================================
 * CREADOR DE ESTRUCTURA — BD TEMPORAL EN GOOGLE SHEETS (para AppSheet)
 * ===========================================================================
 * Crea (o repara) las hojas `usuarios` y `work_orders` con las MISMAS
 * columnas que tendrá la tabla real en PostgreSQL (ver
 * ADEMINCOL-Central/docs/01_BASE_DE_DATOS.md). Así, cuando migremos a
 * Postgres, el mapeo columna→columna es literal, sin traducción.
 *
 * Cómo usar:
 * 1. Crear un Google Sheet nuevo (o usar uno existente), nombrarlo por
 *    ejemplo "ADEMINCOL_BD_Central".
 * 2. Extensiones → Apps Script → pegar este archivo completo.
 * 3. Guardar y ejecutar la función `crearEstructuraBD` una vez (te pedirá
 *    autorización). Verás un menú "⚙️ BD Central" en la hoja.
 * 4. Conectar este Sheet a AppSheet (app.appsheet.com → Create → From
 *    spreadsheet) para tener la interfaz de captura de usuarios y OTs.
 * 5. En AppSheet, configurar la columna `firma` de tipo "Signature" —
 *    AppSheet la guarda como imagen en Drive automáticamente y en la fila
 *    queda el link (igual patrón que `firma_link` en el Sheet de MT).
 *
 * IMPORTANTE — seguridad:
 * - La columna `password_hash` NUNCA debe llenarse con la contraseña en
 *   texto plano. Se llena desde el backend Python (ver
 *   ADEMINCOL-Central/sheets-db/hashear_password.py) al crear el usuario.
 * - No expongas la columna `password_hash` en las vistas de AppSheet que
 *   vean los supervisores/inspectores — solo el admin (o nadie, gestionar
 *   altas de usuario desde el backend).
 * ===========================================================================
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ BD Central')
    .addItem('Crear / reparar estructura', 'crearEstructuraBD')
    .addToUi();
}

const HOJA_USUARIOS = 'usuarios';
const HOJA_WORK_ORDERS = 'work_orders';
const HOJA_CERTIFICADOS = 'certificados_usuarios';
const HOJA_SERVICIOS = 'servicios';

// Columnas idénticas a docs/01_BASE_DE_DATOS.md — CREATE TABLE users / work_orders
const COLUMNAS_USUARIOS = [
  'id_usuario',       // texto único, ej. "U-001" (equivalente al SERIAL de Postgres)
  'nombre',
  'usuario',           // login, único
  'password_hash',     // NUNCA texto plano — ver hashear_password.py
  'correo',
  'rol',                // ADMINISTRADOR | SUPERVISOR | INSPECTOR
  'cargo',
  'certificado',
  'firma',              // columna tipo Signature en AppSheet
  'firma_link',         // AppSheet la llena solo al usar tipo Signature
  'activo',             // TRUE/FALSE
  'created_at',
];

// Columnas idénticas a docs/01_BASE_DE_DATOS.md — CREATE TABLE work_orders
// NOTA (2026-07-03, reunión con el jefe): el supervisor NO se selecciona al
// crear la OT — es siempre quien la crea (usuario autenticado). El inspector
// tampoco se selecciona a nivel de OT: se asigna por SERVICIO (ver
// COLUMNAS_SERVICIOS), porque una OT puede tener MT con un inspector y PMI
// con otro. Por eso 'inspector_usuario' se removió de aquí.
const COLUMNAS_WORK_ORDERS = [
  'id_ot',              // texto único, ej. "OT-2026-0142"
  'numero',
  'contrato',
  'cliente',
  'ubicacion',
  'supervisor_usuario', // FK textual → usuarios.usuario. SIEMPRE = quien crea la OT.
  'fecha_inicio',
  'fecha_fin',
  'estado',              // PENDIENTE | EN_CURSO | COMPLETADA | CANCELADA
  'descripcion',
  'observaciones',
  'created_at',
];

// Nueva tabla para múltiples certificados por usuario. Un certificado es
// SIEMPRE de una técnica específica (MT, PMI...) — no es un campo de texto
// libre genérico. Esto es lo que permite la advertencia "inspector sin
// certificado" al generar un reporte: se busca (usuario, técnica) exacto.
const COLUMNAS_CERTIFICADOS = [
  'id_certificado',     // texto único, ej. "CERT-001"
  'usuario',            // FK textual → usuarios.usuario
  'tecnica',             // MT | PMI | ... (ver TECNICAS_VALIDAS) — a qué técnica certifica
  'nombre_certificado', // ej. "MT Nivel II"
  'entidad_emisora',    // ej. "ASNT"
  'fecha_emision',      // YYYY-MM-DD
  'fecha_vencimiento',  // YYYY-MM-DD
  'link_pdf',           // link al documento escaneado (opcional)
  'created_at',
];

// Nueva tabla — decisión de la reunión del 2026-07-03: cuando un supervisor
// "genera servicio" para una OT, elige qué técnicas se van a ejecutar (hoy
// MT y PMI). Cada técnica seleccionada crea UN SERVICIO independiente con su
// propio id_servicio (alfanumérico libre, NO correlativo con id_ot) — así
// cada técnica tiene su propio estado, inspector asignado y tiempos, aunque
// pertenezcan a la misma OT. AppSheet filtra los formularios de captura por
// id_servicio (ver docs/ESTANDAR_COLUMNAS_APPSHEET.md).
const COLUMNAS_SERVICIOS = [
  'id_servicio',         // alfanumérico libre, ej. "SRV-8F3A2C1" (independiente de id_ot)
  'id_ot',                // FK textual → work_orders.id_ot
  'tecnica',               // MT | PMI | ... (ver TECNICAS_VALIDAS)
  'estado',                 // PENDIENTE | EN_CURSO | COMPLETADA | CANCELADA
  'inspector_usuario',      // FK textual → usuarios.usuario. Vacío hasta que el
                            // inspector se autoasigna en AppSheet (no lo elige el supervisor).
  'fecha_creacion',
  'fecha_inicio',           // la llena AppSheet cuando el inspector abre el formulario
  'fecha_fin',              // la llena AppSheet cuando el inspector marca "Finalizado"
  'duracion_min',           // calculado: fecha_fin - fecha_inicio, en minutos
  'id_informe_generado',    // FK opcional → id_informe (MT) / id_general (PMI) una vez vinculado
  'created_at',
];

const ROLES_VALIDOS = ['ADMINISTRADOR', 'SUPERVISOR', 'INSPECTOR'];
const ESTADOS_OT_VALIDOS = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'];
// Técnicas soportadas — deben coincidir con report_types del backend
// (ver ADEMINCOL-Central/backend/app/sheets_client.py). Se amplía a medida
// que se conectan más tipos de reporte (VT_SOLDADAS, UT_ESPESORES...).
const TECNICAS_VALIDAS = ['MT', 'PMI'];

function crearEstructuraBD() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const hojaUsuarios = _crearOReusarHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  _aplicarValidacionLista(hojaUsuarios, 'rol', COLUMNAS_USUARIOS, ROLES_VALIDOS);
  _aplicarValidacionCasilla(hojaUsuarios, 'activo', COLUMNAS_USUARIOS);

  const hojaOTs = _crearOReusarHoja(ss, HOJA_WORK_ORDERS, COLUMNAS_WORK_ORDERS);
  _aplicarValidacionLista(hojaOTs, 'estado', COLUMNAS_WORK_ORDERS, ESTADOS_OT_VALIDOS);

  const hojaCertificados = _crearOReusarHoja(ss, HOJA_CERTIFICADOS, COLUMNAS_CERTIFICADOS);
  _aplicarValidacionLista(hojaCertificados, 'tecnica', COLUMNAS_CERTIFICADOS, TECNICAS_VALIDAS);

  const hojaServicios = _crearOReusarHoja(ss, HOJA_SERVICIOS, COLUMNAS_SERVICIOS);
  _aplicarValidacionLista(hojaServicios, 'tecnica', COLUMNAS_SERVICIOS, TECNICAS_VALIDAS);
  _aplicarValidacionLista(hojaServicios, 'estado', COLUMNAS_SERVICIOS, ESTADOS_OT_VALIDOS);

  SpreadsheetApp.getUi().alert(
    '✅ Estructura lista',
    'Hojas "usuarios", "work_orders", "certificados_usuarios" y "servicios" ' +
      'creadas/verificadas.\n\n' +
      'Siguiente paso: conectar este Sheet a AppSheet y configurar la ' +
      'columna "firma" como tipo Signature.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

function _crearOReusarHoja(ss, nombre, columnas) {
  let hoja = ss.getSheetByName(nombre);
  if (!hoja) {
    hoja = ss.insertSheet(nombre);
  }
  const encabezadosActuales = hoja
    .getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1))
    .getValues()[0];
  const yaTieneEncabezados = encabezadosActuales.some((c) => c !== '');

  if (!yaTieneEncabezados) {
    hoja.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, columnas.length)
      .setFontWeight('bold')
      .setBackground('#dc2626')
      .setFontColor('#ffffff');
    hoja.autoResizeColumns(1, columnas.length);
  } else {
    _agregarColumnasFaltantes(hoja, encabezadosActuales, columnas);
  }
  return hoja;
}

/**
 * Migración segura: si la hoja YA existe con datos (ej. certificados_usuarios
 * antes de agregar la columna 'tecnica' el 2026-07-03), agrega al final las
 * columnas que falten SIN tocar ni reordenar las existentes. No borra nada.
 */
function _agregarColumnasFaltantes(hoja, encabezadosActuales, columnasEsperadas) {
  const actuales = encabezadosActuales.map((h) => String(h).trim());
  const faltantes = columnasEsperadas.filter((c) => actuales.indexOf(c) === -1);
  if (faltantes.length === 0) return;

  const colInicio = hoja.getLastColumn() + 1;
  hoja.getRange(1, colInicio, 1, faltantes.length).setValues([faltantes]);
  hoja.getRange(1, colInicio, 1, faltantes.length)
    .setFontWeight('bold')
    .setBackground('#dc2626')
    .setFontColor('#ffffff');
  hoja.autoResizeColumns(colInicio, faltantes.length);
  Logger.log('Columnas agregadas a "' + hoja.getName() + '": ' + faltantes.join(', '));
}

/**
 * IMPORTANTE: busca la columna por su posición REAL en la hoja (leyendo los
 * encabezados actuales), NO por su posición en el arreglo COLUMNAS_* ideal.
 * Si una columna se agregó después por migración (_agregarColumnasFaltantes),
 * puede terminar en una posición distinta a la del arreglo — usar el índice
 * del arreglo aplicaría la validación a la columna equivocada.
 */
function _colIndexReal(hoja, nombreColumna) {
  const encabezados = hoja
    .getRange(1, 1, 1, Math.max(hoja.getLastColumn(), 1))
    .getValues()[0]
    .map((h) => String(h).trim());
  return encabezados.indexOf(nombreColumna) + 1; // 1-indexado, 0 si no existe
}

function _aplicarValidacionLista(hoja, nombreColumna, _columnasIgnorado, valores) {
  const col = _colIndexReal(hoja, nombreColumna);
  if (col === 0) return;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(valores, true)
    .setAllowInvalid(false)
    .build();
  hoja.getRange(2, col, 999, 1).setDataValidation(rule);
}

function _aplicarValidacionCasilla(hoja, nombreColumna, _columnasIgnorado) {
  const col = _colIndexReal(hoja, nombreColumna);
  if (col === 0) return;
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  hoja.getRange(2, col, 999, 1).setDataValidation(rule);
}

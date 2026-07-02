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
const COLUMNAS_WORK_ORDERS = [
  'id_ot',              // texto único, ej. "OT-2026-0142"
  'numero',
  'contrato',
  'cliente',
  'ubicacion',
  'supervisor_usuario', // FK textual → usuarios.usuario (no id numérico, es Sheets)
  'inspector_usuario',  // FK textual → usuarios.usuario
  'fecha_inicio',
  'fecha_fin',
  'estado',              // PENDIENTE | EN_CURSO | COMPLETADA | CANCELADA
  'descripcion',
  'observaciones',
  'created_at',
];

const ROLES_VALIDOS = ['ADMINISTRADOR', 'SUPERVISOR', 'INSPECTOR'];
const ESTADOS_OT_VALIDOS = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'];

function crearEstructuraBD() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const hojaUsuarios = _crearOReusarHoja(ss, HOJA_USUARIOS, COLUMNAS_USUARIOS);
  _aplicarValidacionLista(hojaUsuarios, 'rol', COLUMNAS_USUARIOS, ROLES_VALIDOS);
  _aplicarValidacionCasilla(hojaUsuarios, 'activo', COLUMNAS_USUARIOS);

  const hojaOTs = _crearOReusarHoja(ss, HOJA_WORK_ORDERS, COLUMNAS_WORK_ORDERS);
  _aplicarValidacionLista(hojaOTs, 'estado', COLUMNAS_WORK_ORDERS, ESTADOS_OT_VALIDOS);

  SpreadsheetApp.getUi().alert(
    '✅ Estructura lista',
    'Hojas "usuarios" y "work_orders" creadas/verificadas.\n\n' +
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
  }
  return hoja;
}

function _colIndex(columnas, nombreColumna) {
  return columnas.indexOf(nombreColumna) + 1; // 1-indexado para Sheets
}

function _aplicarValidacionLista(hoja, nombreColumna, columnas, valores) {
  const col = _colIndex(columnas, nombreColumna);
  if (col === 0) return;
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(valores, true)
    .setAllowInvalid(false)
    .build();
  hoja.getRange(2, col, 999, 1).setDataValidation(rule);
}

function _aplicarValidacionCasilla(hoja, nombreColumna, columnas) {
  const col = _colIndex(columnas, nombreColumna);
  if (col === 0) return;
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  hoja.getRange(2, col, 999, 1).setDataValidation(rule);
}

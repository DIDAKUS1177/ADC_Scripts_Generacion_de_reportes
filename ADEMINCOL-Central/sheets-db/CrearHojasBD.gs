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
const HOJA_EQUIPOS = 'equipos_ensayo';
const HOJA_PERSONAL_CERTIFICADOS = 'personal_certificados';
const HOJA_CONSECUTIVOS = 'consecutivos_reportes';

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

// Nueva tabla (2026-07-07) — importada desde PERSONAL_EQUIPO_CONSEC.xlsx.
// Inventario de equipos FÍSICOS de ensayo (durómetros, gausímetros,
// equipos PAUT, cámaras termográficas, etc.), pendiente desde la reunión
// del 2026-07-03 ("respecto a equipos es importante que lo dejemos de
// pendiente" — ver decisión D12 y sección 5 de ESTANDAR_COLUMNAS_APPSHEET.md,
// ahora sí se construye). El inspector en AppSheet solo debe seleccionar
// `serial_adc` (el identificador interno), nunca la serie de fábrica.
// A diferencia del Excel original (una columna de fecha de calibración POR
// AÑO — 2024/2025/2026 — que obliga a agregar una columna nueva cada año),
// aquí se usan DOS columnas fijas que se van actualizando: la última
// calibración hecha y su vencimiento. Así el supervisor solo necesita
// "actualizar la fecha" cuando recalibra, no agregar columnas cada año.
const COLUMNAS_EQUIPOS = [
  'id_equipo',                      // texto único, ej. "EQ-0001"
  'categoria',                      // tipo de equipo (ver CATEGORIAS_EQUIPO_VALIDAS)
  'equipo',                         // nombre/modelo comercial, ej. "MX2", "PAUT VEO3"
  'serie',                          // número de serie de fábrica
  'serial_adc',                     // identificador interno ADC — ÚNICO dato que
                                     // selecciona el inspector en AppSheet, ej. "ADC131"
  'fecha_calibracion',              // última calibración realizada
  'fecha_vencimiento_calibracion',  // próxima calibración / vencimiento
  'activo',                         // TRUE/FALSE
  'observaciones',
  'created_at',
];

// Nueva tabla (2026-07-07) — roster MAESTRO de certificados de TODO el
// personal de ADEMINCOL (65 personas, 251 certificados, 29 técnicas en el
// Excel de origen), NO solo de quienes ya tienen usuario en la webapp.
// Se identifica por `cc` (cédula), no por `usuario` (login) — a
// diferencia de `certificados_usuarios`, que sigue existiendo para los
// certificados de usuarios YA REGISTRADOS en la plataforma (vinculados por
// login). Esta tabla es la fuente real de verdad de RRHH/certificaciones;
// `certificados_usuarios` puede eventualmente poblarse buscando aquí por
// nombre/cc con el mismo match tolerante que ya usa el backend
// (_buscar_firma_usuario / _tiene_certificado_para_tecnica en main.py) —
// ver docs/00_ARQUITECTURA.md decisión D17.
const COLUMNAS_PERSONAL_CERTIFICADOS = [
  'id_certificado',       // texto único — se usa el # certificado real si existe
  'nombre',
  'cc',                   // cédula — identifica a la persona (se repite entre filas)
  'numero_certificado',   // # certificado tal cual (puede repetirse entre personas)
  'tecnica',              // ver TECNICAS_PERSONAL_VALIDAS (lista amplia, no solo
                           // las técnicas con reporte ya construido en la webapp)
  'nivel',                // I | II | III (opcional)
  'fecha_emision',
  'fecha_vencimiento',
  'estado',               // VIGENTE | VENCIDA — se recalcula en el backend a partir
                           // de fecha_vencimiento; se guarda aquí solo para la
                           // importación inicial desde el Excel de origen
  'created_at',
  'firma_link',           // NUEVA (2026-07-09, decisión B1 de
                           // PLAN_AUTOMATIZACION_APPSHEET_MT.md sección 2.3): URL de
                           // origen de la firma (histórico, de dónde se sacó
                           // firma_base64 — ver abajo). Ya NO es el campo que se lee
                           // para mostrar/insertar la firma (ver decisión de
                           // almacenamiento de imágenes, 2026-07-09): un link de
                           // AppSheet puede vencer o 404 en cualquier momento (pasó
                           // con 1 de 7 en el backfill inicial) — se conserva como
                           // referencia/auditoría, no como dato operativo.
  'firma_base64',         // NUEVA (2026-07-09, decisión de almacenamiento de
                           // imágenes): la firma real, como
                           // "data:image/png;base64,...", igual patrón que
                           // usuarios.firma_base64 (D8) — pero aquí cubre también a
                           // personal SIN login en la webapp. Firmas (chicas, una
                           // por persona) se guardan como base64 directo, sin
                           // depender de un link externo que haya que resolver;
                           // fotos de inspección (grandes, muchas por informe,
                           // capturadas por AppSheet en campo) siguen en Drive vía
                           // los links de AppSheet — ahí sí hace falta la función de
                           // descarga (image_utils.descargar_imagen), es la única
                           // forma de capturarlas hoy. IMPORTANTE: `cc` se repite
                           // por persona (una fila por técnica certificada) — si se
                           // llena/edita a mano, replicar el mismo valor en TODAS
                           // las filas de esa persona.
];

// Nueva tabla (2026-07-07) — consecutivo GLOBAL de números de reporte, para
// que los campos "Reporte N" / "N_Reporte" / "consecutivo" que ya existen en
// MT, PMI, 570 y 510 salgan de una sola fuente (en vez de que cada inspector
// escriba lo que quiera). `secuencia` es el contador real (autoincremental);
// `consecutivo` es el texto final con el mismo patrón que ya usa ADEMINCOL:
// "R-ADC-{secuencia}-{TECNICA}-{ABV_CLIENTE}-{INICIALES_RESPONSABLE}".
const COLUMNAS_CONSECUTIVOS = [
  'secuencia',                // número entero autoincremental — LA CLAVE real
  'consecutivo',              // texto generado, ej. "R-ADC-22-MT-CENIT-DH"
  'tecnica',
  'cliente',
  'abv_cliente',              // abreviatura corta del cliente (para el consecutivo)
  'alcance',                  // descripción del alcance (línea, equipo, etc.)
  'abv_alcance',
  'fecha_ejecucion',
  'fecha_entrega_reporte',
  'dias',                     // días entre ejecución y entrega (informativo)
  'responsable',
  'iniciales_responsable',    // ej. "DH" — se usan en el consecutivo
  'comentarios',
  'created_at',
];

const CATEGORIAS_EQUIPO_VALIDAS = [
  'Espesores', 'NOVOTEST', 'Crawler', 'PAUT_SCANC', 'PAUT VEO3', 'MX2',
  'REDDY-32', 'PCM', 'GWT', 'PINTURA', 'CMAT', 'MT', 'ACFM', 'PT',
];

// Lista amplia de técnicas de CERTIFICACIÓN de personal — NO confundir con
// TECNICAS_VALIDAS (las técnicas con motor de reporte ya construido en la
// webapp). Una persona puede estar certificada en técnicas que todavía no
// tienen reporte automatizado (ej. API 653, CWI, TOFD).
const TECNICAS_PERSONAL_VALIDAS = [
  'ACFM', 'ACOSEND', 'API 510', 'API 570', 'API 580', 'API 653', 'CIP',
  'CP1', 'CP2', 'CWI', 'DRONE', 'ECA', 'ET', 'GWT', 'LEAK TESTING PH',
  'MFL', 'MT', 'PAUT', 'PT', 'RHINO', 'SCWI', 'TERMOGRAFIA', 'TFM',
  'TOFD', 'UT', 'UT-ME', 'UTPA', 'VT', 'X7',
];
const ESTADOS_CERTIFICADO_VALIDOS = ['VIGENTE', 'VENCIDA'];

const ROLES_VALIDOS = ['ADMINISTRADOR', 'SUPERVISOR', 'INSPECTOR'];
const ESTADOS_OT_VALIDOS = ['PENDIENTE', 'EN_CURSO', 'COMPLETADA', 'CANCELADA'];
// Técnicas soportadas — deben coincidir con report_types del backend
// (ver ADEMINCOL-Central/backend/app/sheets_client.py). Se amplía a medida
// que se conectan más tipos de reporte (VT_SOLDADAS, UT_ESPESORES...).
// '570' (API 570 - Inspección Visual de Tubería) NO usa el modelo OT/Servicio
// (su Sheet propio ya trae `ot` como texto libre, nunca fue una FK — ver
// decisión 2026-07-03). Está aquí solo para que los certificados de
// inspectores puedan marcarse como '570'.
const TECNICAS_VALIDAS = ['MT', 'PMI', '570', '510'];

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

  const hojaEquipos = _crearOReusarHoja(ss, HOJA_EQUIPOS, COLUMNAS_EQUIPOS);
  _aplicarValidacionLista(hojaEquipos, 'categoria', COLUMNAS_EQUIPOS, CATEGORIAS_EQUIPO_VALIDAS);
  _aplicarValidacionCasilla(hojaEquipos, 'activo', COLUMNAS_EQUIPOS);

  const hojaPersonalCert = _crearOReusarHoja(ss, HOJA_PERSONAL_CERTIFICADOS, COLUMNAS_PERSONAL_CERTIFICADOS);
  _aplicarValidacionLista(hojaPersonalCert, 'tecnica', COLUMNAS_PERSONAL_CERTIFICADOS, TECNICAS_PERSONAL_VALIDAS);
  _aplicarValidacionLista(hojaPersonalCert, 'estado', COLUMNAS_PERSONAL_CERTIFICADOS, ESTADOS_CERTIFICADO_VALIDOS);

  const hojaConsecutivos = _crearOReusarHoja(ss, HOJA_CONSECUTIVOS, COLUMNAS_CONSECUTIVOS);
  _aplicarValidacionLista(hojaConsecutivos, 'tecnica', COLUMNAS_CONSECUTIVOS, TECNICAS_PERSONAL_VALIDAS);

  SpreadsheetApp.getUi().alert(
    '✅ Estructura lista',
    'Hojas "usuarios", "work_orders", "certificados_usuarios", "servicios", ' +
      '"equipos_ensayo", "personal_certificados" y "consecutivos_reportes" ' +
      'creadas/verificadas.\n\n' +
      'Siguiente paso: conectar este Sheet a AppSheet y configurar la ' +
      'columna "firma" como tipo Signature.\n\n' +
      'Los datos de PERSONAL_EQUIPO_CONSEC.xlsx (equipos, personal, ' +
      'consecutivos) se importan aparte, directo vía Python con el service ' +
      'account (mismo mecanismo que la migración de "servicios" del ' +
      '2026-07-03) — no hace falta ningún paso manual en Sheets.',
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

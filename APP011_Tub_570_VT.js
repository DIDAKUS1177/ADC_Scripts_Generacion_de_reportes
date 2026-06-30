/**
 * =================================================================
 * --- ARCHIVO: Reporte_API570_Encadenado.gs ---
 * =================================================================
 * SOLUCIÓN AL TIMEOUT CON FOTOS MASIVAS:
 *
 * El problema: un reporte con cientos de fotos hace que el trigger
 * dure más de 30 min (límite duro de Google Apps Script).
 *
 * La solución: separar datos y fotos en dos loops independientes.
 *   - LOOP 1 (datos): procesa todas las secciones de texto rápido.
 *   - LOOP 2 (fotos): procesa 1 SECCIÓN por trigger. Al terminar
 *     esa sección, se agenda a sí mismo para la siguiente.
 *     Sin límite de iteraciones. Sin timeout posible.
 *
 * Cada trigger de fotos dura máximo ~2 min (una sección con muchas
 * fotos). Google permite triggers cada 1 segundo. No hay techo.
 * =================================================================
 */

// =================================================================
// --- CONFIGURACIÓN PRINCIPAL ---
// =================================================================
const ID_BD_GENERAL = SpreadsheetApp.getActiveSpreadsheet().getId();
const ID_PLANTILLA = ID_BD_GENERAL;
const NOMBRE_CARPETA_RAIZ_REPORTES = "REPORTES_VT_570";
const NOMBRE_HOJA_FORMATO = "formato570";
const NOMBRE_HOJA_ACTIVADORA = "#1_informaciongeneral";
const COLUMNA_PVID = "id_api570";
const COLUMNA_ACTIVADORA = "GenerarReporteTrigger";
const COLUMNA_LINK_REPORTE = "LinkReporte";

const MAPEO_DE_CELDAS = {
    'cliente': 'I8', 'consecutivo': 'V8', 'fecha': 'AI8', 'ubicacion': 'AV8',
    'ot': 'I10', 'servicio': 'V10', 'codigo_fabricacion': 'AI10', 'ano_fabricacion': 'AV10',
    'sistema': 'I12', 'subsistema': 'V12', 'presion_operacion': 'AI12', 'temperatura_operacion': 'AV12'
};

// =================================================================
// --- CONFIGURACIÓN DE SECCIONES (15 secciones) ---
// =================================================================
const SECTIONS_CONFIG = {
    coating: {
        sheetName: '#2_recubrimiento',
        mapping: { 'segmento_linea': 'C17', 'cml_tml': 'F17', 'nps': 'H17', 'tipo_componente': 'J17', 'tipo_dano': 'O17', 'tipo_calidad': 'S17', 'area_reparacion': 'W17', 'observaciones_recubrimiento': 'AB17' },
        dataStartRow: 17,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#2_recubrimiento_photos', photoLinkColumnName: 'photo_url', photoCells: ['C21', 'P21', 'AC21', 'AP21'], descCells: ['C22', 'P22', 'AC22', 'AP22'] }
    },
    interfaces: {
        sheetName: '#3_interfases_2',
        mapping: { 'segmento_linea_interfase': 'C27', 'cml_tml_interfase': 'F27', 'nps_interfase': 'H27', 'tipo_componente_interfase': 'J27', 'estado_recubrimiento': 'O27', 'observaciones_interfase': 'W27' },
        dataStartRow: 27,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#3_interfasesueloairepenetraciondeparedes_photos', photoLinkColumnName: 'photo_url', photoCells: ['C31', 'P31', 'AC31', 'AP31'], descCells: ['C32', 'P32', 'AC32', 'AP32'] }
    },
    supports: {
        sheetName: '#4_soportes',
        mapping: { 'segmento_linea_soporte': 'C37', 'cml_tml_soporte': 'F37', 'nps_soporte': 'H37', 'tipo_componente_soporte': 'J37', 'id_soporte': 'M37', 'tipo_soporte': 'O37', 'anclaje_soporte': 'R37', 'accesorio_soporte': 'U37', 'aislamiento_soporte': 'X37', 'contacto_soporte': 'AA37', 'estado_recubrimiento_soporte': 'AD37', 'estado_concreto_soporte': 'AG37', 'ausencia_partes_soporte': 'AJ37', 'desajuste_partes_soporte': 'AM37', 'corrosion_soporte': 'AP37', 'deformacion_soporte': 'AS37', 'observaciones_soporte': 'AV37' },
        dataStartRow: 37,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#4_soportes_photos', photoLinkColumnName: 'photo_url', photoCells: ['C41', 'P41', 'AC41', 'AP41'], descCells: ['C42', 'P42', 'AC42', 'AP42'] }
    },
    vibration: {
        sheetName: '#5_vibracion',
        mapping: { 'segmento_linea_vibracion': 'C47', 'cml_tml_vibracion': 'F47', 'nps_vibracion': 'H47', 'tipo_componente_vibracion': 'J47', 'condicion_vibracion': 'O47', 'fuente_vibracion': 'S47', 'punto_friccion': 'X47', 'observaciones_vibracion': 'AC47' },
        dataStartRow: 47,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#5_vibracion_photos', photoLinkColumnName: 'photo_url', photoCells: ['C51', 'P51', 'AC51', 'AP51'], descCells: ['C52', 'P52', 'AC52', 'AP52'] }
    },
    deadLegs: {
        sheetName: '#6_piernasmuertas',
        mapping: { 'segmento_linea_pm': 'C57', 'cml_tml_pm': 'F57', 'nps_pm': 'H57', 'tipo_componente_pm': 'J57', 'id_pierna_muerta': 'O57', 'longitud_pierna_muerta': 'R57', 'posicion_pierna_muerta': 'V57', 'observaciones_pm': 'Z57' },
        dataStartRow: 57,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#6_piernasmuertas_photos', photoLinkColumnName: 'photo_url', photoCells: ['C61', 'P61', 'AC61', 'AP61'], descCells: ['C62', 'P62', 'AC62', 'AP62'] }
    },
    reliefDevices: {
        sheetName: '#7_dispositivos',
        mapping: { 'segmento_linea_disp_alivio': 'C67', 'cml_tml_disp_alivio': 'F67', 'tag_disp_alivio': 'H67', 'marca_disp_alivio': 'K67', 'modelo_disp_alivio': 'N67', 'serial_disp_alivio': 'Q67', 'tamano_entrada_disp_alivio': 'T67', 'tamano_salida_disp_alivio': 'W67', 'fecha_calibracion_disp_alivio': 'Z67', 'presion_calibracion_disp_alivio': 'AC67', 'fugas_bridas_pernos': 'AF67', 'danos_recubrimiento_disp_alivio': 'AI67', 'seguridad_pernos_bridas': 'AL67', 'precintos_valvulas_corte': 'AP67', 'observaciones_disp_alivio': 'AU67' },
        dataStartRow: 67,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#7_dispositivosdealiviodepresion_photos', photoLinkColumnName: 'photo_url', photoCells: ['C71', 'P71', 'AC71', 'AP71'], descCells: ['C72', 'P72', 'AC72', 'AP72'] }
    },
    mechCorrosion: {
        sheetName: '#8_estadomecanicoycorrosion',
        mapping: { 'segmento_linea_emc': 'C77', 'cml_tml_emc': 'F77', 'nps_emc': 'H77', 'tipo_componente_emc': 'J77', 'condicion_emc': 'O77', 'observaciones_emc': 'V77' },
        dataStartRow: 77,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#8_estadomecanicoycorrosion_photos', photoLinkColumnName: 'photo_url', photoCells: ['C81', 'P81', 'AC81', 'AP81'], descCells: ['C82', 'P82', 'AC82', 'AP82'] }
    },
    flangeJoints: {
        sheetName: '#9_unionesbridadas',
        mapping: { 'segmento_linea_brida': 'C87', 'cml_tml_brida': 'F87', 'nps_brida': 'H87', 'tipo_componente_brida': 'J87', 'tipo_brida': 'O87', 'rating_class_brida': 'R87', 'tipo_cara_brida': 'U87', 'llenado_tuerca_brida': 'X87', 'estado_recubrimiento_brida': 'AA87', 'presenta_fugas_brida': 'AE87', 'presenta_junta_disimil': 'AH87', 'observaciones_brida': 'AK87' },
        dataStartRow: 87,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#9_unionesbridadas_photos', photoLinkColumnName: 'photo_url', photoCells: ['C91', 'P91', 'AC91', 'AP91'], descCells: ['C92', 'P92', 'AC92', 'AP92'] }
    },
    valves: {
        sheetName: '#10_valvulas',
        mapping: { 'segmento_linea_valvula': 'C97', 'cml_tml_valvula': 'F97', 'nps_valvula': 'H97', 'tipo_componente_valvula': 'J97', 'tipo_de_valvula': 'O97', 'material_cuerpo_valvula': 'R97', 'rating_class_valvula': 'U97', 'tipo_conexion_extremos': 'X97', 'condicion_sello_valvula': 'AA97', 'estado_recubrimiento_valvula': 'AD97', 'observaciones_valvula': 'AH97' },
        dataStartRow: 97,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#10_valvulasdecorteyunidireccionales_photos', photoLinkColumnName: 'photo_url', photoCells: ['C101', 'P101', 'AC101', 'AP101'], descCells: ['C102', 'P102', 'AC102', 'AP102'] }
    },
    instruments: {
        sheetName: '#11_instrumentos',
        mapping: { 'segmento_linea_instrumento': 'C107', 'cml_tml_instrumento': 'F107', 'nps_instrumento': 'H107', 'tipo_de_instrumento': 'J107', 'tag_instrumento': 'O107', 'observaciones_instrumento': 'S107' },
        dataStartRow: 107,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#11_instrumentos_photos', photoLinkColumnName: 'photo_url', photoCells: ['C111', 'P111', 'AC111', 'AP111'], descCells: ['C112', 'P112', 'AC112', 'AP112'] }
    },
    corrosionCoupons: {
        sheetName: '#12_cuponesdecorrosion',
        mapping: { 'segmento_linea_cupon': 'C117', 'cml_tml_cupon': 'F117', 'nps_cupon': 'H117', 'tipo_de_cupon': 'J117', 'tag_cupon': 'O117', 'observaciones_cupon': 'S117' },
        dataStartRow: 117,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#12_cuponesdecorrosion_photos', photoLinkColumnName: 'photo_url', photoCells: ['C121', 'P121', 'AC121', 'AP121'], descCells: ['C122', 'P122', 'AC122', 'AP122'] }
    },
    injectionPoints: {
        sheetName: '#13_puntosdeinyeccion',
        mapping: { 'segmento_linea_inyeccion': 'C127', 'cml_tml_inyeccion': 'F127', 'nps_inyeccion': 'H127', 'no_punto_inyeccion': 'J127', 'estado_mecanico_inyeccion': 'N127' },
        dataStartRow: 127,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#13_puntosdeinyeccion_photos', photoLinkColumnName: 'photo_url', photoCells: ['C131', 'P131', 'AC131', 'AP131'], descCells: ['C132', 'P132', 'AC132', 'AP132'] }
    },
    thermalInsulation: {
        sheetName: '#14_aislamientotermico',
        mapping: { 'segmento_linea_aislamiento': 'C137', 'cml_tml_aislamiento': 'F137', 'nps_aislamiento': 'H137', 'danos_perforaciones_aislamiento': 'J137', 'falta_recubrimiento_aislamiento': 'O137', 'deterioro_sellado_aislamiento': 'U137', 'abultamiento_aislamiento': 'Y137', 'cintas_rotas_faltantes': 'AC137', 'observaciones_aislamiento': 'AG137' },
        dataStartRow: 137,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#14_aislamientotermico_photos', photoLinkColumnName: 'photo_url', photoCells: ['C141', 'P141', 'AC141', 'AP141'], descCells: ['C142', 'P142', 'AC142', 'AP142'] }
    },
    corrosionExterna: {
        sheetName: '#15_corrocion_externa',
        mapping: { 'segmento_linea': 'C143', 'cml_tml': 'F143', 'nps': 'H143', 'fugas_superficie_externa': 'J143', 'aplastamientos_ovalidad': 'N143', 'estrias_hendiduras_cortes': 'R143', 'profundidad_estrias': 'V143', 'buena_fusion_uniones': 'Z143', 'contaminacion_uniones': 'AD143', 'grietas_agrietamiento_crazing': 'AH143', 'fugas_uniones_accesorios': 'AL143', 'observaciones': 'AP143' },
        dataStartRow: 143,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#15_corrocion_externa_photos', photoLinkColumnName: 'photo_url', photoCells: ['C151', 'P151', 'AC151', 'AP151'], descCells: ['C152', 'P152', 'AC152', 'AP152'] }
    },
    polimeros: {
        sheetName: '#16_polimeros',
        mapping: { 'tipo_componente': 'C157', 'presencia_ampollas': 'G157', 'diametro_blister': 'J157', 'longitud_microfisura': 'M157', 'perdida_resina': 'O157', 'aranazos_hendiduras': 'Q157', 'ancho_aranazo': 'T157', 'longitud_aranazo': 'V157', 'decoloracion_superficie': 'X157', 'color_decoloracion': 'Z157', 'grietas_fracturas': 'AB157', 'inclusiones': 'AD157', 'quemaduras': 'AF157', 'bordes_expuestos': 'AH157', 'delaminaciones': 'AK157', 'arrugas': 'AN157', 'observaciones_externas': 'AQ157' },
        dataStartRow: 157,
        photosConfig: { idColumnName: 'id_api570', photoSheetName: '#16_polimeros_photos', photoLinkColumnName: 'photo_url', photoCells: ['C161', 'P161', 'AC161', 'AP161'], descCells: ['C162', 'P162', 'AC162', 'AP162'] }
    }
};

// =================================================================
// --- CLAVES DE ESTADO EN PropertiesService ---
//
// LOOP DATOS  → procesa todo el texto de un reporte en lotes.
// LOOP FOTOS  → procesa UNA SECCIÓN de fotos por trigger,
//               luego agenda el siguiente trigger automáticamente.
//               Sin límite de iteraciones.
//
// P_QUEUE_IDS     : IDs de reportes pendientes en la cola general
// P_PVID          : ID del reporte que se está procesando ahora
// P_REPORTE_ID    : ID del Spreadsheet de destino
// P_CARPETA_ID    : ID de la carpeta del reporte
// P_NOMBRE        : nombre del reporte
// P_D_START       : índice de sección donde continúa el loop de datos
// P_D_FILAS       : filas acumuladas insertadas (para offset de secciones)
// P_D_KEYS        : JSON — claves de SECTIONS_CONFIG en orden
// P_F_SECTION_IDX : índice de sección en el loop de fotos
// P_F_FOTO_IDX    : índice de foto dentro de la sección actual
// P_F_BASE_ROWS   : JSON — mapa { sectionKey: basePhotoRow } calculado en loop datos
// =================================================================
const P_QUEUE_IDS = 'QUEUE_IDS';
const P_PVID = 'PVID';
const P_REPORTE_ID = 'REPORTE_ID';
const P_CARPETA_ID = 'CARPETA_ID';
const P_NOMBRE = 'NOMBRE';
const P_D_START = 'D_START';
const P_D_FILAS = 'D_FILAS';
const P_D_KEYS = 'D_KEYS';
const P_F_SECTION_IDX = 'F_SECTION_IDX';
const P_F_FOTO_IDX = 'F_FOTO_IDX';
const P_F_BASE_ROWS = 'F_BASE_ROWS';

// Secciones de DATOS por trigger (sin fotos, cabe perfectamente en <5 min)
const SECCIONES_DATOS_POR_LOTE = 15;

// Fotos por trigger en el loop de fotos.
// 100 fotos × ~2 seg = ~200 seg por trigger → muy por debajo de 30 min.
// Menos triggers totales. Cada foto está protegida individualmente,
// así que una imagen con error INTERNAL no tumba el chunk completo.
const FOTOS_POR_TRIGGER = 100;

// =================================================================
// --- MENÚ ---
// =================================================================
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Reportes AppSheet')
        .addItem('1. Generar Reporte Manual (Por ID)', 'mostrarPanelDeEntrada_Excel')
        .addItem('2. Generar Múltiples (Selector)', 'mostrarPanelSelector')
        .addItem('3. Generar Todos los Pendientes', 'generarTodosPendientes')
        .addSeparator()
        .addItem('Probar Acceso a BD', 'probarAccesoALasBasesDeDatos')
        .addItem('Limpiar Estado (Emergencia)', 'limpiarTodoElEstado')
        .addToUi();
}

// =================================================================
// --- ONEDIT ---
// =================================================================
function onEditTrigger(e) {
    const range = e.range;
    const sheet = range.getSheet();
    if (range.getRow() === 1) return;
    if (sheet.getName() !== NOMBRE_HOJA_ACTIVADORA) return;

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const triggerColIdx = headers.indexOf(COLUMNA_ACTIVADORA) + 1;
    const linkColIdx = headers.indexOf(COLUMNA_LINK_REPORTE) + 1;
    const pvIdColIdx = headers.indexOf(COLUMNA_PVID) + 1;

    if (range.getColumn() !== triggerColIdx) return;

    Utilities.sleep(1000);
    const val = (range.getValue() || '').toString().trim().toLowerCase();
    if (val !== 'yes' && val !== 'true') return;

    const pvId = sheet.getRange(range.getRow(), pvIdColIdx).getValue();
    if (!pvId) {
        if (linkColIdx > 0) sheet.getRange(range.getRow(), linkColIdx).setValue('ERROR: Falta ID');
        range.setValue('Error');
        return;
    }
    try {
        if (linkColIdx > 0) sheet.getRange(range.getRow(), linkColIdx).setValue('Generando...');
        iniciarCola([pvId.toString().trim()], false);
        range.setValue('No');
    } catch (err) {
        if (linkColIdx > 0) sheet.getRange(range.getRow(), linkColIdx).setValue(`ERROR: ${err.message}`);
        range.setValue('Error');
    }
}

// =================================================================
// --- UI ---
// =================================================================
function mostrarPanelDeEntrada_Excel() {
    const ui = SpreadsheetApp.getUi();
    const r = ui.prompt('Generar Reporte', `ID (${COLUMNA_PVID}):`, ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() == ui.Button.OK) {
        const v = r.getResponseText().trim();
        if (v) iniciarCola([v], true);
        else ui.alert('ID inválido.');
    }
}

function mostrarPanelSelector() {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: 'Segoe UI', sans-serif; padding: 15px; color: #333; }
    h2 { text-align: center; color: #1565c0; font-size: 18px; margin-top: 0; }
    .controls { display: flex; justify-content: space-between; margin-bottom: 10px; }
    .controls button { background: #e0e0e0; color: #333; border: none; padding: 5px 10px; cursor: pointer; border-radius: 4px; font-size: 12px; }
    .controls button:hover { background: #d5d5d5; }
    #list-container { max-height: 250px; overflow-y: auto; border: 1px solid #ccc; padding: 10px; border-radius: 5px; background: #fafafa; margin-bottom: 15px; }
    .item { display: flex; align-items: center; margin-bottom: 8px; font-size: 13px; }
    .item input { margin-right: 8px; cursor: pointer; width: 16px; height: 16px; }
    .badge { margin-left: auto; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; }
    .bg-pending { background-color: #ffebee; color: #c62828; }
    .bg-done    { background-color: #e8f5e9; color: #2e7d32; }
    #status-box { display: none; border: 2px solid #e0e0e0; border-radius: 8px; padding: 10px; background: #fff; margin-bottom: 15px; text-align: center; }
    #progress-text { font-size: 18px; font-weight: bold; color: #2e7d32; margin-bottom: 5px; }
    .btn-primary { width: 100%; background: #1976d2; color: white; border: none; padding: 12px; cursor: pointer; border-radius: 4px; font-size: 14px; font-weight: bold; transition: 0.3s; }
    .btn-primary:hover { background: #1565c0; }
    .loading { text-align: center; padding: 20px; font-style: italic; color: #666; }
  </style>
</head>
<body>
  <h2>🚀 Selector de Reportes VT</h2>
  <div id="selection-area">
    <div class="controls">
      <button onclick="seleccionar(true)">✔ Todos</button>
      <button onclick="seleccionar(false)">✖ Ninguno</button>
      <button onclick="seleccionarPendientes()">⏳ Pendientes</button>
    </div>
    <div id="list-container">
      <div class="loading">Cargando identificadores...</div>
    </div>
    <button class="btn-primary" onclick="iniciarGeneracion()">Generar seleccionados</button>
  </div>
  <div id="status-box">
    <div id="progress-text">⏳ Procesando en segundo plano...</div>
  </div>
  <button id="btn-close" class="btn-primary" style="display:none;" onclick="google.script.host.close()">Cerrar ventana</button>
  <script>
    window.onload = function() {
      google.script.run
        .withSuccessHandler(renderList)
        .withFailureHandler(err => alert("Error: " + err.message))
        .obtenerListaReportes();
    };
    function renderList(data) {
      const container = document.getElementById('list-container');
      if (!data.length) { container.innerHTML = "<div class='loading'>No hay reportes.</div>"; return; }
      container.innerHTML = data.map(item => {
        const done = item.hasLink;
        const badge = done ? '<span class="badge bg-done">Listo</span>' : '<span class="badge bg-pending">Pendiente</span>';
        return '<label class="item"><input type="checkbox" class="chk-id" value="' + item.id + '" ' + (done ? '' : 'checked') + '><span>' + item.id + ' — ' + (item.cliente || '') + ' | OT: ' + (item.ot || '') + '</span>' + badge + '</label>';
      }).join('');
    }
    function seleccionar(estado) { document.querySelectorAll('.chk-id').forEach(c => c.checked = estado); }
    function seleccionarPendientes() { document.querySelectorAll('.chk-id').forEach(c => { c.checked = !c.parentElement.querySelector('.bg-done'); }); }
    function iniciarGeneracion() {
      const ids = Array.from(document.querySelectorAll('.chk-id:checked')).map(c => c.value);
      if (!ids.length) { alert("Selecciona al menos un ID."); return; }
      document.getElementById('selection-area').style.display = 'none';
      document.getElementById('status-box').style.display = 'block';
      google.script.run
        .withSuccessHandler(() => {
          document.getElementById('progress-text').innerText = "¡Cola iniciada!";
          document.getElementById('btn-close').style.display = 'block';
        })
        .withFailureHandler(err => alert("Error: " + err.message))
        .iniciarColaUI(ids);
    }
  </script>
</body>
</html>
  `;
    const htmlOutput = HtmlService.createHtmlOutput(htmlContent).setWidth(450).setHeight(550);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Gestor de Reportes VT');
}

function obtenerListaReportes() {
    const ss = SpreadsheetApp.openById(ID_BD_GENERAL);
    const hoja = ss.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
    const data = hoja.getDataRange().getValues();
    const h = data[0].map(v => typeof v === 'string' ? v.trim() : v);
    const iId = h.indexOf(COLUMNA_PVID);
    const iLnk = h.indexOf(COLUMNA_LINK_REPORTE);
    const iCli = h.indexOf('cliente');
    const iOt = h.indexOf('ot');
    return data.slice(1).filter(r => r[iId]).map(r => ({
        id: r[iId].toString().trim(),
        cliente: iCli !== -1 ? r[iCli] : '',
        ot: iOt !== -1 ? r[iOt] : '',
        hasLink: iLnk !== -1 && typeof r[iLnk] === 'string' && r[iLnk].startsWith('http')
    }));
}

function iniciarColaUI(ids) { iniciarCola(ids, true); }

function generarTodosPendientes() {
    const ui = SpreadsheetApp.getUi();
    const pendientes = obtenerListaReportes().filter(r => !r.hasLink).map(r => r.id);
    if (!pendientes.length) { ui.alert('No hay reportes pendientes.'); return; }
    const resp = ui.alert('Confirmar', `${pendientes.length} pendientes. ¿Iniciar?`, ui.ButtonSet.YES_NO);
    if (resp === ui.Button.YES) iniciarCola(pendientes, true);
}

// =================================================================
// --- CONTROLADOR CENTRAL DE COLA ---
// =================================================================
function iniciarCola(idsArray, mostrarAlerta = true) {
    if (!idsArray || !idsArray.length) return;
    limpiarTodoElEstado();

    const total = idsArray.length;
    const primero = idsArray.shift();
    const sp = PropertiesService.getScriptProperties();

    sp.setProperties({
        [P_QUEUE_IDS]: JSON.stringify(idsArray),
        [P_PVID]: primero,
        [P_REPORTE_ID]: '', [P_CARPETA_ID]: '', [P_NOMBRE]: '',
        [P_D_START]: '0', [P_D_FILAS]: '0', [P_D_KEYS]: '[]',
        [P_F_SECTION_IDX]: '0', [P_F_FOTO_IDX]: '0', [P_F_BASE_ROWS]: '{}'
    });

    agendarTrigger('loopDatosTrigger', 2000);

    if (mostrarAlerta) {
        SpreadsheetApp.getUi().alert(
            '✅ Proceso Iniciado',
            `${total} reporte(s) en cola.\n\n` +
            `• Loop 1 — Datos de texto (rápido)\n` +
            `• Loop 2 — Imágenes encadenadas (${FOTOS_POR_TRIGGER} fotos/trigger, sin límite de tiempo)\n\n` +
            `El link se actualizará en '${COLUMNA_LINK_REPORTE}' al completarse.`,
            SpreadsheetApp.getUi().ButtonSet.OK
        );
    }
}

function avanzarAlSiguienteReporte() {
    const sp = PropertiesService.getScriptProperties();
    const queue = JSON.parse(sp.getProperty(P_QUEUE_IDS) || '[]');
    if (!queue.length) {
        Logger.log('✅ Cola completada. Limpiando estado.');
        limpiarTodoElEstado();
        return;
    }
    const siguiente = queue.shift();
    sp.setProperties({
        [P_QUEUE_IDS]: JSON.stringify(queue),
        [P_PVID]: siguiente,
        [P_REPORTE_ID]: '', [P_CARPETA_ID]: '', [P_NOMBRE]: '',
        [P_D_START]: '0', [P_D_FILAS]: '0', [P_D_KEYS]: '[]',
        [P_F_SECTION_IDX]: '0', [P_F_FOTO_IDX]: '0', [P_F_BASE_ROWS]: '{}'
    });
    agendarTrigger('loopDatosTrigger', 3000);
    Logger.log(`→ Siguiente reporte: ${siguiente}`);
}

// =================================================================
// --- LOOP 1: DATOS (texto, sin imágenes) ---
// Procesa SECCIONES_DATOS_POR_LOTE secciones por trigger.
// Tan rápido que 15 secciones caben en < 3 minutos.
// Al terminar todas las secciones arranca el Loop 2 de fotos.
// =================================================================
function loopDatosTrigger() {
    borrarTriggers('loopDatosTrigger');
    const sp = PropertiesService.getScriptProperties();

    try {
        const pvId = sp.getProperty(P_PVID);
        if (!pvId) return;

        let startIdx = parseInt(sp.getProperty(P_D_START) || '0');
        let totalFilas = parseInt(sp.getProperty(P_D_FILAS) || '0');
        let sectionKeys = JSON.parse(sp.getProperty(P_D_KEYS) || '[]');
        let baseRows = JSON.parse(sp.getProperty(P_F_BASE_ROWS) || '{}');
        let reporteId = sp.getProperty(P_REPORTE_ID) || '';
        let carpetaId = sp.getProperty(P_CARPETA_ID) || '';

        const bdSS = SpreadsheetApp.openById(ID_BD_GENERAL);
        let reporteSS, hojaDestino, carpeta;

        // ── Inicialización (primer lote) ──
        if (startIdx === 0) {
            const hojaBD = bdSS.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
            if (!hojaBD) throw new Error(`No existe hoja '${NOMBRE_HOJA_ACTIVADORA}'`);

            const allData = hojaBD.getDataRange().getValues();
            const headers = allData[0].map(h => typeof h === 'string' ? h.trim() : h);
            const iId = headers.indexOf(COLUMNA_PVID);

            let fila = null, rowIndex = -1;
            for (let i = 1; i < allData.length; i++) {
                if (allData[i][iId] != null && allData[i][iId].toString().trim() === pvId) {
                    fila = allData[i]; rowIndex = i + 1; break;
                }
            }
            if (!fila) throw new Error(`ID '${pvId}' no encontrado`);

            const cliente = fila[headers.indexOf('cliente')] || 'SIN_CLIENTE';
            const ot = fila[headers.indexOf('ot')] || 'SIN_OT';
            const nombre = `Reporte API 570 - ${cliente} - ${ot} (${pvId})`;

            carpeta = buscarOCrearCarpeta(hojaBD, rowIndex, nombre);
            carpetaId = carpeta.getId();

            reporteSS = SpreadsheetApp.create(nombre);
            reporteId = reporteSS.getId();
            DriveApp.getFileById(reporteId).moveTo(carpeta);

            const plantillaSS = SpreadsheetApp.openById(ID_PLANTILLA);
            const hojaPlantilla = plantillaSS.getSheetByName(NOMBRE_HOJA_FORMATO);
            if (!hojaPlantilla) throw new Error(`No existe plantilla '${NOMBRE_HOJA_FORMATO}'`);

            hojaDestino = hojaPlantilla.copyTo(reporteSS);
            hojaDestino.setName(NOMBRE_HOJA_FORMATO);
            const hojaDefault = reporteSS.getSheetByName('Hoja 1') || reporteSS.getSheetByName('Sheet1');
            if (hojaDefault) reporteSS.deleteSheet(hojaDefault);

            // Cabecera (celdas dispersas — pocas, no son cuello de botella)
            for (const col in MAPEO_DE_CELDAS) {
                const idx = headers.indexOf(col);
                if (idx !== -1) hojaDestino.getRange(MAPEO_DE_CELDAS[col]).setValue(fila[idx]);
            }

            // Firma
            procesarFirma(fila, headers, hojaDestino);

            sectionKeys = Object.keys(SECTIONS_CONFIG);
            sp.setProperties({
                [P_REPORTE_ID]: reporteId,
                [P_CARPETA_ID]: carpetaId,
                [P_NOMBRE]: nombre,
                [P_D_KEYS]: JSON.stringify(sectionKeys)
            });

        } else {
            reporteSS = SpreadsheetApp.openById(reporteId);
            hojaDestino = reporteSS.getSheetByName(NOMBRE_HOJA_FORMATO);
            carpeta = DriveApp.getFolderById(carpetaId);
            sectionKeys = JSON.parse(sp.getProperty(P_D_KEYS) || '[]');
        }

        // ── Procesar lote de secciones (SOLO TEXTO) ──
        const total = sectionKeys.length;
        const finLote = Math.min(startIdx + SECCIONES_DATOS_POR_LOTE, total);

        for (let i = startIdx; i < finLote; i++) {
            const key = sectionKeys[i];
            const config = SECTIONS_CONFIG[key];
            if (!config) continue;

            const resultado = procesarSeccionSoloTexto(pvId, bdSS, hojaDestino, config, totalFilas);
            totalFilas += resultado.filasInsertadas;

            // Guardar fila base de fotos para el Loop 2
            if (config.photosConfig && resultado.basePhotoRow > 0) {
                baseRows[key] = resultado.basePhotoRow;
            }
        }

        sp.setProperties({
            [P_D_START]: finLote.toString(),
            [P_D_FILAS]: totalFilas.toString(),
            [P_F_BASE_ROWS]: JSON.stringify(baseRows)
        });

        if (finLote < total) {
            // Aún quedan secciones de texto → continuar
            agendarTrigger('loopDatosTrigger', 1000);

        } else {
            // ── Loop de datos terminado → arrancar Loop de fotos ──
            SpreadsheetApp.flush();
            guardarLink(pvId, carpeta.getUrl());

            const seccionesConFotos = Object.keys(baseRows);
            if (seccionesConFotos.length > 0) {
                sp.setProperties({
                    [P_F_SECTION_IDX]: '0',
                    [P_F_FOTO_IDX]: '0'
                });
                agendarTrigger('loopFotosTrigger', 2000);
                Logger.log(`Loop datos OK para ${pvId}. Iniciando loop fotos (${seccionesConFotos.length} secciones).`);
            } else {
                Logger.log(`Loop datos OK para ${pvId}. Sin fotos. Avanzando.`);
                avanzarAlSiguienteReporte();
            }
        }

    } catch (e) {
        Logger.log(`❌ ERROR loopDatos: ${e.stack}`);
        const pvId = sp.getProperty(P_PVID);
        guardarLink(pvId, `ERROR: ${e.message}`);
        avanzarAlSiguienteReporte();
    }
}

// =================================================================
// --- LOOP 2: FOTOS ENCADENADAS ---
// Procesa FOTOS_POR_TRIGGER fotos y se agenda a sí mismo.
// Itera sección por sección, foto por foto.
// Nunca acumula tiempo — cada trigger vive solo ~8-20 segundos.
// No importa cuántas fotos haya en total. No hay timeout posible.
// =================================================================
function loopFotosTrigger() {
    borrarTriggers('loopFotosTrigger');
    const sp = PropertiesService.getScriptProperties();

    try {
        const pvId = sp.getProperty(P_PVID);
        const reporteId = sp.getProperty(P_REPORTE_ID);
        const baseRows = JSON.parse(sp.getProperty(P_F_BASE_ROWS) || '{}');
        const sectionKeys = Object.keys(baseRows); // Solo secciones que tienen fotos

        let sectionIdx = parseInt(sp.getProperty(P_F_SECTION_IDX) || '0');
        let fotoIdx = parseInt(sp.getProperty(P_F_FOTO_IDX) || '0');

        // ── ¿Terminamos todas las secciones? ──
        if (sectionIdx >= sectionKeys.length) {
            Logger.log(`✅ Loop fotos completo para ${pvId}.`);
            avanzarAlSiguienteReporte();
            return;
        }

        const sectionKey = sectionKeys[sectionIdx];
        const config = SECTIONS_CONFIG[sectionKey];
        const basePhotoRow = baseRows[sectionKey];

        if (!config || !config.photosConfig || !basePhotoRow) {
            // Sección sin config de fotos → saltar
            sp.setProperties({ [P_F_SECTION_IDX]: (sectionIdx + 1).toString(), [P_F_FOTO_IDX]: '0' });
            agendarTrigger('loopFotosTrigger', 500);
            return;
        }

        const pConfig = config.photosConfig;
        const bdSS = SpreadsheetApp.openById(ID_BD_GENERAL);
        const hojaFotos = bdSS.getSheetByName(pConfig.photoSheetName);

        if (!hojaFotos) {
            sp.setProperties({ [P_F_SECTION_IDX]: (sectionIdx + 1).toString(), [P_F_FOTO_IDX]: '0' });
            agendarTrigger('loopFotosTrigger', 500);
            return;
        }

        const datosFotos = hojaFotos.getDataRange().getValues();
        if (datosFotos.length < 2) {
            sp.setProperties({ [P_F_SECTION_IDX]: (sectionIdx + 1).toString(), [P_F_FOTO_IDX]: '0' });
            agendarTrigger('loopFotosTrigger', 500);
            return;
        }

        const hF = datosFotos[0].map(v => typeof v === 'string' ? v.trim() : v);
        const iPvId = hF.indexOf(pConfig.idColumnName);
        const iLink = hF.indexOf(pConfig.photoLinkColumnName);
        const iDesc = hF.indexOf('descripcion');

        const fotos = datosFotos.slice(1).filter(f =>
            f[iPvId] != null &&
            f[iPvId].toString().trim() === pvId.toString().trim() &&
            f[iLink] && typeof f[iLink] === 'string' && f[iLink].startsWith('http')
        );

        if (!fotos.length) {
            // Esta sección no tiene fotos para este pvId → siguiente sección
            sp.setProperties({ [P_F_SECTION_IDX]: (sectionIdx + 1).toString(), [P_F_FOTO_IDX]: '0' });
            agendarTrigger('loopFotosTrigger', 500);
            return;
        }

        const reporteSS = SpreadsheetApp.openById(reporteId);
        const hojaDestino = reporteSS.getSheetByName(NOMBRE_HOJA_FORMATO);

        // ── Primera vez en esta sección: insertar filas de fotos extra en bloque ──
        if (fotoIdx === 0) {
            const chunksNecesarios = Math.ceil(fotos.length / 4);
            if (chunksNecesarios > 1) {
                const filasExtras = (chunksNecesarios - 1) * 2;
                hojaDestino.insertRowsAfter(basePhotoRow + 1, filasExtras);
                const maxCols = hojaDestino.getMaxColumns();
                hojaDestino.getRange(basePhotoRow, 1, 2, maxCols)
                    .copyTo(
                        hojaDestino.getRange(basePhotoRow + 2, 1, filasExtras, maxCols),
                        SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false
                    );
                const alt1 = hojaDestino.getRowHeight(basePhotoRow);
                const alt2 = hojaDestino.getRowHeight(basePhotoRow + 1);
                for (let c = 1; c < chunksNecesarios; c++) {
                    hojaDestino.setRowHeight(basePhotoRow + c * 2, alt1);
                    hojaDestino.setRowHeight(basePhotoRow + c * 2 + 1, alt2);
                }
                SpreadsheetApp.flush();
            }
        }

        // ── Procesar el chunk de FOTOS_POR_TRIGGER fotos ──
        const fin = Math.min(fotoIdx + FOTOS_POR_TRIGGER, fotos.length);
        let fallidas = 0;

        for (let j = fotoIdx; j < fin; j++) {
            // CADA foto está aislada: si una falla con INTERNAL, no tumba el chunk.
            try {
                const foto = fotos[j];
                const chunkIndex = Math.floor(j / 4);
                const posInChunk = j % 4;
                const photoRow = basePhotoRow + chunkIndex * 2;
                const descRow = photoRow + 1;
                const photoCol = pConfig.photoCells[posInChunk].match(/[A-Z]+/)[0];
                const descCol = pConfig.descCells[posInChunk].match(/[A-Z]+/)[0];

                insertarImagen(foto[iLink], hojaDestino.getRange(`${photoCol}${photoRow}`));
                if (iDesc !== -1 && foto[iDesc]) {
                    hojaDestino.getRange(`${descCol}${descRow}`).setValue(foto[iDesc]);
                }
            } catch (eFoto) {
                // Foto problemática: registrar y continuar con la siguiente.
                fallidas++;
                Logger.log(`⚠ Foto ${j} de '${sectionKey}' (${pvId}) falló: ${eFoto.message}`);
            }
        }
        SpreadsheetApp.flush();

        Logger.log(`Loop fotos ${pvId} | sección ${sectionKey} | fotos ${fotoIdx}–${fin - 1} de ${fotos.length}${fallidas ? ` | ${fallidas} fallidas (omitidas)` : ''}`);

        // ── Decidir siguiente paso ──
        if (fin >= fotos.length) {
            // Sección completa → pasar a la siguiente
            sp.setProperties({
                [P_F_SECTION_IDX]: (sectionIdx + 1).toString(),
                [P_F_FOTO_IDX]: '0'
            });
        } else {
            // Aún quedan fotos en esta sección → continuar desde donde quedamos
            sp.setProperty(P_F_FOTO_IDX, fin.toString());
        }

        // Siempre agendar el siguiente trigger (se detiene solo cuando sectionIdx >= total)
        agendarTrigger('loopFotosTrigger', 1000);

    } catch (e) {
        Logger.log(`❌ ERROR loopFotos: ${e.stack}`);
        // Saltar esta sección y continuar con la siguiente para no bloquear el proceso
        const sp = PropertiesService.getScriptProperties();
        const sectionIdx = parseInt(sp.getProperty(P_F_SECTION_IDX) || '0');
        sp.setProperties({
            [P_F_SECTION_IDX]: (sectionIdx + 1).toString(),
            [P_F_FOTO_IDX]: '0'
        });
        agendarTrigger('loopFotosTrigger', 2000);
    }
}

// =================================================================
// --- HELPERS DE PROCESAMIENTO ---
// =================================================================

/**
 * Procesa una sección escribiendo SOLO TEXTO (sin fotos).
 * Retorna { filasInsertadas, basePhotoRow }.
 */
function procesarSeccionSoloTexto(pvId, bdSS, hojaDestino, config, filasInsertadasPrev) {
    const resultado = { filasInsertadas: 0, basePhotoRow: 0 };
    try {
        const hojaSeccion = bdSS.getSheetByName(config.sheetName);
        if (!hojaSeccion) return resultado;

        const datos = hojaSeccion.getDataRange().getValues();
        if (!datos || datos.length < 2) return resultado;

        const headers = datos[0].map(h => typeof h === 'string' ? h.trim() : h);
        const iId = headers.indexOf(COLUMNA_PVID);
        if (iId === -1) return resultado;

        const registros = datos.slice(1).filter(f =>
            f[iId] != null && f[iId].toString().trim() == pvId.toString().trim()
        );
        if (!registros.length) return resultado;

        const cantidad = registros.length;
        const filaInicio = config.dataStartRow + filasInsertadasPrev;
        let filasInsertadas = 0;

        if (cantidad > 1) {
            const extra = cantidad - 1;
            hojaDestino.insertRowsAfter(filaInicio, extra);
            hojaDestino.getRange(filaInicio, 1, 1, hojaDestino.getMaxColumns())
                .copyTo(
                    hojaDestino.getRange(filaInicio + 1, 1, extra, hojaDestino.getMaxColumns()),
                    SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false
                );
            filasInsertadas = extra;
        }

        // Escritura en lote: una llamada setValues() por columna
        const colMap = {};
        Object.entries(config.mapping).forEach(([col, celda]) => {
            const letra = celda.match(/[A-Z]+/)[0];
            const idx = headers.indexOf(col);
            if (idx !== -1) colMap[letra] = idx;
        });
        Object.entries(colMap).forEach(([letra, idx]) => {
            const valores = registros.map(r => [r[idx]]);
            hojaDestino.getRange(filaInicio, colLetraANum(letra), cantidad, 1).setValues(valores);
        });

        // Calcular fila base de fotos
        if (config.photosConfig) {
            const numFilaFoto = parseInt(config.photosConfig.photoCells[0].match(/\d+/)[0]);
            resultado.basePhotoRow = config.dataStartRow + filasInsertadasPrev + filasInsertadas
                + (numFilaFoto - config.dataStartRow);
        }

        resultado.filasInsertadas = filasInsertadas;
        return resultado;

    } catch (e) {
        throw new Error(`Error en sección '${config.sheetName}': ${e.message}`);
    }
}

function procesarFirma(fila, headers, hojaDestino) {
    const iFirma = headers.indexOf('link_firma');
    const iNombre = headers.indexOf('nombre');
    const iCargo = headers.indexOf('cargo');
    const iCert = headers.indexOf('certificacion');
    const iFecha = headers.indexOf('fecha');
    if (iFirma !== -1) {
        const url = fila[iFirma];
        if (url && typeof url === 'string' && url.startsWith('http')) {
            insertarImagen(url, hojaDestino.getRange('J165'));
        }
    }
    if (iNombre !== -1) hojaDestino.getRange('J166').setValue(fila[iNombre]);
    if (iCargo !== -1) hojaDestino.getRange('J167').setValue(fila[iCargo]);
    if (iCert !== -1) hojaDestino.getRange('J168').setValue(fila[iCert]);
    if (iFecha !== -1) hojaDestino.getRange('J169').setValue(fila[iFecha]);
}

function buscarOCrearCarpeta(hojaBD, rowIndex, nombre) {
    const h = hojaBD.getDataRange().getValues()[0].map(v => typeof v === 'string' ? v.trim() : v);
    const iLnk = h.indexOf(COLUMNA_LINK_REPORTE);
    const link = (iLnk !== -1 && rowIndex !== -1) ? hojaBD.getRange(rowIndex, iLnk + 1).getValue() : '';

    if (link && typeof link === 'string' && link.includes('drive.google.com/drive/folders/')) {
        try {
            const fId = link.split('/folders/')[1].split('?')[0];
            const carpeta = DriveApp.getFolderById(fId);
            let f = carpeta.getFiles(); while (f.hasNext()) f.next().setTrashed(true);
            let d = carpeta.getFolders(); while (d.hasNext()) d.next().setTrashed(true);
            return carpeta;
        } catch (e) { /* crear nueva */ }
    }

    const plantilla = DriveApp.getFileById(ID_PLANTILLA);
    const parents = plantilla.getParents();
    const padre = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    const raizIter = padre.getFoldersByName(NOMBRE_CARPETA_RAIZ_REPORTES);
    const raiz = raizIter.hasNext() ? raizIter.next() : padre.createFolder(NOMBRE_CARPETA_RAIZ_REPORTES);
    const exist = raiz.getFoldersByName(nombre);
    while (exist.hasNext()) exist.next().setTrashed(true);
    return raiz.createFolder(nombre);
}

function guardarLink(pvId, url) {
    try {
        const hoja = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
        if (!hoja) return;
        const datos = hoja.getDataRange().getValues();
        const h = datos[0].map(v => typeof v === 'string' ? v.trim() : v);
        const iId = h.indexOf(COLUMNA_PVID);
        const iLnk = h.indexOf(COLUMNA_LINK_REPORTE);
        if (iId === -1 || iLnk === -1) return;
        for (let i = 1; i < datos.length; i++) {
            if (datos[i][iId] != null && datos[i][iId].toString().trim() === pvId.toString().trim()) {
                hoja.getRange(i + 1, iLnk + 1).setValue(url);
                break;
            }
        }
    } catch (e) { Logger.log(`Error guardando link: ${e.message}`); }
}

function insertarImagen(url, celda) {
    insertarImagenFlotante(url, celda);
}

function insertarImagenFlotante(url, rango) {
    if (!url || typeof url !== 'string' || url.trim() === '') return;
    let finalUrl = url.trim();
    if (finalUrl.includes('drive.google.com')) {
        const idMatch = finalUrl.match(/id=([^&]+)/) || finalUrl.match(/\/d\/([^/]+)/);
        if (idMatch && idMatch[1]) finalUrl = 'https://drive.google.com/uc?export=download&id=' + idMatch[1];
    }
    if (!finalUrl.startsWith('http')) { rango.setValue('Sin URL'); return; }
    const hoja = rango.getSheet();
    try {
        const resp = UrlFetchApp.fetch(finalUrl, { muteHttpExceptions: true, followRedirects: true });
        if (resp.getResponseCode() !== 200) { rango.setValue('Error Img'); return; }
        const blob = resp.getBlob();
        let destino = rango;
        if (rango.isPartOfMerge()) {
            const merges = rango.getMergedRanges();
            if (merges && merges.length > 0) destino = merges[0];
        }
        const fila = destino.getRow();
        const col = destino.getColumn();
        let anchoArea = 0, altoArea = 0;
        for (let c = 0; c < destino.getNumColumns(); c++) anchoArea += hoja.getColumnWidth(col + c);
        for (let r = 0; r < destino.getNumRows(); r++) altoArea += hoja.getRowHeight(fila + r);
        const img = hoja.insertImage(blob, col, fila);
        const margen = 4;
        const escala = Math.min(
            Math.max(anchoArea - margen, 20) / img.getWidth(),
            Math.max(altoArea - margen, 20) / img.getHeight()
        );
        const anchoFinal = Math.round(img.getWidth()  * escala);
        const altoFinal  = Math.round(img.getHeight() * escala);
        img.setWidth(anchoFinal);
        img.setHeight(altoFinal);
        const offsetX = Math.max(0, Math.round((anchoArea - anchoFinal) / 2));
        const offsetY = Math.max(0, Math.round((altoArea  - altoFinal)  / 2));
        img.setAnchorCellXOffset(offsetX);
        img.setAnchorCellYOffset(offsetY);
    } catch (e) {
        Logger.log('Error insertando imagen: ' + e.message);
        rango.setValue('Error Img');
    }
}

function colLetraANum(letter) {
    let r = 0;
    for (let i = 0; i < letter.length; i++) r = r * 26 + (letter.charCodeAt(i) - 64);
    return r;
}

function agendarTrigger(fn, ms) {
    ScriptApp.newTrigger(fn).timeBased().after(ms).create();
}

function borrarTriggers(fn) {
    try {
        ScriptApp.getProjectTriggers()
            .filter(t => t.getHandlerFunction() === fn)
            .forEach(t => ScriptApp.deleteTrigger(t));
    } catch (e) { }
}

function limpiarTodoElEstado() {
    try {
        PropertiesService.getScriptProperties().deleteAllProperties();
        ['loopDatosTrigger', 'loopFotosTrigger',
            'fase1DatosTrigger', 'fase2FotosTrigger',
            'procesarLoteSeccionesTrigger'].forEach(borrarTriggers);
    } catch (e) { }
}

function probarAccesoALasBasesDeDatos() {
    const ui = SpreadsheetApp.getUi();
    try {
        const bd = SpreadsheetApp.openById(ID_BD_GENERAL);
        ui.alert(`✅ Acceso OK:\n${bd.getName()}`);
    } catch (e) {
        ui.alert(`❌ Error:\n${e.message}`);
    }
}
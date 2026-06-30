/**
 * =================================================================
 * --- ARCHIVO: Reporte_API510.gs ---
 * =================================================================
 * Script Avanzado para la generación de reportes API 510 (AppSheet).
 * * REGLAS CUMPLIDAS:
 * 1. Menú Personalizado (Manual, Selector Múltiple, Todos Pendientes).
 * 2. Sistema de Cola (Queue) y Batching con Triggers (Evita Timeout).
 * 3. NO genera PDF, solo Google Sheets. Guarda en subcarpetas y REEMPLAZA contenido si ya existe link.
 * 4. Lógica de Imágenes con newCellImage() basada en el script original (Mantiene proporción y es Excel Compatible).
 */

// =================================================================
// --- CONFIGURACIÓN PRINCIPAL ---
// =================================================================
const ID_BD_GENERAL = "1RTgmI6Ftwuf3b00ELIgnQZrBvbN3Jiw36HBCAbTWuwY";
const ID_BD_FOTOS = "1i_pHG65ljg5NidkQa_n611PPSOmVcmNUNZ4mY-mqrpI";
const ID_PLANTILLA = SpreadsheetApp.getActiveSpreadsheet().getId();

const NOMBRE_CARPETA_RAIZ_REPORTES = "REPORTES_VT_510";
const NOMBRE_HOJA_FORMATO = "FORMATO_VISUAL";
const NOMBRE_HOJA_ACTIVADORA = "0.pv_general";
const COLUMNA_PVID = "pvID";
const COLUMNA_ACTIVADORA = "GenerarReporteTrigger";
const COLUMNA_LINK_REPORTE = "LinkReporte";

// Mapeo para la sección de datos generales
const MAPEO_DE_CELDAS = {
    'cliente': 'I8', 'consecutivo': 'V8', 'fechaInsp': 'AI8', 'ubicación': 'AV8',
    'tag': 'I10', 'servicio': 'V10', 'fabricante': 'AI10', 'yearFabrication': 'AV10',
    'nbNo': 'I12', 'NoSerie': 'V12', 'mawp': 'AI12', 'designTemp': 'AV12',
    'rt': 'I14', 'mdmt': 'V14', 'po': 'AI14', 'operTemp': 'AV14',
    'ca': 'I16', 'code': 'V16', 'alturaLargo': 'AI16', 'diametro': 'AV16',
    'matCuerpo': 'I18', 'matCabezas': 'V18', 'matTapa': 'AI18', 'matChaqueta': 'AV18',
    'thkCuerpo': 'I20', 'thkCabezas': 'V20', 'thkTapa': 'AI20', 'capacidad': 'AV20'
};

// =================================================================
// --- CONFIGURACIÓN MODULAR POR SECCIONES ---
// =================================================================
const SECTIONS_CONFIG = {
    foundation: { sheetName: '1.pv_foundation', mapping: { 'fundConcreto1': 'C28', 'fundConcreto2': 'I28', 'fundConcreto3': 'O28', 'fundConcreto4': 'T28', 'conten1': 'AC28', 'conten2': 'AI28', 'conten3': 'AO28', 'conten4': 'AU28' }, dataStartRow: 28, photosConfig: { dataIdColumnName: 'id_funda', idColumnName: 'id_foundation', photoSheetName: '1.pv_foundation_photos', photoLinkColumnName: 'link_pv_foundation', photoCells: ['C31', 'P31', 'AC31', 'AP31'], descCells: ['C32', 'P32', 'AC32', 'AP32'] } },
    support: { sheetName: '2.pv_support', mapping: { 'support1': 'C37', 'support2': 'H37', 'support3': 'N37', 'support4': 'T37', 'support5': 'Z37', 'support6': 'AF37', 'support7': 'AL37' }, dataStartRow: 37, photosConfig: { dataIdColumnName: 'id_support', idColumnName: 'id_support', photoSheetName: '2.pv_support_photos', photoLinkColumnName: 'link_pv_support', photoCells: ['C40', 'P40', 'AC40', 'AP40'], descCells: ['C41', 'P41', 'AC41', 'AP41'] } },
    shellExternal: { sheetName: '3.pv_shell_External', mapping: { 'pvExternal1': 'C46', 'pvExternal2': 'G46', 'pvExternal3': 'L46', 'pvExternal4': 'Q46', 'pvExternal5': 'V46', 'pvExternal6': 'AA46', 'pvExternal7': 'AF46', 'pvExternal8': 'AK46', 'pvExternal9': 'AN46', 'pvExternal10': 'AQ46' }, dataStartRow: 46, photosConfig: { dataIdColumnName: 'id_external', idColumnName: 'id_shell_external', photoSheetName: '3.pv_shell_External_photos', photoLinkColumnName: 'link_pv_shell_External', photoCells: ['C49', 'P49', 'AC49', 'AP49'], descCells: ['C50', 'P50', 'AC50', 'AP50'] } },
    shellInternal: { sheetName: '4.pv_shell_Internal', mapping: { 'pvInternal1': 'C55', 'pvInternal2': 'G55', 'pvInternal3': 'L55', 'pvInternal4': 'Q55', 'pvInternal5': 'V55', 'pvInternal6': 'AA55', 'pvInternal7': 'AF55', 'pvInternal8': 'AK55' }, dataStartRow: 55, photosConfig: { dataIdColumnName: 'id_internal', idColumnName: 'id_shell_internal', photoSheetName: '4.pv_shell_Internal_photos', photoLinkColumnName: 'link_pv_shell_Internal', photoCells: ['C58', 'P58', 'AC58', 'AP58'], descCells: ['C59', 'P59', 'AC59', 'AP59'] } },
    nozzle: { sheetName: '5.pv_nozzle', mapping: { 'pvNozzle1': 'C64', 'pvNozzle2': 'E64', 'pvNozzle3': 'H64', 'pvNozzle4': 'J64', 'pvNozzle5': 'O64', 'pvNozzle6': 'R64', 'pvNozzle7': 'V64', 'pvNozzle8': 'Z64', 'pvNozzle9': 'AD64', 'pvNozzle10': 'AH64', 'pvNozzle11': 'AL64', 'pvNozzle12': 'AP64', 'pvNozzle13': 'AT64' }, dataStartRow: 64, photosConfig: { dataIdColumnName: 'id_nozzle', idColumnName: 'id_nozzle', photoSheetName: '5.pv_nozzle_photos', photoLinkColumnName: 'link_pv_nozzle', photoCells: ['C67', 'P67', 'AC67', 'AP67'], descCells: ['C68', 'P68', 'AC68', 'AP68'] } },
    prd: { sheetName: '6.pv_PRD', mapping: { 'prd1': 'C73', 'prd2': 'G73', 'prd3': 'K73', 'prd4': 'N73', 'prd5': 'R73', 'prd6': 'U73', 'prd7': 'X73', 'prd8': 'AA73', 'prd9': 'AD73', 'prd10': 'AH73', 'prd11': 'AL73', 'prd13': 'AP73', 'prd14': 'AU73' }, dataStartRow: 73, photosConfig: { dataIdColumnName: 'id_prd', idColumnName: 'id_prd', photoSheetName: '6.pv_PRD_photos', photoLinkColumnName: 'link_pv_PRD', photoCells: ['C76', 'P76', 'AC76', 'AP76'], descCells: ['C77', 'P77', 'AC77', 'AP77'] } },
    ladders: { sheetName: '7.pv_Ladders_Stairways_Platform', mapping: { 'stairways1': 'C82', 'stairways2': 'N82', 'stairways3': 'Y82', 'stairways4': 'AJ82' }, dataStartRow: 82, photosConfig: { dataIdColumnName: 'id_stairways', idColumnName: 'id_ladders_stairways_platform', photoSheetName: '7.pv_Ladders_Stairways_Platform_photos', photoLinkColumnName: 'link_pv_Ladders_Stairways_Platform', photoCells: ['C85', 'P85', 'AC85', 'AP85'], descCells: ['C86', 'P86', 'AC86', 'AP86'] } },
    indicators: { sheetName: '8.pv_pressu_temp_indicators', mapping: { 'inst1': 'C91', 'inst2': 'N91', 'inst3': 'Y91', 'inst4': 'AJ91' }, dataStartRow: 91, photosConfig: { dataIdColumnName: 'id_inst', idColumnName: 'id_pressu_temp_indicators', photoSheetName: '8.pv_pressu_temp_indicators_photos', photoLinkColumnName: 'link_pv_pressu_temp_indicators', photoCells: ['C94', 'P94', 'AC94', 'AP94'], descCells: ['C95', 'P95', 'AC95', 'AP95'] } },
    insulation: { sheetName: '9.pv_insulation', mapping: { 'aislami1': 'C100', 'aislami2': 'N100', 'aislami3': 'Y100', 'aislami4': 'AJ100' }, dataStartRow: 100, photosConfig: { dataIdColumnName: 'id_aislami', idColumnName: 'id_insulation', photoSheetName: '9.pv_insulation_photos', photoLinkColumnName: 'link_pv_insulation', photoCells: ['C103', 'P103', 'AC103', 'AP103'], descCells: ['C104', 'P104', 'AC104', 'AP104'] } },
    mixer: { sheetName: '10.pv_Mixer_Agitator', mapping: { 'mixer1': 'C109', 'mixer2': 'N109', 'mixer3': 'Y109', 'mixer4': 'AJ109' }, dataStartRow: 109, photosConfig: { dataIdColumnName: 'id_mixer', idColumnName: 'id_mixer_agitator', photoSheetName: '10.pv_Mixer_Agitator_photos', photoLinkColumnName: 'link_pv_Mixer_Agitator', photoCells: ['C112', 'P112', 'AC112', 'AP112'], descCells: ['C113', 'P113', 'AC113', 'AP113'] } },
    jacket: { sheetName: '11.pv_jacket', mapping: { 'jacket1': 'C118', 'jacket2': 'K118', 'jacket3': 'S118', 'jacket4': 'AA118', 'jacket5': 'AI118', 'jacket6': 'AQ118' }, dataStartRow: 118, photosConfig: { dataIdColumnName: 'id_jacket', idColumnName: 'id_jacket', photoSheetName: '11.pv_jacket_photos', photoLinkColumnName: 'link_pv_jacket', photoCells: ['C121', 'P121', 'AC121', 'AP121'], descCells: ['C122', 'P122', 'AC122', 'AP122'] } }
};

// Variables de Estado (PropertiesService)
const SECCIONES_POR_LOTE = 4; // Ajustado a 4 secciones por trigger para evitar timeout
const PROP_VALOR_BUSCADO = 'VALOR_BUSCADO_510';
const PROP_START_INDEX = 'START_INDEX_510';
const PROP_TOTAL_FILAS_INSERTADAS = 'TOTAL_FILAS_INSERTADAS_510';
const PROP_SECTION_KEYS = 'SECTION_KEYS_510';
const PROP_REPORTE_ID = 'REPORTE_ID_510';
const PROP_CARPETA_ID = 'CARPETA_ID_510';
const PROP_NOMBRE_REPORTE = 'NOMBRE_REPORTE_510';
const PROP_QUEUE_IDS = 'QUEUE_IDS_510';

// =================================================================
// --- PARTE 1: ACTIVADORES (MENÚ Y ONEDIT) ---
// =================================================================

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Reportes AppSheet 510')
        .addItem('1. Generar Reporte Manual (Por ID)', 'mostrarPanelDeEntrada')
        .addItem('2. Generar Múltiples (Selector)', 'mostrarPanelSelector')
        .addItem('3. Generar Todos los Pendientes', 'generarTodosPendientes')
        .addSeparator()
        .addItem('Probar Acceso a BD', 'probarAccesoALasBasesDeDatos')
        .addItem('Limpiar Cola (Emergencia)', 'limpiarPropiedadesEstado')
        .addToUi();
}

function onEditTrigger(e) {
    const range = e.range;
    const sheet = range.getSheet();
    const editedRow = range.getRow();

    if (editedRow === 1) return;

    if (sheet.getName() === NOMBRE_HOJA_ACTIVADORA) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const triggerColIndex = headers.indexOf(COLUMNA_ACTIVADORA) + 1;
        const linkColIndex = headers.indexOf(COLUMNA_LINK_REPORTE) + 1;
        const pvIdColIndex = headers.indexOf(COLUMNA_PVID) + 1;

        if (range.getColumn() === triggerColIndex) {
            Utilities.sleep(2000);

            const valorDeLaCelda = range.getValue();
            const valorNormalizado = valorDeLaCelda ? valorDeLaCelda.toString().trim().toLowerCase() : '';

            if (valorNormalizado === 'yes' || valorNormalizado === 'true') {
                const pvId = sheet.getRange(editedRow, pvIdColIndex).getValue();

                if (!pvId) {
                    if (linkColIndex > 0) sheet.getRange(editedRow, linkColIndex).setValue('ERROR: Falta ID');
                    range.setValue('Error');
                    return;
                }

                try {
                    if (linkColIndex > 0) sheet.getRange(editedRow, linkColIndex).setValue('Generando en cola...');
                    iniciarGeneracionCola([pvId.toString().trim()], false);
                    range.setValue('No');
                } catch (error) {
                    if (linkColIndex > 0) sheet.getRange(editedRow, linkColIndex).setValue(`ERROR: ${error.message}`);
                    range.setValue('Error');
                }
            }
        }
    }
}

// =================================================================
// --- PARTE 2: MANEJO DE OPCIONES DE GENERACIÓN Y COLAS ---
// =================================================================

// Opción 1: Manual por ID
function mostrarPanelDeEntrada() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.prompt(
        'Generar Reporte Individual',
        `Ingrese el ID del reporte (columna ${COLUMNA_PVID}).\n\nSi el enlace ya existe, se VACIARÁ la carpeta y se generará uno nuevo allí:`,
        ui.ButtonSet.OK_CANCEL);

    if (result.getSelectedButton() == ui.Button.OK) {
        const valorBuscado = result.getResponseText();
        if (valorBuscado) {
            iniciarGeneracionCola([valorBuscado.trim()], true);
        } else {
            ui.alert(`Por favor, ingrese un ${COLUMNA_PVID} válido.`);
        }
    }
}

// Opción 2: Selector por UI (Modal HTML)
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
    <h2>🚀 Selector de Reportes API 510</h2>
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
        if (!data.length) { container.innerHTML = "<div class='loading'>No se encontraron registros.</div>"; return; }
        container.innerHTML = data.map(item => {
          const badgeClass = item.hasLink ? 'bg-done' : 'bg-pending';
          const statusText = item.hasLink ? 'Generado' : 'Pendiente';
          const checked = item.hasLink ? '' : 'checked';
          return '<label class="item"><input type="checkbox" class="chk-id" value="' + item.id + '" ' + checked + '><span>' + item.id + '</span><span class="badge ' + badgeClass + '">' + statusText + '</span></label>';
        }).join('');
      }
      function seleccionar(estado) { document.querySelectorAll('.chk-id').forEach(c => c.checked = estado); }
      function seleccionarPendientes() {
        document.querySelectorAll('.chk-id').forEach(c => {
          c.checked = c.parentElement.querySelector('.badge').innerText === 'Pendiente';
        });
      }
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
          .iniciarGeneracionColaUI(ids);
      }
    </script>
  </body>
  </html>
  `;
    const output = HtmlService.createHtmlOutput(htmlContent).setWidth(450).setHeight(550);
    SpreadsheetApp.getUi().showModalDialog(output, 'Generador Múltiple API 510');
}

function obtenerListaReportes() {
    const sheet = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => typeof h === 'string' ? h.trim() : h);
    const idxId = headers.indexOf(COLUMNA_PVID);
    const idxLink = headers.indexOf(COLUMNA_LINK_REPORTE);
    const idxCliente = headers.indexOf('cliente');
    const idxTag = headers.indexOf('tag');

    const reportes = [];
    for (let i = 1; i < data.length; i++) {
        const id = data[i][idxId];
        if (id) {
            const link = (idxLink !== -1) ? data[i][idxLink] : '';
            const hasLink = (link && typeof link === 'string' && link.startsWith('http'));
            reportes.push({
                id: id.toString().trim(),
                cliente: idxCliente !== -1 ? data[i][idxCliente] : '',
                tag: idxTag !== -1 ? data[i][idxTag] : '',
                hasLink: hasLink
            });
        }
    }
    return reportes;
}

function iniciarGeneracionColaUI(idsArray) { iniciarGeneracionCola(idsArray, true); }

// Opción 3: Generar TODOS los pendientes automáticamente
function generarTodosPendientes() {
    const ui = SpreadsheetApp.getUi();
    const reportes = obtenerListaReportes();
    const pendientes = reportes.filter(r => !r.hasLink).map(r => r.id);

    if (pendientes.length === 0) {
        ui.alert('No hay reportes pendientes por generar en la base de datos.');
        return;
    }

    const response = ui.alert('Confirmar', `Se detectaron ${pendientes.length} reportes pendientes.\n¿Desea iniciar la generación en cola de todos ellos?`, ui.ButtonSet.YES_NO);
    if (response === ui.Button.YES) {
        iniciarGeneracionCola(pendientes, true);
    }
}

// =================================================================
// --- CONTROLADOR CENTRAL DE LA COLA ---
// =================================================================
function iniciarGeneracionCola(idsArray, mostrarAlertas = true) {
    if (!idsArray || idsArray.length === 0) return;

    try {
        limpiarPropiedadesEstado();

        const total = idsArray.length;
        const primerId = idsArray.shift();

        const scriptProperties = PropertiesService.getScriptProperties();
        scriptProperties.setProperty(PROP_QUEUE_IDS, JSON.stringify(idsArray));
        scriptProperties.setProperty(PROP_VALOR_BUSCADO, primerId);
        scriptProperties.setProperty(PROP_START_INDEX, '0');
        scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, '0');
        scriptProperties.setProperty(PROP_REPORTE_ID, '');
        scriptProperties.setProperty(PROP_CARPETA_ID, '');
        scriptProperties.setProperty(PROP_NOMBRE_REPORTE, '');

        ScriptApp.newTrigger('procesarLoteSeccionesTrigger_510')
            .timeBased()
            .after(2000)
            .create();

        if (mostrarAlertas) {
            SpreadsheetApp.getUi().alert(
                '✅ Cola de Proceso Iniciada',
                `Se procesarán ${total} reporte(s) en segundo plano.\n\n` +
                `Si el LinkReporte existe, la carpeta se reciclará. El archivo generado es un SPREADSHEET de Google.`,
                SpreadsheetApp.getUi().ButtonSet.OK
            );
        }
    } catch (e) {
        Logger.log(`Error en iniciarGeneracionCola: ${e.stack}`);
        limpiarPropiedadesEstado();
    }
}

function avanzarSiguienteEnCola() {
    const scriptProperties = PropertiesService.getScriptProperties();
    let queueStr = scriptProperties.getProperty(PROP_QUEUE_IDS);
    let queue = queueStr ? JSON.parse(queueStr) : [];

    if (queue.length > 0) {
        const nextId = queue.shift();
        scriptProperties.setProperty(PROP_QUEUE_IDS, JSON.stringify(queue));
        scriptProperties.setProperty(PROP_VALOR_BUSCADO, nextId);
        scriptProperties.setProperty(PROP_START_INDEX, '0');
        scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, '0');
        scriptProperties.setProperty(PROP_REPORTE_ID, '');
        scriptProperties.setProperty(PROP_CARPETA_ID, '');
        scriptProperties.setProperty(PROP_NOMBRE_REPORTE, '');

        ScriptApp.newTrigger('procesarLoteSeccionesTrigger_510')
            .timeBased()
            .after(3000)
            .create();
    } else {
        limpiarPropiedadesEstado();
    }
}

// =================================================================
// --- WORKER PRINCIPAL (TRIGGER BATCHING) ---
// =================================================================
function procesarLoteSeccionesTrigger_510() {
    borrarTriggersExistentes('procesarLoteSeccionesTrigger_510');

    const scriptProperties = PropertiesService.getScriptProperties();
    let estado = {};

    try {
        // 1. Recuperar Estado
        estado.valorBuscado = scriptProperties.getProperty(PROP_VALOR_BUSCADO);
        if (!estado.valorBuscado) return;

        estado.startIndex = parseInt(scriptProperties.getProperty(PROP_START_INDEX) || '0');
        estado.totalFilasInsertadasGlobal = parseInt(scriptProperties.getProperty(PROP_TOTAL_FILAS_INSERTADAS) || '0');
        estado.reporteId = scriptProperties.getProperty(PROP_REPORTE_ID);
        estado.carpetaId = scriptProperties.getProperty(PROP_CARPETA_ID);
        estado.nombreReporte = scriptProperties.getProperty(PROP_NOMBRE_REPORTE);
        let sectionKeysStr = scriptProperties.getProperty(PROP_SECTION_KEYS);
        estado.sectionKeys = sectionKeysStr ? JSON.parse(sectionKeysStr) : [];

        let spreadsheetDatosGeneral;
        let spreadsheetFotos;
        let nuevoReporteSpreadsheet;
        let hojaFormatoDestino;
        let carpetaReporteIndividual;

        // 2. Configuración Inicial (Primera ejecución del ID actual)
        if (estado.startIndex === 0) {
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            const hojaDatosGeneral = spreadsheetDatosGeneral.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
            if (!hojaDatosGeneral) throw new Error(`Falta hoja '${NOMBRE_HOJA_ACTIVADORA}'.`);

            const datosGeneralesCompletos = hojaDatosGeneral.getDataRange().getValues();
            const encabezadosGenerales = datosGeneralesCompletos[0].map(h => typeof h === 'string' ? h.trim() : h);
            const datosGeneralesSinEncabezado = datosGeneralesCompletos.slice(1);
            const indicePvIdGeneral = encabezadosGenerales.indexOf(COLUMNA_PVID);

            let filaDatosGenerales = null;
            let rowIndex = -1;
            for (let i = 0; i < datosGeneralesSinEncabezado.length; i++) {
                if (datosGeneralesSinEncabezado[i][indicePvIdGeneral] != null &&
                    datosGeneralesSinEncabezado[i][indicePvIdGeneral].toString().trim() === estado.valorBuscado.toString().trim()) {
                    filaDatosGenerales = datosGeneralesSinEncabezado[i];
                    rowIndex = i + 2;
                    break;
                }
            }
            if (!filaDatosGenerales) throw new Error(`ID '${estado.valorBuscado}' no encontrado en BD General.`);

            const cliente = filaDatosGenerales[encabezadosGenerales.indexOf('cliente')] || 'SIN_CLIENTE';
            const tag = filaDatosGenerales[encabezadosGenerales.indexOf('tag')] || 'SIN_TAG';
            estado.nombreReporte = `Reporte VT API 510 - ${cliente} - ${tag} (${estado.valorBuscado})`;

            // Reciclaje de carpeta (Cumple Regla 3)
            carpetaReporteIndividual = buscarOCrearCarpetaReporte(hojaDatosGeneral, rowIndex, estado.nombreReporte);
            estado.carpetaId = carpetaReporteIndividual.getId();

            nuevoReporteSpreadsheet = SpreadsheetApp.create(estado.nombreReporte);
            estado.reporteId = nuevoReporteSpreadsheet.getId();
            DriveApp.getFileById(estado.reporteId).moveTo(carpetaReporteIndividual);

            const plantillaSpreadsheet = SpreadsheetApp.openById(ID_PLANTILLA);
            const hojaFormatoPlantilla = plantillaSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
            if (!hojaFormatoPlantilla) throw new Error(`Falta hoja plantilla '${NOMBRE_HOJA_FORMATO}'.`);

            hojaFormatoDestino = hojaFormatoPlantilla.copyTo(nuevoReporteSpreadsheet);
            hojaFormatoDestino.setName(NOMBRE_HOJA_FORMATO);
            const hojaPorDefecto = nuevoReporteSpreadsheet.getSheetByName('Hoja 1') || nuevoReporteSpreadsheet.getSheetByName('Sheet1');
            if (hojaPorDefecto) nuevoReporteSpreadsheet.deleteSheet(hojaPorDefecto);

            // Cargar Info General
            for (const nombreColumna in MAPEO_DE_CELDAS) {
                const celdaDestino = MAPEO_DE_CELDAS[nombreColumna];
                const indiceColumna = encabezadosGenerales.indexOf(nombreColumna);
                if (indiceColumna !== -1) {
                    hojaFormatoDestino.getRange(celdaDestino).setValue(filaDatosGenerales[indiceColumna]);
                }
            }
            procesarYColocarFotosGenerales(filaDatosGenerales, encabezadosGenerales, hojaFormatoDestino);
            procesarFirma(filaDatosGenerales, encabezadosGenerales, hojaFormatoDestino);

            estado.sectionKeys = Object.keys(SECTIONS_CONFIG);
            scriptProperties.setProperty(PROP_SECTION_KEYS, JSON.stringify(estado.sectionKeys));
            scriptProperties.setProperty(PROP_REPORTE_ID, estado.reporteId);
            scriptProperties.setProperty(PROP_CARPETA_ID, estado.carpetaId);
            scriptProperties.setProperty(PROP_NOMBRE_REPORTE, estado.nombreReporte);

        } else {
            // Ejecución subsecuente (lotes siguientes del mismo ID)
            if (!estado.reporteId || !estado.carpetaId) throw new Error("Faltan IDs en estado.");
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            nuevoReporteSpreadsheet = SpreadsheetApp.openById(estado.reporteId);
            hojaFormatoDestino = nuevoReporteSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
            carpetaReporteIndividual = DriveApp.getFolderById(estado.carpetaId);
        }

        // 3. Procesar Lote de Secciones
        spreadsheetFotos = SpreadsheetApp.openById(ID_BD_FOTOS); // Se abre la DB externa de fotos
        const totalSecciones = estado.sectionKeys.length;
        const indiceFinLote = Math.min(estado.startIndex + SECCIONES_POR_LOTE, totalSecciones);

        for (let i = estado.startIndex; i < indiceFinLote; i++) {
            const key = estado.sectionKeys[i];
            const config = SECTIONS_CONFIG[key];
            if (!config) continue;

            const filasInsertadasEnSeccion = processSection_Excel(
                estado.valorBuscado,
                spreadsheetDatosGeneral,
                spreadsheetFotos,
                hojaFormatoDestino,
                config,
                estado.totalFilasInsertadasGlobal
            );
            estado.totalFilasInsertadasGlobal += filasInsertadasEnSeccion;
        }

        // 4. Decidir Siguiente Paso
        const proximoStartIndex = indiceFinLote;

        if (proximoStartIndex < totalSecciones) {
            // Continuar con las secciones faltantes
            scriptProperties.setProperty(PROP_START_INDEX, proximoStartIndex.toString());
            scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, estado.totalFilasInsertadasGlobal.toString());

            ScriptApp.newTrigger('procesarLoteSeccionesTrigger_510')
                .timeBased()
                .after(2000)
                .create();

        } else {
            // Finalizar el ID Actual y escribir link de CARPETA (Regla 3)
            SpreadsheetApp.flush();

            try {
                const hojaDatosGeneralFinal = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
                if (hojaDatosGeneralFinal) {
                    const datos = hojaDatosGeneralFinal.getDataRange().getValues();
                    if (datos.length > 0) {
                        const headers = datos[0].map(h => typeof h === 'string' ? h.trim() : h);
                        const idCol = headers.indexOf(COLUMNA_PVID);
                        const linkCol = headers.indexOf(COLUMNA_LINK_REPORTE);
                        if (idCol !== -1 && linkCol !== -1) {
                            for (let i = 1; i < datos.length; i++) {
                                if (datos[i][idCol] != null && datos[i][idCol].toString().trim() === estado.valorBuscado.toString().trim()) {
                                    // Guarda la URL de la carpeta
                                    hojaDatosGeneralFinal.getRange(i + 1, linkCol + 1).setValue(carpetaReporteIndividual.getUrl());
                                    break;
                                }
                            }
                        }
                    }
                }
            } catch (eLink) { Logger.log(`Error link final: ${eLink.message}`); }

            // Procesar siguiente ID en cola
            avanzarSiguienteEnCola();
        }

    } catch (e) {
        Logger.log(`❌ ERROR procesando ID ${estado.valorBuscado}: ${e.stack}`);
        try {
            const hojaDatos = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
            const headers = hojaDatos.getRange(1, 1, 1, hojaDatos.getLastColumn()).getValues()[0];
            const iId = headers.indexOf(COLUMNA_PVID);
            const iLnk = headers.indexOf(COLUMNA_LINK_REPORTE);
            const data = hojaDatos.getDataRange().getValues();
            for (let i = 1; i < data.length; i++) {
                if (data[i][iId] == estado.valorBuscado) {
                    hojaDatos.getRange(i + 1, iLnk + 1).setValue(`ERROR: ${e.message}`);
                    break;
                }
            }
        } catch (err2) { }
        avanzarSiguienteEnCola(); // Si falla, sigue con el siguiente de todas formas
    }
}

// =================================================================
// --- PARTE 4: LÓGICAS DE GENERACIÓN Y DIAGNÓSTICO ---
// =================================================================

function processSection_Excel(pvId, spreadsheetDatos, spreadsheetFotos, hojaDestino, config, filasInsertadasPreviamente) {
    try {
        const hojaSeccion = spreadsheetDatos.getSheetByName(config.sheetName);
        if (!hojaSeccion) return 0;

        const datosCompletos = hojaSeccion.getDataRange().getValues();
        if (!datosCompletos || datosCompletos.length < 2) return 0;

        const encabezados = datosCompletos[0].map(h => typeof h === 'string' ? h.trim() : h);
        const indicePvId = encabezados.indexOf(COLUMNA_PVID);
        if (indicePvId === -1) return 0;

        const registrosEncontrados = datosCompletos.slice(1).filter(fila =>
            fila[indicePvId] != null && fila[indicePvId].toString().trim() == pvId.toString().trim()
        );
        if (registrosEncontrados.length === 0) return 0;

        let filasInsertadasParaDatos = 0;
        const filaInicioDatos = config.dataStartRow + filasInsertadasPreviamente;
        const cantidadRegistros = registrosEncontrados.length;

        // INSERCIÓN BATCH DATOS HIJOS
        if (cantidadRegistros > 1) {
            const filasAInsertar = cantidadRegistros - 1;
            hojaDestino.insertRowsAfter(filaInicioDatos, filasAInsertar);
            const rangoFuenteFormato = hojaDestino.getRange(filaInicioDatos, 1, 1, hojaDestino.getMaxColumns());
            const rangoDestinoFormato = hojaDestino.getRange(filaInicioDatos + 1, 1, filasAInsertar, hojaDestino.getMaxColumns());
            rangoFuenteFormato.copyTo(rangoDestinoFormato, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
            filasInsertadasParaDatos = filasAInsertar;
        }

        registrosEncontrados.forEach((registroActual, i) => {
            const filaDestino = filaInicioDatos + i;
            for (const nombreColumna in config.mapping) {
                const celdaOriginalPlantilla = config.mapping[nombreColumna];
                const soloLetraColumna = celdaOriginalPlantilla.match(/[A-Z]+/)[0];
                const celdaFinal = `${soloLetraColumna}${filaDestino}`;
                const indiceColumna = encabezados.indexOf(nombreColumna);

                if (indiceColumna !== -1) {
                    hojaDestino.getRange(celdaFinal).setValue(registroActual[indiceColumna]);
                }
            }
        });

        let totalFilasInsertadas = filasInsertadasParaDatos;

        // LÓGICA DE FOTOS BATCH Y DIAGNÓSTICO (REGLAS 4 Y 5)
        if (config.photosConfig) {
            const pConfig = config.photosConfig;
            const hojaFotos = spreadsheetFotos.getSheetByName(pConfig.photoSheetName);

            const numeroFilaPrimeraFotoPlantilla = parseInt(pConfig.photoCells[0].match(/\d+/)[0]);
            const rowOffset = numeroFilaPrimeraFotoPlantilla - config.dataStartRow;
            const basePhotoRow = config.dataStartRow + filasInsertadasPreviamente + filasInsertadasParaDatos + rowOffset;
            const primerCeldaDiagnostico = `${pConfig.photoCells[0].match(/[A-Z]+/)[0]}${basePhotoRow}`;

            // Diagnóstico: Hoja no existe
            if (!hojaFotos) {
                hojaDestino.getRange(primerCeldaDiagnostico).setValue(`⚠️ ERROR FOTOS: No existe la hoja '${pConfig.photoSheetName}'`).setFontColor('red').setFontStyle('italic');
                return totalFilasInsertadas;
            }

            const datosCompletosFotos = hojaFotos.getDataRange().getValues();
            const encabezadosFotos = datosCompletosFotos[0].map(h => typeof h === 'string' ? h.trim() : h);

            const pvIdColumnIndexFotos = encabezadosFotos.indexOf('pvID');
            const idRelacionIndex = (pvIdColumnIndexFotos !== -1) ? pvIdColumnIndexFotos : encabezadosFotos.indexOf(pConfig.dataIdColumnName);

            const linkFotoIndex = encabezadosFotos.indexOf(pConfig.photoLinkColumnName);
            const descFotoIndex = encabezadosFotos.indexOf('descripccion'); // typo en el script base mantenido por si acaso

            // Diagnóstico: Columnas faltantes
            if (idRelacionIndex === -1 || linkFotoIndex === -1) {
                hojaDestino.getRange(primerCeldaDiagnostico).setValue(`⚠️ ERROR FOTOS: Faltan columnas clave (ID o Link)`).setFontColor('red').setFontStyle('italic');
                return totalFilasInsertadas;
            }

            const fotosEncontradas = datosCompletosFotos.slice(1).filter(fila =>
                fila[idRelacionIndex] != null && fila[idRelacionIndex].toString().trim() === pvId.toString().trim() &&
                fila[linkFotoIndex] && typeof fila[linkFotoIndex] === 'string' && fila[linkFotoIndex].startsWith('http')
            );

            // Diagnóstico: Sin fotos vinculadas
            if (fotosEncontradas.length === 0) {
                hojaDestino.getRange(primerCeldaDiagnostico).setValue(`⚠️ Sin fotos vinculadas`).setFontColor('#a64d79').setFontStyle('italic');
                return totalFilasInsertadas;
            }

            fotosEncontradas.forEach((fotoData, j) => {
                const chunkIndex = Math.floor(j / 4);
                const positionInChunk = j % 4;
                const photoRowForThisImage = basePhotoRow + (chunkIndex * 2);
                const descRowForThisImage = photoRowForThisImage + 1;

                if (chunkIndex > 0 && positionInChunk === 0) {
                    const insertAfterRow = photoRowForThisImage - 1;
                    hojaDestino.insertRowsAfter(insertAfterRow, 2);
                    totalFilasInsertadas += 2;

                    const formatSourcePhotoRow = basePhotoRow + ((chunkIndex - 1) * 2);
                    const formatSourceDescRow = formatSourcePhotoRow + 1;
                    const maxCols = hojaDestino.getMaxColumns();

                    const rangoOrigen = hojaDestino.getRange(formatSourcePhotoRow, 1, 2, maxCols);
                    const rangoDestino = hojaDestino.getRange(photoRowForThisImage, 1, 2, maxCols);
                    rangoOrigen.copyTo(rangoDestino, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

                    hojaDestino.setRowHeight(photoRowForThisImage, hojaDestino.getRowHeight(formatSourcePhotoRow));
                    hojaDestino.setRowHeight(descRowForThisImage, hojaDestino.getRowHeight(formatSourceDescRow));
                }

                const photoCol = pConfig.photoCells[positionInChunk].match(/[A-Z]+/)[0];
                const descCol = pConfig.descCells[positionInChunk].match(/[A-Z]+/)[0];
                const celdaFotoFinal = `${photoCol}${photoRowForThisImage}`;
                const celdaDescFinal = `${descCol}${descRowForThisImage}`;

                insertarImagenEnCelda(fotoData[linkFotoIndex], hojaDestino.getRange(celdaFotoFinal));
                if (descFotoIndex !== -1 && fotoData[descFotoIndex]) {
                    hojaDestino.getRange(celdaDescFinal).setValue(fotoData[descFotoIndex]);
                }
            });
        }
        return totalFilasInsertadas;
    } catch (e) {
        throw new Error(`Falla en sección '${config.sheetName}': ${e.message}`);
    }
}

function insertarImagenEnCelda(url, celda) {
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

// CUMPLE REGLA 3: Reciclaje de Carpetas
function buscarOCrearCarpetaReporte(hojaDatosGeneral, rowIndex, nombreReporte) {
    const headers = hojaDatosGeneral.getDataRange().getValues()[0].map(h => typeof h === 'string' ? h.trim() : h);
    const linkColIndex = headers.indexOf(COLUMNA_LINK_REPORTE);
    const linkReporteExistente = (linkColIndex !== -1 && rowIndex !== -1) ? hojaDatosGeneral.getRange(rowIndex, linkColIndex + 1).getValue() : '';
    let carpetaReporteIndividual = null;

    // Si existe link y es de Drive, vaciamos su contenido
    if (linkReporteExistente && typeof linkReporteExistente === 'string' && linkReporteExistente.includes('drive.google.com')) {
        try {
            const folderIdMatch = linkReporteExistente.match(/folders\/([a-zA-Z0-9_-]+)/);
            if (folderIdMatch) {
                const folderId = folderIdMatch[1];
                const carpetaExistente = DriveApp.getFolderById(folderId);
                const files = carpetaExistente.getFiles();
                while (files.hasNext()) { files.next().setTrashed(true); }
                const folders = carpetaExistente.getFolders();
                while (folders.hasNext()) { folders.next().setTrashed(true); }
                carpetaReporteIndividual = carpetaExistente;
            }
        } catch (e) {
            carpetaReporteIndividual = null;
        }
    }

    // Si no existe o falló el reciclaje, se crea una nueva
    if (!carpetaReporteIndividual) {
        const plantillaFile = DriveApp.getFileById(ID_PLANTILLA);
        const parentsIterator = plantillaFile.getParents();
        let carpetaContenedoraPlantilla = parentsIterator.hasNext() ? parentsIterator.next() : DriveApp.getRootFolder();

        const carpetasExistentes = carpetaContenedoraPlantilla.getFoldersByName(NOMBRE_CARPETA_RAIZ_REPORTES);
        let carpetaRaizReportes = carpetasExistentes.hasNext() ? carpetasExistentes.next() : carpetaContenedoraPlantilla.createFolder(NOMBRE_CARPETA_RAIZ_REPORTES);

        // Si quedó alguna huérfana con el mismo nombre se elimina para evitar duplicados
        const carpetasConMismoNombre = carpetaRaizReportes.getFoldersByName(nombreReporte);
        while (carpetasConMismoNombre.hasNext()) { carpetasConMismoNombre.next().setTrashed(true); }

        carpetaReporteIndividual = carpetaRaizReportes.createFolder(nombreReporte);
    }
    return carpetaReporteIndividual;
}

function procesarYColocarFotosGenerales(filaDatos, encabezados, hojaDestino) {
    hojaDestino.getRange('C23').clearContent();
    hojaDestino.getRange('AC23').clearContent();

    const indiceFoto1 = encabezados.indexOf('photos_link');
    const indiceFoto2 = encabezados.indexOf('photos_2_link');

    if (indiceFoto1 !== -1) insertarImagenEnCelda(filaDatos[indiceFoto1], hojaDestino.getRange('C23'));
    if (indiceFoto2 !== -1) insertarImagenEnCelda(filaDatos[indiceFoto2], hojaDestino.getRange('AC23'));
}

function procesarFirma(filaDatos, encabezados, hojaDestino) {
    const indiceFirma = encabezados.indexOf('link_firma');
    const indiceNombre = encabezados.indexOf('nombre');

    if (indiceFirma !== -1) {
        insertarImagenEnCelda(filaDatos[indiceFirma], hojaDestino.getRange('J125'));
    }
    if (indiceNombre !== -1) {
        hojaDestino.getRange('J126').setValue(filaDatos[indiceNombre]);
    }
}

// =================================================================
// --- UTILIDADES ---
// =================================================================
function limpiarPropiedadesEstado() {
    try {
        const sp = PropertiesService.getScriptProperties();
        sp.deleteAllProperties();
        borrarTriggersExistentes('procesarLoteSeccionesTrigger_510');
    } catch (e) { }
}

function borrarTriggersExistentes(nombreFuncionTrigger) {
    try {
        const allTriggers = ScriptApp.getProjectTriggers();
        for (const trigger of allTriggers) {
            if (trigger.getHandlerFunction() === nombreFuncionTrigger) {
                ScriptApp.deleteTrigger(trigger);
            }
        }
    } catch (e) { }
}

function probarAccesoALasBasesDeDatos() {
    const ui = SpreadsheetApp.getUi();
    let msg = '';
    try {
        const bdGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
        msg += `✅ BD General OK: ${bdGeneral.getName()}\n\n`;
    } catch (e) { msg += `❌ FALLÓ BD General: ${e.message}\n\n`; }
    try {
        const bdFotos = SpreadsheetApp.openById(ID_BD_FOTOS);
        msg += `✅ BD Fotos OK: ${bdFotos.getName()}`;
    } catch (e) { msg += `❌ FALLÓ BD Fotos: ${e.message}`; }
    ui.alert(msg);
}
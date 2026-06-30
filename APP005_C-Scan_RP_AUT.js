/**
 * =================================================================
 * --- ARCHIVO: ReporteMasivo_Excel.gs ---
 * =================================================================
 * Rol: Automatizador_app_sheets
 * Funcionalidades:
 * 1. UI HTML para seleccionar reportes pendientes (link_reporte vacío).
 * 2. Generación encadenada (Cola de trabajo) para múltiples IDs.
 * 3. Nombramiento estricto: id_general-equipo-ot.
 * 4. Almacenamiento en carpeta "REPORTES" en la raíz del archivo.
 * 5. Mapeos completos integrados.
 */

// =================================================================
// CONFIGURACIÓN PRINCIPAL
// =================================================================
const ID_BD_GENERAL = SpreadsheetApp.getActiveSpreadsheet().getId();
const NOMBRE_HOJA_FORMATO = "FORMAT";
const NOMBRE_HOJA_ACTIVADORA = "1.0_general";
const COLUMNA_PVID = "id_general";
const COLUMNA_EQUIPO = "equipo";
const COLUMNA_OT = "ot";
const COLUMNA_LINK_REPORTE = "link_reporte";
const NOMBRE_CARPETA_REPORTES = "REPORTES";

// --- MAPEO DE LA TABLA MADRE (1.0_general) ---
const MAPEO_DE_CELDAS = {
    'cliente': 'D7', 'fecha': 'J7', 'reporte_n': 'Q7', 'estacion': 'V7',
    'contrato': 'D8', 'ot': 'J8', 'zona': 'Q8', 'sistema': 'V8',
    'equipo': 'D9', 'fluido': 'J9', 'material': 'Q9', 'norma': 'V9',
    'inicio_inspeccion': 'D13', 'acoplante': 'J13', 'estado_superficial': 'R13',
    'marca_equipo': 'V13', 'fin_inspeccion': 'D14', 'rango_espesores': 'J14',
    'temperatura_superficie': 'R14', 'modelo': 'V14', 'serie': 'D15',
    'tipo_palpador': 'J15', 'frecuencia': 'O15', 'tamano': 'R15', 'fecha_calibracion': 'V15',
    'nombre': 'D36', 'cargo': 'D37', 'certificado': 'D38', 'fecha_firma': 'D40'
};

// --- CONFIGURACIÓN DE TABLAS HIJAS ---
const SECTIONS_CONFIG = {
    reporte_datos: {
        sheetName: '2.0_reporte',
        dataStartRow: 21,
        mapping: {
            'id_punto': 'A21', 'sistema_o_linea': 'B21', 'cml': 'D21',
            'diametro_in': 'E21', 'tipo_accesorio': 'F21', 'dja_mm': 'G21',
            'posicion_horario_inicial': 'J21', 'posicion_horario_final': 'K21',
            'longitud_barrido_circunferencial_mm': 'L21', 'longitud_barrido_longitudinal_mm': 'M21',
            'area_barrido': 'N21', 'numero_barridos': 'O21', 'tipo_evaluacion': 'P21',
            'posicion_horario_soldadura_longitudinal': 'Q21', 'espesor_nominal_mm': 'R21',
            'espesor_promedio_mm': 'S21', 'espesor_minimo_mm': 'T21',
            'perdida_basada_en_minimo': 'U21', 'perdida_basada_en_promedio': 'V21',
            'observaciones': 'W21'
        },
        photosConfig: null
    },
    ensayo_datos: {
        sheetName: '2.1_ensayo',
        dataStartRow: 27,
        mapping: {
            'id_punto': 'A27', 'seg': 'B27', 'cml': 'C27', 'diametro_in': 'D27',
            'dja_mm': 'E27', 'posicion_horario': 'G27', 'longitud_mm': 'I27',
            'ancho_mm': 'J27', 'espesor_minimo_medido_mm': 'K27',
            'interaccion_costura': 'M27', 'tipo_anomalia': 'O27',
            'porcentaje_perdida': 'Q27', 'observaciones': 'S27'
        },
        photosConfig: null
    },
    fotos_reporte: {
        sheetName: 'dummy_no_usar',
        dataStartRow: 32,
        mapping: {},
        photosConfig: {
            photoSheetName: '2.0_reporte_photos',
            idColumnName: 'id_general',
            photoLinkColumnName: 'link_imagen',
            photoCells: ['A32', 'G32', 'M32', 'S32'],
            descCells: ['A33', 'G33', 'M33', 'S33']
        }
    }
};

// --- VARIABLES GLOBALES DE ESTADO PARA LA COLA ---
const SECCIONES_POR_LOTE = 5;
const PROP_JOB_QUEUE = 'JOB_QUEUE';
const PROP_VALOR_BUSCADO = 'VALOR_BUSCADO';
const PROP_START_INDEX = 'START_INDEX';
const PROP_TOTAL_FILAS_INSERTADAS = 'TOTAL_FILAS_INSERTADAS';
const PROP_REPORTE_ID = 'REPORTE_ID';
const PROP_NOMBRE_REPORTE = 'NOMBRE_REPORTE';
const PROP_SECTION_KEYS = 'SECTION_KEYS';

/**
 * -----------------------------------------------------------------
 * PARTE 1: MENÚ E INTERFAZ GRÁFICA (UI)
 * -----------------------------------------------------------------
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Automatizador AppSheet')
        .addItem('1. Generar Reportes Masivos', 'mostrarPanelSelector')
        .addToUi();
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
  <h2>🚀 Selector de Reportes C-Scan</h2>
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
        .obtenerReportesPendientes();
    };
    function renderList(data) {
      const container = document.getElementById('list-container');
      if (!data.length) { container.innerHTML = "<div class='loading'>No hay reportes pendientes.</div>"; return; }
      container.innerHTML = data.map(item => {
        return '<label class="item"><input type="checkbox" class="chk-id" value="' + item.id + '" checked><span>' + item.id + '</span><span class="badge bg-pending">Pendiente</span></label>';
      }).join('');
    }
    function seleccionar(estado) { document.querySelectorAll('.chk-id').forEach(c => c.checked = estado); }
    function seleccionarPendientes() { document.querySelectorAll('.chk-id').forEach(c => c.checked = true); }
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
        .iniciarColaDeGeneracion(ids);
    }
  </script>
</body>
</html>
  `;
    const htmlOutput = HtmlService.createHtmlOutput(htmlContent).setWidth(450).setHeight(550);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Gestor de Reportes C-Scan');
}

function obtenerReportesPendientes() {
    const sheet = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => typeof h === 'string' ? h.trim() : h);

    const idxId = headers.indexOf(COLUMNA_PVID);
    const idxEq = headers.indexOf(COLUMNA_EQUIPO);
    const idxOt = headers.indexOf(COLUMNA_OT);
    const idxLink = headers.indexOf(COLUMNA_LINK_REPORTE);

    if (idxId === -1 || idxLink === -1) return [];

    const pendientes = [];
    for (let i = 1; i < data.length; i++) {
        if (data[i][idxId] && (!data[i][idxLink] || data[i][idxLink].toString().trim() === '')) {
            pendientes.push({
                id: data[i][idxId].toString(),
                equipo: idxEq !== -1 ? (data[i][idxEq] || 'N/A') : 'N/A',
                ot: idxOt !== -1 ? (data[i][idxOt] || 'N/A') : 'N/A'
            });
        }
    }
    return pendientes;
}

/**
 * -----------------------------------------------------------------
 * PARTE 2: GESTIÓN DE LA COLA DE TRABAJO (QUEUE)
 * -----------------------------------------------------------------
 */
function iniciarColaDeGeneracion(listaIds) {
    if (!listaIds || listaIds.length === 0) return;

    limpiarPropiedadesEstado();
    borrarTriggersExistentes('procesarLoteSeccionesTrigger');

    const scriptProperties = PropertiesService.getScriptProperties();
    scriptProperties.setProperty(PROP_JOB_QUEUE, JSON.stringify(listaIds));

    prepararSiguienteTrabajo();
}

function prepararSiguienteTrabajo() {
    const scriptProperties = PropertiesService.getScriptProperties();
    const queueStr = scriptProperties.getProperty(PROP_JOB_QUEUE);
    if (!queueStr) return;

    const queue = JSON.parse(queueStr);
    if (queue.length === 0) {
        limpiarPropiedadesEstado();
        return;
    }

    const siguienteId = queue.shift();
    scriptProperties.setProperty(PROP_JOB_QUEUE, JSON.stringify(queue));

    scriptProperties.setProperty(PROP_VALOR_BUSCADO, siguienteId);
    scriptProperties.setProperty(PROP_START_INDEX, '0');
    scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, '0');
    scriptProperties.deleteProperty(PROP_REPORTE_ID);
    scriptProperties.deleteProperty(PROP_NOMBRE_REPORTE);

    ScriptApp.newTrigger('procesarLoteSeccionesTrigger').timeBased().after(2000).create();
}

/**
 * -----------------------------------------------------------------
 * PARTE 3: EL TRABAJADOR PRINCIPAL (TRIGGER)
 * -----------------------------------------------------------------
 */
function procesarLoteSeccionesTrigger() {
    const scriptProperties = PropertiesService.getScriptProperties();
    let estado = {};

    try {
        estado.valorBuscado = scriptProperties.getProperty(PROP_VALOR_BUSCADO);
        if (!estado.valorBuscado) { borrarTriggerActual('procesarLoteSeccionesTrigger'); return; }

        estado.startIndex = parseInt(scriptProperties.getProperty(PROP_START_INDEX) || '0');
        estado.totalFilasInsertadasGlobal = parseInt(scriptProperties.getProperty(PROP_TOTAL_FILAS_INSERTADAS) || '0');
        estado.reporteId = scriptProperties.getProperty(PROP_REPORTE_ID);
        estado.nombreReporte = scriptProperties.getProperty(PROP_NOMBRE_REPORTE);

        let sectionKeysStr = scriptProperties.getProperty(PROP_SECTION_KEYS);
        estado.sectionKeys = sectionKeysStr ? JSON.parse(sectionKeysStr) : Object.keys(SECTIONS_CONFIG);

        let spreadsheetDatosGeneral, nuevoReporteSpreadsheet, hojaFormatoDestino;

        if (estado.startIndex === 0 && !estado.reporteId) {
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            const hojaDatosGeneral = spreadsheetDatosGeneral.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
            const datosCompletos = hojaDatosGeneral.getDataRange().getValues();
            const encabezados = datosCompletos[0].map(h => typeof h === 'string' ? h.trim() : h);

            const idxId = encabezados.indexOf(COLUMNA_PVID);
            const idxEquipo = encabezados.indexOf(COLUMNA_EQUIPO);
            const idxOt = encabezados.indexOf(COLUMNA_OT);

            let filaDatos = null;
            for (let i = 1; i < datosCompletos.length; i++) {
                if (datosCompletos[i][idxId] != null && datosCompletos[i][idxId].toString().trim() === estado.valorBuscado) {
                    filaDatos = datosCompletos[i];
                    break;
                }
            }
            if (!filaDatos) throw new Error(`ID ${estado.valorBuscado} no encontrado.`);

            // NOMBRE: id_general-equipo-ot
            const equipoStr = (idxEquipo !== -1 && filaDatos[idxEquipo]) ? filaDatos[idxEquipo] : 'SinEquipo';
            const otStr = (idxOt !== -1 && filaDatos[idxOt]) ? filaDatos[idxOt] : 'SinOT';
            estado.nombreReporte = `${estado.valorBuscado}-${equipoStr}-${otStr}`;

            nuevoReporteSpreadsheet = SpreadsheetApp.create("TEMP_" + estado.nombreReporte);
            estado.reporteId = nuevoReporteSpreadsheet.getId();

            const hojaFormatoPlantilla = spreadsheetDatosGeneral.getSheetByName(NOMBRE_HOJA_FORMATO);
            if (!hojaFormatoPlantilla) throw new Error(`Falta pestaña '${NOMBRE_HOJA_FORMATO}'.`);

            hojaFormatoDestino = hojaFormatoPlantilla.copyTo(nuevoReporteSpreadsheet).setName(NOMBRE_HOJA_FORMATO);
            if (nuevoReporteSpreadsheet.getSheetByName('Hoja 1')) nuevoReporteSpreadsheet.deleteSheet(nuevoReporteSpreadsheet.getSheetByName('Hoja 1'));

            // Llenado de tabla principal (1.0_general)
            for (const col in MAPEO_DE_CELDAS) {
                const celda = MAPEO_DE_CELDAS[col];
                const idx = encabezados.indexOf(col);
                if (idx !== -1) hojaFormatoDestino.getRange(celda).setValue(filaDatos[idx]);
            }

            // Procesar Firma
            const idxFirma = encabezados.indexOf('link_firma');
            if (idxFirma !== -1 && filaDatos[idxFirma]) {
                insertarImagenEnCelda_Excel(filaDatos[idxFirma], hojaFormatoDestino.getRange('D39'));
            }

            scriptProperties.setProperty(PROP_SECTION_KEYS, JSON.stringify(estado.sectionKeys));
            scriptProperties.setProperty(PROP_REPORTE_ID, estado.reporteId);
            scriptProperties.setProperty(PROP_NOMBRE_REPORTE, estado.nombreReporte);
        } else {
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            nuevoReporteSpreadsheet = SpreadsheetApp.openById(estado.reporteId);
            hojaFormatoDestino = nuevoReporteSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
        }

        const indiceFinLote = Math.min(estado.startIndex + SECCIONES_POR_LOTE, estado.sectionKeys.length);
        for (let i = estado.startIndex; i < indiceFinLote; i++) {
            const key = estado.sectionKeys[i];
            const config = SECTIONS_CONFIG[key];
            if (config) {
                const filasInsertadas = processSection_Excel(estado.valorBuscado, spreadsheetDatosGeneral, hojaFormatoDestino, config, estado.totalFilasInsertadasGlobal);
                estado.totalFilasInsertadasGlobal += filasInsertadas;
            }
        }

        if (indiceFinLote < estado.sectionKeys.length) {
            scriptProperties.setProperty(PROP_START_INDEX, indiceFinLote.toString());
            scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, estado.totalFilasInsertadasGlobal.toString());
            ScriptApp.newTrigger('procesarLoteSeccionesTrigger').timeBased().after(2000).create();
        } else {
            // FIN DEL REPORTE - Exportación
            SpreadsheetApp.flush();

            const urlExport = "https://docs.google.com/spreadsheets/d/" + estado.reporteId + "/export?format=xlsx";
            const token = ScriptApp.getOAuthToken();
            const response = UrlFetchApp.fetch(urlExport, { headers: { 'Authorization': 'Bearer ' + token } });
            const blobExcel = response.getBlob().setName(estado.nombreReporte + '.xlsx');

            const carpetaDestino = obtenerOCrearCarpetaReportes();

            const archivosExistentes = carpetaDestino.getFilesByName(estado.nombreReporte + '.xlsx');
            while (archivosExistentes.hasNext()) archivosExistentes.next().setTrashed(true);

            const archivoExcelFinal = carpetaDestino.createFile(blobExcel);
            const urlExcelFinal = archivoExcelFinal.getUrl();

            DriveApp.getFileById(estado.reporteId).setTrashed(true);

            // Guardar Link en BD
            try {
                const hojaBD = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
                const datos = hojaBD.getDataRange().getValues();
                const headers = datos[0].map(h => typeof h === 'string' ? h.trim() : h);
                const idCol = headers.indexOf(COLUMNA_PVID);
                const linkCol = headers.indexOf(COLUMNA_LINK_REPORTE);

                if (idCol !== -1 && linkCol !== -1) {
                    for (let i = 1; i < datos.length; i++) {
                        if (datos[i][idCol] != null && datos[i][idCol].toString().trim() === estado.valorBuscado) {
                            hojaBD.getRange(i + 1, linkCol + 1).setValue(urlExcelFinal);
                            break;
                        }
                    }
                }
            } catch (e) { Logger.log("Error guardando link: " + e); }

            borrarTriggerActual('procesarLoteSeccionesTrigger');
            prepararSiguienteTrabajo();
        }

    } catch (e) {
        Logger.log(`Error Procesando ID ${estado.valorBuscado}: ${e.stack}`);
        borrarTriggerActual('procesarLoteSeccionesTrigger');
        prepararSiguienteTrabajo();
    }
}

/**
 * -----------------------------------------------------------------
 * PARTE 4: PROCESAMIENTO POR SECCIÓN Y FOTOS
 * -----------------------------------------------------------------
 */
function processSection_Excel(pvId, spreadsheetDatos, hojaDestino, config, filasInsertadasPreviamente) {
    let totalFilasInsertadas = 0;

    if (config.sheetName !== 'dummy_no_usar') {
        const hojaSeccion = spreadsheetDatos.getSheetByName(config.sheetName);
        if (hojaSeccion) {
            const datosCompletos = hojaSeccion.getDataRange().getValues();
            const encabezados = datosCompletos[0].map(h => typeof h === 'string' ? h.trim() : h);
            const indicePvId = encabezados.indexOf(COLUMNA_PVID);

            if (indicePvId !== -1) {
                const registros = datosCompletos.slice(1).filter(fila => fila[indicePvId] != null && fila[indicePvId].toString().trim() == pvId);
                const filaInicioDatos = config.dataStartRow + filasInsertadasPreviamente;

                if (registros.length > 1) {
                    const filasAInsertar = registros.length - 1;
                    hojaDestino.insertRowsAfter(filaInicioDatos, filasAInsertar);
                    const rangoBase = hojaDestino.getRange(filaInicioDatos, 1, 1, hojaDestino.getMaxColumns());
                    rangoBase.copyTo(hojaDestino.getRange(filaInicioDatos + 1, 1, filasAInsertar, hojaDestino.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
                    totalFilasInsertadas = filasAInsertar;
                }

                registros.forEach((registroActual, i) => {
                    const filaDestino = filaInicioDatos + i;
                    for (const col in config.mapping) {
                        const celdaOriginal = config.mapping[col];
                        const colLetra = celdaOriginal.match(/[A-Z]+/)[0];
                        const idx = encabezados.indexOf(col);
                        if (idx !== -1) hojaDestino.getRange(`${colLetra}${filaDestino}`).setValue(registroActual[idx]);
                    }
                });
            }
        }
    }

    if (config.photosConfig) {
        const pConfig = config.photosConfig;
        const hojaFotos = spreadsheetDatos.getSheetByName(pConfig.photoSheetName);
        if (hojaFotos) {
            const datosFotos = hojaFotos.getDataRange().getValues();
            const headF = datosFotos[0].map(h => typeof h === 'string' ? h.trim() : h);
            const idColF = headF.indexOf(pConfig.idColumnName);
            const urlColF = headF.indexOf(pConfig.photoLinkColumnName);
            const descColF = headF.indexOf('descripcion_foto');

            if (idColF !== -1 && urlColF !== -1) {
                const fotos = datosFotos.slice(1).filter(f => f[idColF] != null && f[idColF].toString().trim() == pvId && f[urlColF] && f[urlColF].toString().startsWith('http'));
                if (fotos.length > 0) {
                    const baseRow = config.dataStartRow + filasInsertadasPreviamente + totalFilasInsertadas;

                    fotos.forEach((foto, j) => {
                        const chunk = Math.floor(j / pConfig.photoCells.length);
                        const pos = j % pConfig.photoCells.length;
                        const filaFoto = baseRow + (chunk * 2);
                        const filaDesc = filaFoto + 1;

                        if (chunk > 0 && pos === 0) {
                            hojaDestino.insertRowsAfter(filaFoto - 1, 2);
                            totalFilasInsertadas += 2;
                            const srcR = filaFoto - 2;
                            hojaDestino.getRange(srcR, 1, 2, hojaDestino.getMaxColumns()).copyTo(hojaDestino.getRange(filaFoto, 1, 2, hojaDestino.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
                            hojaDestino.setRowHeight(filaFoto, hojaDestino.getRowHeight(srcR));
                            hojaDestino.setRowHeight(filaDesc, hojaDestino.getRowHeight(srcR + 1));
                        }

                        const colP = pConfig.photoCells[pos].match(/[A-Z]+/)[0];
                        const colD = pConfig.descCells[pos].match(/[A-Z]+/)[0];
                        insertarImagenEnCelda_Excel(foto[urlColF], hojaDestino.getRange(`${colP}${filaFoto}`));
                        if (descColF !== -1 && foto[descColF]) hojaDestino.getRange(`${colD}${filaDesc}`).setValue(foto[descColF]);
                    });
                }
            }
        }
    }
    return totalFilasInsertadas;
}

/**
 * -----------------------------------------------------------------
 * PARTE 5: UTILIDADES Y CARPETAS
 * -----------------------------------------------------------------
 */
function obtenerOCrearCarpetaReportes() {
    const file = DriveApp.getFileById(ID_BD_GENERAL);
    const parents = file.getParents();
    let parentFolder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

    const folders = parentFolder.getFoldersByName(NOMBRE_CARPETA_REPORTES);
    if (folders.hasNext()) {
        return folders.next();
    } else {
        return parentFolder.createFolder(NOMBRE_CARPETA_REPORTES);
    }
}

function insertarImagenEnCelda_Excel(url, celda) {
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

function borrarTriggerActual(funcName) {
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === funcName) ScriptApp.deleteTrigger(t); });
}

function borrarTriggersExistentes(funcName) { borrarTriggerActual(funcName); }

function limpiarPropiedadesEstado() {
    ['JOB_QUEUE', 'VALOR_BUSCADO', 'START_INDEX', 'TOTAL_FILAS_INSERTADAS', 'SECTION_KEYS', 'REPORTE_ID', 'NOMBRE_REPORTE'].forEach(p => PropertiesService.getScriptProperties().deleteProperty(p));
}
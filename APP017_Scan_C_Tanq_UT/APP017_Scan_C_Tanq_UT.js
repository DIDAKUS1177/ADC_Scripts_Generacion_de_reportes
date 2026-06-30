/**
 * =================================================================
 * --- ARCHIVO: ReporteAutomatizado_Excel.gs (NUEVO FORMATO) ---
 * =================================================================
 * Rol: Automatizador_app_sheets
 * Genera reportes exportados a EXCEL usando la pestaña "FORMAT" local.
 * NOTIFICACIÓN: Ventana emergente (Alert) al finalizar (Sin correos).
 * @author  Diego Alejandro Hernandez Blanco
 */

const ID_BD_GENERAL = SpreadsheetApp.getActiveSpreadsheet().getId();
const NOMBRE_HOJA_FORMATO = "FORMAT"; // Asegúrate de que tu pestaña base en Sheets se llame así
const NOMBRE_HOJA_ACTIVADORA = "1.0_general";
const COLUMNA_PVID = "id_general";
const COLUMNA_LINK_REPORTE = "link_reporte";
const NOMBRE_CARPETA_REPORTES = "reportes";

// --- 1. MAPEO DE LA TABLA MADRE (1.0_general) ---
const MAPEO_DE_CELDAS = {
    'cliente': 'D7',
    'fecha': 'J7',
    'reporte_n': 'Q7',
    'estacion': 'V7',
    'contrato': 'D8',
    'ot': 'J8',
    'zona': 'Q8',
    'sistema': 'V8',
    'equipo': 'D9',
    'fluido': 'J9',
    'material': 'Q9',
    'norma': 'V9',
    'inicio_inspeccion': 'D13',
    'acoplante': 'J13',
    'estado_superficial': 'R13',
    'marca_equipo': 'V13',
    'fin_inspeccion': 'D14',
    'rango_espesores': 'J14',
    'temperatura_superficie': 'R14',
    'modelo': 'V14',
    'serie': 'D15',
    'tipo_palpador': 'J15',
    'frecuencia': 'O15',
    'tamano': 'R15',
    'Fecha_calibracion_equipo': 'V15',
    'nombre': 'D36',
    'cargo': 'D37',
    'certificado': 'D38',
    'fecha_firma': 'D40' // Fecha vinculada a la firma
};

// --- 2. CONFIGURACIÓN DE TABLAS HIJAS ---
const SECTIONS_CONFIG = {
    reporte_datos: {
        sheetName: '2.0_reporte',
        dataStartRow: 21, 
        mapping: { 
            'id_punto': 'A21',
            'anillo': 'B21',
            'lamina': 'C21',
            'cml': 'D21',
            'diametro_in': 'E21',
            'tipo_accesorio': 'F21',
            'superior': 'G21',
            'inferior': 'H21',
            'izquierda': 'I21',
            'derecha': 'J21',
            'barrido': 'K21',
            'longitud_barrido_circunferencial_mm': 'L21',
            'longitud_barrido_longitudinal_mm': 'M21',
            'area_barrido': 'N21',
            'numero_barridos': 'O21',
            'tipo_evaluacion': 'P21',
            'espesor_nominal_mm': 'Q21',
            'espesor_promedio_mm': 'R21',
            'espesor_minimo_mm': 'S21',
            'perdida_basada_en_minimo': 'T21',
            'perdida_basada_en_promedio': 'U21',
            'observaciones': 'V21'
        },
        photosConfig: null 
    },
    ensayo_datos: {
        sheetName: '2.1_ensayo',
        dataStartRow: 27, 
        mapping: {
            'id_punto': 'A27',
            'seg': 'B27',
            'cml': 'C27',
            'diametro_in': 'D27',
            'dja_mm': 'E27',
            'posicion_horario': 'G27',
            'longitud_mm': 'I27',
            'ancho_mm': 'J27',
            'espesor_minimo_medido_mm': 'K27',
            'interaccion_costura': 'M27',
            'tipo_anomalia': 'O27',
            'porcentaje_perdida': 'Q27',
            'observaciones': 'S27'
        },
        photosConfig: null
    },
    reporte_fotos: {
        sheetName: 'dummy_no_usar_datos', // No mapea datos de celdas simples, solo busca fotos
        dataStartRow: 32, 
        mapping: {},
        photosConfig: { 
            photoSheetName: '2.0_reporte_photos', 
            idColumnName: 'id_general', 
            photoLinkColumnName: 'link_imagen', 
            descColumnName: 'descripcion_foto',
            photoCells: ['A32', 'G32', 'M32', 'S32'], 
            descCells: ['A33', 'G33', 'M33', 'S33'] 
        }
    }
};


/**
 * -----------------------------------------------------------------
 * PARTE 1: ACTIVACIÓN DESDE EL MENÚ
 * -----------------------------------------------------------------
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Reportes Scan C Tank UT')
        .addItem('1. 📄 Generar reporte por ID (manual)', 'generarPorIdManual')
        .addItem('2. 🚀 Generar reportes (selección múltiple)', 'mostrarPanelSelectorMasivo')
        .addItem('3. ⏳ Generar todos los pendientes', 'generarTodosPendientes')
        .addSeparator()
        .addItem('🗑️ Limpiar cola / reiniciar disparadores', 'limpiarColaDisparo')
        .addToUi();
}

function mostrarPanelDeEntrada_Excel() {
    const htmlTemplate =
        '<!DOCTYPE html>' +
        '<html><head><base target="_top"><style>' +
        'body{font-family:"Segoe UI",sans-serif;padding:15px;color:#333}' +
        'h2{text-align:center;color:#1565c0;font-size:18px;margin-top:0}' +
        '.controls{display:flex;justify-content:space-between;margin-bottom:10px}' +
        '.controls button{background:#e0e0e0;color:#333;border:none;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:12px}' +
        '.controls button:hover{background:#d5d5d5}' +
        '#list-container{max-height:250px;overflow-y:auto;border:1px solid #ccc;padding:10px;border-radius:5px;background:#fafafa;margin-bottom:15px}' +
        '.item{display:flex;align-items:center;margin-bottom:8px;font-size:13px}' +
        '.item input{margin-right:8px;cursor:pointer;width:16px;height:16px}' +
        '.badge{margin-left:auto;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold}' +
        '.bg-pending{background-color:#ffebee;color:#c62828}' +
        '.bg-done{background-color:#e8f5e9;color:#2e7d32}' +
        '#status-box{display:none;border:2px solid #e0e0e0;border-radius:8px;padding:10px;background:#fff;margin-bottom:15px}' +
        '#progress-text{font-size:18px;font-weight:bold;color:#2e7d32;text-align:center;margin-bottom:5px}' +
        '#log{font-size:11px;color:#555;max-height:80px;overflow-y:auto}' +
        '.btn-primary{width:100%;background:#1976d2;color:white;border:none;padding:12px;cursor:pointer;border-radius:4px;font-size:14px;font-weight:bold;transition:0.3s}' +
        '.btn-primary:hover{background:#1565c0}' +
        '.loading{text-align:center;padding:20px;font-style:italic;color:#666}' +
        '</style></head><body>' +
        '<h2>Selector de Reportes Scan C Tank</h2>' +
        '<div id="selection-area">' +
        '<div class="controls">' +
        '<button onclick="seleccionar(true)">✔ Todos</button>' +
        '<button onclick="seleccionar(false)">✖ Ninguno</button>' +
        '<button onclick="seleccionarPendientes()">⏳ Pendientes</button>' +
        '</div>' +
        '<div id="list-container"><div class="loading">Cargando identificadores...</div></div>' +
        '<button class="btn-primary" onclick="iniciarGeneracion()">Generar seleccionados</button>' +
        '</div>' +
        '<div id="status-box">' +
        '<div id="progress-text">0 / 0</div>' +
        '<div id="log"></div>' +
        '</div>' +
        '<button id="btn-close" class="btn-primary" style="display:none;" onclick="google.script.host.close()">Cerrar ventana</button>' +
        '<script>' +
        'var toProcess=[],currentIndex=0;' +
        'window.onload=function(){' +
        'google.script.run.withSuccessHandler(renderList).withFailureHandler(function(err){alert("Error: "+err.message)}).obtenerIdsInfo();' +
        '};' +
        'function renderList(data){' +
        'var c=document.getElementById("list-container");' +
        'if(!data.length){c.innerHTML="<div class=\'loading\'>No se encontraron registros.</div>";return;}' +
        'c.innerHTML=data.map(function(item){' +
        'var bc=item.status==="Pendiente"?"bg-pending":"bg-done";' +
        'var ch=item.status==="Pendiente"?"checked":"";' +
        'return"<label class=\'item\'><input type=\'checkbox\' class=\'chk-id\' value=\'"+item.id+"\' "+ch+"><span>"+item.id+"</span><span class=\'badge "+bc+"\'>"+item.status+"</span></label>";' +
        '}).join("");' +
        '}' +
        'function seleccionar(e){document.querySelectorAll(".chk-id").forEach(function(c){c.checked=e;});}' +
        'function seleccionarPendientes(){document.querySelectorAll(".chk-id").forEach(function(c){c.checked=c.parentElement.querySelector(".badge").innerText==="Pendiente";});}' +
        'function iniciarGeneracion(){' +
        'toProcess=Array.from(document.querySelectorAll(".chk-id:checked")).map(function(c){return c.value;});' +
        'if(!toProcess.length){alert("Selecciona al menos un ID.");return;}' +
        'document.getElementById("selection-area").style.display="none";' +
        'document.getElementById("status-box").style.display="block";' +
        'currentIndex=0;actualizarProgreso();' +
        'logMsg("Iniciando "+toProcess.length+" reportes...");' +
        'procesarSiguiente();' +
        '}' +
        'function procesarSiguiente(){' +
        'if(currentIndex>=toProcess.length){' +
        'document.getElementById("progress-text").innerText="Completado!";' +
        'document.getElementById("btn-close").style.display="block";' +
        'logMsg("Proceso finalizado.");return;' +
        '}' +
        'var id=toProcess[currentIndex];' +
        'logMsg("Procesando: <b>"+id+"</b>...");' +
        'google.script.run' +
        '.withSuccessHandler(function(url){logMsg("<span style=\'color:green;\'>OK: "+id+"</span>");currentIndex++;actualizarProgreso();procesarSiguiente();})' +
        '.withFailureHandler(function(err){logMsg("<span style=\'color:red;\'>Error en "+id+": "+err.message+"</span>");currentIndex++;actualizarProgreso();procesarSiguiente();})' +
        '.procesarUnReporteYGuardar(id);' +
        '}' +
        'function actualizarProgreso(){document.getElementById("progress-text").innerText=currentIndex+" / "+toProcess.length;}' +
        'function logMsg(msg){var d=document.getElementById("log");d.innerHTML+="<div>"+msg+"</div>";d.scrollTop=d.scrollHeight;}' +
        '<\/script></body></html>';
    SpreadsheetApp.getUi().showModalDialog(
        HtmlService.createHtmlOutput(htmlTemplate).setWidth(420).setHeight(550),
        'Generador de Reportes Scan C Tank'
    );
}

function obtenerIdsInfo() {
    const hoja = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
    const datos = hoja.getDataRange().getValues();
    const enc = datos[0].map(function(h){ return String(h).trim().toLowerCase(); });
    const iId   = enc.indexOf(COLUMNA_PVID.toLowerCase());
    const iLink = enc.indexOf(COLUMNA_LINK_REPORTE.toLowerCase());
    if (iId === -1) throw new Error("No se encontro la columna '" + COLUMNA_PVID + "'.");
    const resultado = [];
    for (let i = 1; i < datos.length; i++) {
        const id   = String(datos[i][iId]).trim();
        const link = iLink !== -1 ? String(datos[i][iLink]).trim() : '';
        if (id && id !== 'undefined') resultado.push({ id: id, status: link ? 'Generado' : 'Pendiente' });
    }
    return resultado;
}

function procesarUnReporteYGuardar(id) {
    return generarReporteCompletoSync(id, true);
}


/**
 * -----------------------------------------------------------------
 * PARTE 2: LÓGICA PRINCIPAL (SINCRÓNICA)
 * -----------------------------------------------------------------
 */
function generarReporteCompletoSync(valorBuscado, silencioso) {
    const ui = SpreadsheetApp.getUi();
    let tempSpreadsheetId = null;

    try {
        const spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
        const hojaDatosGeneral = spreadsheetDatosGeneral.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
        
        if (!hojaDatosGeneral) throw new Error(`No se encontró la pestaña base: ${NOMBRE_HOJA_ACTIVADORA}`);

        const datosCompletos = hojaDatosGeneral.getDataRange().getValues();
        const encabezados = datosCompletos[0].map(h => typeof h === 'string' ? h.trim() : h);
        const idxId = encabezados.indexOf(COLUMNA_PVID);
        
        let filaDatos = null;
        for (let i = 1; i < datosCompletos.length; i++) {
            if (datosCompletos[i][idxId] != null && datosCompletos[i][idxId].toString().trim() === valorBuscado) {
                filaDatos = datosCompletos[i];
                break;
            }
        }
        if (!filaDatos) throw new Error(`El ID '${valorBuscado}' no se encontró en la base de datos.`);

        // --- 1. Crear Archivo Temporal ---
        const fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
        const clienteStr = filaDatos[encabezados.indexOf('cliente')] || 'CLIENTE';
        const otStr = filaDatos[encabezados.indexOf('ot')] || 'OT';
        const nombreReporte = `Reporte_${clienteStr}_${otStr}_${valorBuscado}_${fechaHora}`;

        const nuevoReporteSpreadsheet = SpreadsheetApp.create("TEMP_" + nombreReporte);
        tempSpreadsheetId = nuevoReporteSpreadsheet.getId();

        const hojaFormatoPlantilla = spreadsheetDatosGeneral.getSheetByName(NOMBRE_HOJA_FORMATO);
        if (!hojaFormatoPlantilla) throw new Error(`No se encontró la pestaña de plantilla: ${NOMBRE_HOJA_FORMATO}`);

        const hojaFormatoDestino = hojaFormatoPlantilla.copyTo(nuevoReporteSpreadsheet).setName(NOMBRE_HOJA_FORMATO);
        const hojaDefecto = nuevoReporteSpreadsheet.getSheetByName('Hoja 1') || nuevoReporteSpreadsheet.getSheetByName('Sheet1');
        if(hojaDefecto) nuevoReporteSpreadsheet.deleteSheet(hojaDefecto);

        // --- 2. Mapeo Datos Generales ---
        for (const col in MAPEO_DE_CELDAS) {
            const celda = MAPEO_DE_CELDAS[col];
            const idx = encabezados.indexOf(col);
            if (idx !== -1) hojaFormatoDestino.getRange(celda).setValue(filaDatos[idx]);
        }

        // --- 3. Firma Principal ---
        const idxFirma = encabezados.indexOf('link_firma');
        if (idxFirma !== -1 && filaDatos[idxFirma]) {
            insertarImagenEnCelda_Excel(filaDatos[idxFirma], hojaFormatoDestino.getRange('D39')); // Celda explícita de la firma
        }

        // --- 4. Procesar Tablas Hijas ---
        let totalFilasInsertadasGlobal = 0;
        for (const key in SECTIONS_CONFIG) {
            const config = SECTIONS_CONFIG[key];
            const filasInsertadas = processSection_Excel(valorBuscado, spreadsheetDatosGeneral, hojaFormatoDestino, config, totalFilasInsertadasGlobal);
            totalFilasInsertadasGlobal += filasInsertadas;
        }

        SpreadsheetApp.flush(); 

        // --- 5. Exportar a Excel y Guardar en Carpeta ---
        const urlExport = "https://docs.google.com/spreadsheets/d/" + tempSpreadsheetId + "/export?format=xlsx";
        const token = ScriptApp.getOAuthToken();
        const response = UrlFetchApp.fetch(urlExport, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const blobExcel = response.getBlob().setName(nombreReporte + '.xlsx');
        
        const carpetaDestino = obtenerOCrearCarpetaReportes();
        const archivoExcelFinal = carpetaDestino.createFile(blobExcel);
        const urlExcelFinal = archivoExcelFinal.getUrl();

        // Limpiar archivo temporal de Google Sheets
        DriveApp.getFileById(tempSpreadsheetId).setTrashed(true);

        // --- 6. Pegar Link en BD ---
        try {
            const linkCol = encabezados.indexOf(COLUMNA_LINK_REPORTE);
            if (idxId !== -1 && linkCol !== -1) {
                for (let i = 1; i < datosCompletos.length; i++) {
                    if (datosCompletos[i][idxId] != null && datosCompletos[i][idxId].toString().trim() === valorBuscado) {
                        hojaDatosGeneral.getRange(i + 1, linkCol + 1).setValue(urlExcelFinal);
                        break;
                    }
                }
            }
        } catch (e) { Logger.log("Error actualizando link: " + e); }

        // --- 7. NOTIFICACIÓN FINAL ---
        if (!silencioso) {
            SpreadsheetApp.getActiveSpreadsheet().toast('¡Proceso completado!', '✅ Éxito', 5);
            ui.alert('✅ Reporte Excel Generado', 'Reporte para ID: ' + valorBuscado + ' guardado en "' + NOMBRE_CARPETA_REPORTES + '".', ui.ButtonSet.OK);
        }
        return urlExcelFinal;

    } catch (e) {
        if (tempSpreadsheetId) {
            try { DriveApp.getFileById(tempSpreadsheetId).setTrashed(true); } catch(err){}
        }
        if (silencioso) throw e;
        ui.alert('❌ Error Crítico', 'Ocurrió un problema: ' + e.message, ui.ButtonSet.OK);
        return null;
    }
}


/**
 * -----------------------------------------------------------------
 * PARTE 3: PROCESAMIENTO OPTIMIZADO POR SECCIÓN (BATCH)
 * -----------------------------------------------------------------
 */
function processSection_Excel(pvId, spreadsheetDatos, hojaDestino, config, filasInsertadasPreviamente) {
    let totalFilasInsertadas = 0;

    // A. Procesar Tablas de Datos
    if (!config.sheetName.includes('dummy')) {
        const hojaSeccion = spreadsheetDatos.getSheetByName(config.sheetName);
        if (hojaSeccion) {
            const datosCompletos = hojaSeccion.getDataRange().getValues();
            const encabezados = datosCompletos[0].map(h => typeof h === 'string' ? h.trim() : h);
            const indicePvId = encabezados.indexOf(COLUMNA_PVID); 

            if (indicePvId !== -1) {
                const registros = datosCompletos.slice(1).filter(fila => fila[indicePvId] != null && fila[indicePvId].toString().trim() === pvId);
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

    // B. Procesar Fotos 
    if (config.photosConfig) {
        const pConfig = config.photosConfig;
        const hojaFotos = spreadsheetDatos.getSheetByName(pConfig.photoSheetName);
        if (hojaFotos) {
            const datosFotos = hojaFotos.getDataRange().getValues();
            const headF = datosFotos[0].map(h => typeof h === 'string' ? h.trim() : h);
            const idColF = headF.indexOf(pConfig.idColumnName);
            const urlColF = headF.indexOf(pConfig.photoLinkColumnName);
            const descColF = headF.indexOf(pConfig.descColumnName); 

            if (idColF !== -1 && urlColF !== -1) {
                const fotos = datosFotos.slice(1).filter(f => f[idColF] != null && f[idColF].toString().trim() === pvId && f[urlColF] && f[urlColF].toString().startsWith('http'));
                
                if (fotos.length > 0) {
                    const filaInicioImagenOriginal = parseInt(pConfig.photoCells[0].match(/\d+/)[0]);
                    const offsetFotos = filaInicioImagenOriginal - config.dataStartRow;
                    const baseRow = config.dataStartRow + filasInsertadasPreviamente + totalFilasInsertadas + offsetFotos;

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
 * PARTE 4: UTILIDADES
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
        const col  = destino.getColumn();
        let anchoArea = 0, altoArea = 0;
        for (let c = 0; c < destino.getNumColumns(); c++) anchoArea += hoja.getColumnWidth(col + c);
        for (let r = 0; r < destino.getNumRows(); r++)    altoArea  += hoja.getRowHeight(fila + r);
        const img    = hoja.insertImage(blob, col, fila);
        const margen = 4;
        const escala = Math.min(
            Math.max(anchoArea - margen, 20) / img.getWidth(),
            Math.max(altoArea  - margen, 20) / img.getHeight()
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

// ── Wrappers menú estándar ──
function generarPorIdManual() {
    const ui = SpreadsheetApp.getUi();
    const r = ui.prompt('Generar Reporte', 'Ingrese el ID (' + COLUMNA_PVID + '):', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    const id = r.getResponseText().trim();
    if (!id) { ui.alert('ID inválido.'); return; }
    SpreadsheetApp.getActiveSpreadsheet().toast('Generando reporte...', '⏳', -1);
    generarReporteCompletoSync(id, false);
}
function mostrarPanelSelectorMasivo() { mostrarPanelDeEntrada_Excel(); }
function generarTodosPendientes() {
    const pendientes = obtenerIdsInfo().filter(function(i){ return i.status === 'Pendiente'; });
    if (!pendientes.length) { SpreadsheetApp.getUi().alert('No hay reportes pendientes.'); return; }
    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert('Confirmar', 'Se generarán ' + pendientes.length + ' reportes pendientes. ¿Continuar?', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
    let ok = 0, err = 0;
    pendientes.forEach(function(item) {
        try { generarReporteCompletoSync(item.id, true); ok++; } catch(e) { err++; }
    });
    ui.alert('Completado', 'Generados: ' + ok + '  |  Errores: ' + err, ui.ButtonSet.OK);
}
function limpiarColaDisparo() {
    SpreadsheetApp.getUi().alert('ℹ️ Info', 'Este script no usa cola de triggers. No hay nada que limpiar.', SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * =================================================================
 * --- ARCHIVO: ReporteAutomatizado_Excel.gs (ACTUALIZADO) ---
 * =================================================================
 * Rol: Automatizador_app_sheets
 * Genera reportes exportados a EXCEL usando la pestaña "FORMAT" local.
 * NOTIFICACIÓN: Ventana emergente (Alert) al finalizar (Sin correos).
 */

const ID_BD_GENERAL = SpreadsheetApp.getActiveSpreadsheet().getId();
const NOMBRE_HOJA_FORMATO = "FORMAT"; // Asegúrate de que tu plantilla se llame así
const NOMBRE_HOJA_ACTIVADORA = "1.0_inspeccion_tanque_general";
const COLUMNA_PVID = "id_general";
const COLUMNA_LINK_REPORTE = "link_reporte";
const NOMBRE_CARPETA_REPORTES = "reportes";

// --- 1. MAPEO DE LA TABLA MADRE (1.0_inspeccion_tanque_general) ---
const MAPEO_DE_CELDAS = {
    'cliente': 'C5',
    'fecha_inspeccion': 'G5',
    'reporte_nro': 'K5',
    'tanque_recipiente': 'O5',
    'lugar_inspeccion': 'C6',
    'ot': 'G6',
    'contrato': 'K6',
    'material': 'C8',
    'recubrimiento_tipo': 'G8',
    'espesor_nominal_in': 'K8',
    'id_tanque_tag': 'O8',
    'diametro_ft': 'C9',
    'estado_recubrimiento': 'G9',
    'traslapadas_a_tope': 'K9',
    'planta_estacion': 'O9',
    'altura_ft': 'C10',
    'numero_laminas_fondo': 'G10',
    'producto_almacenado': 'K10',
    'volumen_nominal_bls': 'O10',
    'equipo_ut': 'C12',
    'modelo': 'G12',
    'fecha_equipo': 'K12',
    'palpador': 'O12',
    'nombre': 'D24',
    'cargo': 'D25',
    'certificado': 'D26',
    'fecha_firma': 'D28'
};

// --- 2. CONFIGURACIÓN DE TABLAS HIJAS ---
const SECTIONS_CONFIG = {
    registro_mediciones: {
        sheetName: '1.1_registro_mediciones',
        dataStartRow: 15,
        mapping: {
            'item': 'A15',
            'numero_fila': 'B15',
            'numero_lamina': 'C15',
            'distancia_x': 'D15',
            'distancia_y': 'E15',
            'espesor_nominal_mm': 'F15',
            'espesor_minimo_mm': 'G15',
            'porcentaje_perdida_reportada_mfl': 'H15',
            'porcentaje_perdida': 'I15',
            'observaciones': 'J15'
        },
        // Configuración para las fotos de validación de este mismo bloque
        photosConfig: {
            photoSheetName: '1.1_registro_mediciones',
            idColumnName: 'id_general',
            photoLinkColumnName: 'link_imagen',
            descColumnName: 'observaciones_imagen',
            photoCells: ['A18', 'F18', 'K18'],
            descCells: ['A19', 'F19', 'K19']
        }
    },
    reporte_fotos: {
        sheetName: 'dummy_no_usar_datos', // No mapea datos, solo fotos
        dataStartRow: 21,
        mapping: {},
        photosConfig: {
            photoSheetName: '1.2_reporte_photos',
            idColumnName: 'id_general',
            photoLinkColumnName: 'link_imagen',
            descColumnName: 'descripcion_foto',
            photoCells: ['A21', 'F21', 'K21'],
            descCells: ['A22', 'F22', 'K22']
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
        .createMenu('⚙️ Automatizador AppSheet')
        .addItem('1. Generar reporte Excel manualmente', 'mostrarPanelDeEntrada_Excel')
        .addToUi();
}

function mostrarPanelDeEntrada_Excel() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.prompt(
        'Generar Reporte Excel',
        `Ingrese el ID de la inspección (columna ${COLUMNA_PVID}):`,
        ui.ButtonSet.OK_CANCEL);

    if (result.getSelectedButton() == ui.Button.OK) {
        const valorBuscado = result.getResponseText().trim();
        if (valorBuscado) {
            // Notificación flotante de inicio
            SpreadsheetApp.getActiveSpreadsheet().toast("Generando reporte, por favor espere unos segundos...", "⏳ Procesando", -1);

            // Ejecutamos la lógica sincrónica para poder mostrar la ventana al final
            generarReporteCompletoSync(valorBuscado);
        } else {
            ui.alert(`Por favor, ingrese un ${COLUMNA_PVID} válido.`);
        }
    }
}


/**
 * -----------------------------------------------------------------
 * PARTE 2: LÓGICA PRINCIPAL (SINCRÓNICA)
 * -----------------------------------------------------------------
 */
function generarReporteCompletoSync(valorBuscado) {
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
        if (hojaDefecto) nuevoReporteSpreadsheet.deleteSheet(hojaDefecto);

        // --- 2. Mapeo Datos Generales ---
        for (const col in MAPEO_DE_CELDAS) {
            const celda = MAPEO_DE_CELDAS[col];
            const idx = encabezados.indexOf(col);
            if (idx !== -1) hojaFormatoDestino.getRange(celda).setValue(filaDatos[idx]);
        }

        // --- 3. Firma Principal ---
        const idxFirma = encabezados.indexOf('link_firma');
        if (idxFirma !== -1 && filaDatos[idxFirma]) {
            insertarImagenEnCelda_Excel(filaDatos[idxFirma], hojaFormatoDestino.getRange('D27')); // Celda de firma
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

        // Limpiar archivo temporal
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

        // --- 7. NOTIFICACIÓN FINAL (VENTANA EMERGENTE) ---
        SpreadsheetApp.getActiveSpreadsheet().toast("¡Proceso completado!", "✅ Éxito", 5);
        ui.alert(
            '✅ Reporte Excel Generado Exitosamente',
            `El reporte para el ID: ${valorBuscado} ha sido creado.\n\nSe ha guardado automáticamente en la carpeta "${NOMBRE_CARPETA_REPORTES}".\n\nPuedes abrirlo desde la columna "${COLUMNA_LINK_REPORTE}" en tu base de datos.`,
            ui.ButtonSet.OK
        );

    } catch (e) {
        if (tempSpreadsheetId) {
            try { DriveApp.getFileById(tempSpreadsheetId).setTrashed(true); } catch (err) { }
        }
        ui.alert('❌ Error Crítico', `Ocurrió un problema: ${e.message}`, ui.ButtonSet.OK);
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
                    // Cálculo dinámico para respetar la celda exacta de inicio de la imagen
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
    if (url && typeof url === 'string' && url.startsWith('http')) {
        try {
            const img = SpreadsheetApp.newCellImage().setSourceUrl(url).build();
            celda.setValue(img);
        } catch (e) { celda.setValue('Err IMG'); }
    }
}
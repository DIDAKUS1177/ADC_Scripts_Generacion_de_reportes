/**
 * =================================================================
 * --- ARCHIVO: ReporteAutomatizado_Excel.gs ---
 * =================================================================
 * Rol: Automatizador_app_sheets
 * Genera reportes exportados a EXCEL, guardados en una carpeta 
 * específica con fecha/hora, e incluye notificación por correo.
 */

const ID_BD_GENERAL = SpreadsheetApp.getActiveSpreadsheet().getId();
const ID_PLANTILLA = '1GXzQAjEK2s0MrM-IundNq2NwCghYZPdhoxA405mHTRg';

// --- 1. CARPETA DE DESTINO EXCLUSIVA ---
const ID_CARPETA_DESTINO = '1EDlVq5AOWqyQkjQTGlFutVj98_PL-wLk';

const NOMBRE_HOJA_FORMATO = "FORMAT"; // Cambia al nombre real de la pestaña de tu plantilla
const NOMBRE_HOJA_ACTIVADORA = "1.0_general";
const COLUMNA_PVID = "id_general";
const COLUMNA_LINK_REPORTE = "link_reporte";

// --- MAPEO DE LA TABLA MADRE (1.0_general) ---
const MAPEO_DE_CELDAS = {
    'cliente': 'D7', 'fecha': 'J7', 'reporte_n': 'Q7', 'estacion': 'V7',
    'contrato': 'D8', 'ot': 'J8', 'zona': 'Q8', 'sistema': 'V8',
    'equipo': 'D9', 'fluido': 'J9', 'material': 'Q9', 'norma': 'V9',
    'inicio_inspeccion': 'D13', 'acoplante': 'J13', 'estado_superficial': 'R13',
    'marca_equipo': 'V13', 'fin_inspeccion': 'D14', 'rango_espesores': 'J14',
    'temperatura_superficie': 'R14', 'modelo': 'V14', 'serie': 'D15',
    'tipo_palpador': 'J15', 'frecuencia': 'R15', 'tamano': 'V15',
    'nombre': 'D36', 'cargo': 'D37', 'certificado': 'D38', 'fecha_firma': 'D46'
};

// --- CONFIGURACIÓN DE TABLAS HIJAS ---
const SECTIONS_CONFIG = {
    reporte_datos: {
        sheetName: '2.0_reporte',
        dataStartRow: 21,
        mapping: {
            'id_punto': 'A21', 'sistema_o_linea': 'B21', 'seg': 'C21', 'cml': 'D21',
            'diametro_in': 'E21', 'tipo_accesorio': 'F21', 'latitud': 'G21', 'longitud': 'H21',
            'dja_mm': 'I21', 'posicion_horario_inicial': 'J21', 'posicion_horario_final': 'K21',
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

// --- VARIABLES GLOBALES DE ESTADO ---
const SECCIONES_POR_LOTE = 5;
const PROP_VALOR_BUSCADO = 'VALOR_BUSCADO';
const PROP_START_INDEX = 'START_INDEX';
const PROP_TOTAL_FILAS_INSERTADAS = 'TOTAL_FILAS_INSERTADAS';
const PROP_SECTION_KEYS = 'SECTION_KEYS';
const PROP_REPORTE_ID = 'REPORTE_ID';
const PROP_NOMBRE_REPORTE = 'NOMBRE_REPORTE';


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
        const valorBuscado = result.getResponseText();
        if (valorBuscado) {
            iniciarGeneracionEncadenada(valorBuscado.trim());
        } else {
            ui.alert(`Por favor, ingrese un ${COLUMNA_PVID} válido.`);
        }
    }
}

/**
 * -----------------------------------------------------------------
 * PARTE 2: INICIADOR DEL PROCESO ENCADENADO
 * -----------------------------------------------------------------
 */
function iniciarGeneracionEncadenada(valorBuscado) {
    const ui = SpreadsheetApp.getUi();
    try {
        limpiarPropiedadesEstado();
        borrarTriggersExistentes('procesarLoteSeccionesTrigger');

        const scriptProperties = PropertiesService.getScriptProperties();
        scriptProperties.setProperty(PROP_VALOR_BUSCADO, valorBuscado);
        scriptProperties.setProperty(PROP_START_INDEX, '0');
        scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, '0');

        ScriptApp.newTrigger('procesarLoteSeccionesTrigger')
            .timeBased().after(5 * 1000).create();

        ui.alert(
            '✅ Proceso de Excel Iniciado',
            `Generando reporte para el ID: ${valorBuscado}...\n\nAl finalizar se guardará en la carpeta seleccionada y recibirás un correo de notificación.`,
            ui.ButtonSet.OK
        );
    } catch (e) {
        ui.alert(`❌ Error al iniciar: ${e.message}`);
        limpiarPropiedadesEstado();
    }
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
        estado.startIndex = parseInt(scriptProperties.getProperty(PROP_START_INDEX) || '0');
        estado.totalFilasInsertadasGlobal = parseInt(scriptProperties.getProperty(PROP_TOTAL_FILAS_INSERTADAS) || '0');
        estado.reporteId = scriptProperties.getProperty(PROP_REPORTE_ID);
        estado.nombreReporte = scriptProperties.getProperty(PROP_NOMBRE_REPORTE);
        let sectionKeysStr = scriptProperties.getProperty(PROP_SECTION_KEYS);
        estado.sectionKeys = sectionKeysStr ? JSON.parse(sectionKeysStr) : [];

        if (!estado.valorBuscado) { borrarTriggerActual('procesarLoteSeccionesTrigger'); return; }

        let spreadsheetDatosGeneral;
        let nuevoReporteSpreadsheet;
        let hojaFormatoDestino;

        // --- Configuración Inicial (Primer Lote) ---
        if (estado.startIndex === 0) {
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            const hojaDatosGeneral = spreadsheetDatosGeneral.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
            const datosCompletos = hojaDatosGeneral.getDataRange().getValues();
            const encabezados = datosCompletos[0].map(h => typeof h === 'string' ? h.trim() : h);
            const idxId = encabezados.indexOf(COLUMNA_PVID);

            let filaDatos = null;
            for (let i = 1; i < datosCompletos.length; i++) {
                if (datosCompletos[i][idxId] != null && datosCompletos[i][idxId].toString().trim() === estado.valorBuscado) {
                    filaDatos = datosCompletos[i];
                    break;
                }
            }
            if (!filaDatos) throw new Error("ID no encontrado.");

            // 2. Aplicar hora y fecha al nombre del reporte
            const fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
            const clienteStr = filaDatos[encabezados.indexOf('cliente')] || 'SIN_CLIENTE';
            const otStr = filaDatos[encabezados.indexOf('ot')] || 'SIN_OT';
            estado.nombreReporte = `Reporte_${clienteStr}_${otStr}_${estado.valorBuscado}_${fechaHora}`;

            // Creamos archivo temporal de Sheets en la raiz (luego se convierte a Excel y se borra)
            nuevoReporteSpreadsheet = SpreadsheetApp.create("TEMP_" + estado.nombreReporte);
            estado.reporteId = nuevoReporteSpreadsheet.getId();

            const plantillaSpreadsheet = SpreadsheetApp.openById(ID_PLANTILLA);
            const hojaFormatoPlantilla = plantillaSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
            hojaFormatoDestino = hojaFormatoPlantilla.copyTo(nuevoReporteSpreadsheet).setName(NOMBRE_HOJA_FORMATO);

            if (nuevoReporteSpreadsheet.getSheetByName('Hoja 1')) nuevoReporteSpreadsheet.deleteSheet(nuevoReporteSpreadsheet.getSheetByName('Hoja 1'));

            // Mapeo Datos Generales
            for (const col in MAPEO_DE_CELDAS) {
                const celda = MAPEO_DE_CELDAS[col];
                const idx = encabezados.indexOf(col);
                if (idx !== -1) hojaFormatoDestino.getRange(celda).setValue(filaDatos[idx]);
            }

            // Firmas
            const idxFirma = encabezados.indexOf('link_firma');
            if (idxFirma !== -1 && filaDatos[idxFirma]) {
                insertarImagenEnCelda_Excel(filaDatos[idxFirma], hojaFormatoDestino.getRange('D39'));
            }

            estado.sectionKeys = Object.keys(SECTIONS_CONFIG);
            scriptProperties.setProperty(PROP_SECTION_KEYS, JSON.stringify(estado.sectionKeys));
            scriptProperties.setProperty(PROP_REPORTE_ID, estado.reporteId);
            scriptProperties.setProperty(PROP_NOMBRE_REPORTE, estado.nombreReporte);
        } else {
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            nuevoReporteSpreadsheet = SpreadsheetApp.openById(estado.reporteId);
            hojaFormatoDestino = nuevoReporteSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
        }

        // --- Procesar Secciones Hijas ---
        const indiceFinLote = Math.min(estado.startIndex + SECCIONES_POR_LOTE, estado.sectionKeys.length);
        for (let i = estado.startIndex; i < indiceFinLote; i++) {
            const key = estado.sectionKeys[i];
            const config = SECTIONS_CONFIG[key];
            const filasInsertadas = processSection_Excel(estado.valorBuscado, spreadsheetDatosGeneral, hojaFormatoDestino, config, estado.totalFilasInsertadasGlobal);
            estado.totalFilasInsertadasGlobal += filasInsertadas;
        }

        // --- Decisión: Siguiente Paso o Finalizar ---
        if (indiceFinLote < estado.sectionKeys.length) {
            scriptProperties.setProperty(PROP_START_INDEX, indiceFinLote.toString());
            scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, estado.totalFilasInsertadasGlobal.toString());
            ScriptApp.newTrigger('procesarLoteSeccionesTrigger').timeBased().after(2000).create();
        } else {
            // ==========================================
            // FIN DEL PROCESO - CONVERSIÓN A EXCEL Y NOTIFICACIÓN
            // ==========================================
            SpreadsheetApp.flush();

            // 1. Exportar a formato Excel (.xlsx)
            const urlExport = "https://docs.google.com/spreadsheets/d/" + estado.reporteId + "/export?format=xlsx";
            const token = ScriptApp.getOAuthToken();
            const response = UrlFetchApp.fetch(urlExport, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const blobExcel = response.getBlob().setName(estado.nombreReporte + '.xlsx');

            // 2. Guardar en la carpeta específica provista
            const carpetaDestino = DriveApp.getFolderById(ID_CARPETA_DESTINO);
            const archivoExcelFinal = carpetaDestino.createFile(blobExcel);
            const urlExcelFinal = archivoExcelFinal.getUrl();

            // 3. Borrar el archivo temporal de Google Sheets
            DriveApp.getFileById(estado.reporteId).setTrashed(true);

            // 4. Pegar el Link final en la base de datos general
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
            } catch (e) { Logger.log(e); }

            // 5. Enviar Notificación por Correo al usuario que inició el script
            try {
                const usuarioActual = Session.getActiveUser().getEmail();
                if (usuarioActual) {
                    MailApp.sendEmail({
                        to: usuarioActual,
                        subject: "✅ Reporte Excel Generado: " + estado.nombreReporte,
                        body: `Hola,\n\nTu reporte en Excel ha terminado de generarse correctamente y ya está guardado en tu carpeta.\n\nPuedes acceder directamente al archivo haciendo clic en el siguiente enlace:\n${urlExcelFinal}\n\n¡Saludos!`
                    });
                }
            } catch (eMail) {
                Logger.log("No se pudo enviar el correo de notificación: " + eMail);
            }

            limpiarPropiedadesEstado();
        }

    } catch (e) {
        Logger.log(`Error: ${e.stack}`);
        limpiarPropiedadesEstado();
    } finally {
        const nextIdx = estado.startIndex + SECCIONES_POR_LOTE;
        if (nextIdx >= (estado.sectionKeys ? estado.sectionKeys.length : 0)) borrarTriggerActual('procesarLoteSeccionesTrigger');
    }
}

/**
 * -----------------------------------------------------------------
 * PARTE 4: PROCESAMIENTO OPTIMIZADO POR SECCIÓN (BATCH)
 * -----------------------------------------------------------------
 */
function processSection_Excel(pvId, spreadsheetDatos, hojaDestino, config, filasInsertadasPreviamente) {
    let totalFilasInsertadas = 0;

    // A. Procesar Tablas de Datos
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

    // B. Procesar Fotos (Solo para la configuración de fotos)
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
 * PARTE 5: UTILIDADES
 * -----------------------------------------------------------------
 */
function insertarImagenEnCelda_Excel(url, celda) {
    if (url && typeof url === 'string' && url.startsWith('http')) {
        try {
            const img = SpreadsheetApp.newCellImage().setSourceUrl(url).build();
            celda.setValue(img);
        } catch (e) { celda.setValue('Err IMG'); }
    }
}

function borrarTriggerActual(funcName) {
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === funcName) ScriptApp.deleteTrigger(t); });
}

function borrarTriggersExistentes(funcName) { borrarTriggerActual(funcName); }

function limpiarPropiedadesEstado() {
    ['VALOR_BUSCADO', 'START_INDEX', 'TOTAL_FILAS_INSERTADAS', 'SECTION_KEYS', 'REPORTE_ID', 'CARPETA_ID', 'NOMBRE_REPORTE'].forEach(p => PropertiesService.getScriptProperties().deleteProperty(p));
}
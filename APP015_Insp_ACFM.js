/**
 * =================================================================
 * --- ARCHIVO: ReporteACFM.gs ---
 * =================================================================
 * Automatizador de Reportes ACFM con Inserción de Imágenes, 
 * Autoincremento de celdas y Procesamiento Batch.
 */

const ID_BD_GENERAL = '1FCSmWeYjO6u3_jFNmAJwsLc0O4bb1WqPjkdGL-1g88Q';
const ID_PLANTILLA = ID_BD_GENERAL;
const NOMBRE_CARPETA_RAIZ_REPORTES = "REPORTES_ACFM";
const NOMBRE_HOJA_FORMATO = "FORMATO";
const NOMBRE_HOJA_ACTIVADORA = "1.0_general";
const COLUMNA_PVID = "id_general";
const COLUMNA_ACTIVADORA = "generar_reporte";
const COLUMNA_LINK_REPORTE = "link_reporte";

// Variables globales de mapeo de la tabla Madre
const MAPEO_DE_CELDAS = {
    'cliente': 'D7',
    'contrato': 'N7',
    'proyecto': 'D9',
    'ot_n': 'N9',
    'no_reporte': 'D11',
    'troncal': 'N11',
    'estacion': 'D13',
    'sistema': 'N13',
    'tag': 'D15',
    'capacidad': 'N15',
    'dr_pk': 'D17',
    'fecha': 'N17',
    'equipo_acfm': 'D21',
    'tipo_sonda': 'N21',
    'serie': 'D23',
    'n_serie': 'N23',
    'fecha_calibracion': 'D25',
    'frecuencia': 'N25',
    'observaciones': 'A37',
    // --- DATOS DE FIRMA AÑADIDOS ---
    'nombre': 'C46',
    'cargo': 'C47',
    'certificado': 'C48',
    'fecha_firma': 'C49' // Diferenciado de "fecha" principal
};

// Configuración de Tablas Hijas y Fotos
const SECTIONS_CONFIG = {
    datosACFM: {
        sheetName: '1.1_reporte_datos',
        mapping: {
            'equipo': 'A33',
            'segmento': 'B33',
            'n_cml': 'C33',
            'diametro_pulg': 'D33',
            'espesor_pulg': 'E33',
            'longitud_junta_m': 'F33',
            'indicaciones_lado_a': 'H33',
            'longitud_estimada_mm': 'I33',
            'longitud_real_mm': 'K33',
            'profundidad_mm': 'L33',
            'reporte_anexo_grafico_no': 'M33',
            'observaciones': 'N33'
        },
        dataStartRow: 33,
        photosConfig: {
            photoSheetName: '1.1_reporte_datos_PHOTOS',
            idColumnName: 'id_general', // Ajustado para buscar por ID principal
            photoLinkColumnName: 'link_imagen',
            photoCells: ['A39', 'E39', 'I39', 'M39'],
            descCells: ['A40', 'E40', 'I40', 'M40']
        }
    },
    fotosGenerales: {
        sheetName: '1.0_general', // Simula leer la principal solo para anclar fotos
        mapping: {}, // Sin datos, solo iterador de fotos
        dataStartRow: 41, // Fila ficticia para calcular el offset correcto de A42
        photosConfig: {
            photoSheetName: '1.1_general_PHOTOS',
            idColumnName: 'id_general',
            photoLinkColumnName: 'link_imagen',
            photoCells: ['A42', 'E42', 'I42', 'M42'],
            descCells: ['A43', 'E43', 'I43', 'M43']
        }
    }
};

const SECCIONES_POR_LOTE = 2;

// Claves de Propiedades
const PROP_VALOR_BUSCADO = 'VALOR_BUSCADO';
const PROP_START_INDEX = 'START_INDEX';
const PROP_TOTAL_FILAS_INSERTADAS = 'TOTAL_FILAS_INSERTADAS';
const PROP_SECTION_KEYS = 'SECTION_KEYS';
const PROP_REPORTE_ID = 'REPORTE_ID';
const PROP_CARPETA_ID = 'CARPETA_ID';
const PROP_NOMBRE_REPORTE = 'NOMBRE_REPORTE';

/**
 * PARTE 1: ACTIVACIÓN DESDE EL MENÚ
 */
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Automatizador AppSheet')
        .addItem('1. Generar reporte manualmente', 'mostrarPanelDeEntrada_Excel')
        .addToUi();
}

function mostrarPanelDeEntrada_Excel() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.prompt(
        'Generar Reporte ACFM',
        `Ingrese el ID del reporte (columna ${COLUMNA_PVID}):`,
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
 * PARTE 2: INICIADOR DEL PROCESO ENCADENADO
 */
function iniciarGeneracionEncadenada(valorBuscado) {
    const ui = SpreadsheetApp.getUi();
    if (!valorBuscado) return;

    try {
        limpiarPropiedadesEstado();
        borrarTriggersExistentes('procesarLoteSeccionesTrigger');

        const scriptProperties = PropertiesService.getScriptProperties();
        scriptProperties.setProperty(PROP_VALOR_BUSCADO, valorBuscado);
        scriptProperties.setProperty(PROP_START_INDEX, '0');
        scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, '0');

        const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MM-yyyy_HH-mm");
        const nombreRep = `Reporte_${valorBuscado}_${timestamp}`;
        scriptProperties.setProperty(PROP_NOMBRE_REPORTE, nombreRep);

        ScriptApp.newTrigger('procesarLoteSeccionesTrigger').timeBased().after(2000).create();

        try { ui.alert('✅ Proceso Iniciado', `El reporte ${valorBuscado} ha comenzado a generarse.`, ui.ButtonSet.OK); } catch (e) { }

    } catch (e) {
        Logger.log(`Error en iniciarGeneracionEncadenada: ${e.stack}`);
        limpiarPropiedadesEstado();
    }
}

/**
 * PARTE 3: EL TRABAJADOR PRINCIPAL (TRIGGER)
 */
function procesarLoteSeccionesTrigger() {
    const scriptProperties = PropertiesService.getScriptProperties();
    let estado = {};

    try {
        estado.valorBuscado = scriptProperties.getProperty(PROP_VALOR_BUSCADO);
        estado.startIndex = parseInt(scriptProperties.getProperty(PROP_START_INDEX) || '0');
        estado.totalFilasInsertadasGlobal = parseInt(scriptProperties.getProperty(PROP_TOTAL_FILAS_INSERTADAS) || '0');
        estado.reporteId = scriptProperties.getProperty(PROP_REPORTE_ID);
        estado.carpetaId = scriptProperties.getProperty(PROP_CARPETA_ID);
        estado.nombreReporte = scriptProperties.getProperty(PROP_NOMBRE_REPORTE);
        let sectionKeysStr = scriptProperties.getProperty(PROP_SECTION_KEYS);
        estado.sectionKeys = sectionKeysStr ? JSON.parse(sectionKeysStr) : [];

        if (!estado.valorBuscado) {
            borrarTriggerActual('procesarLoteSeccionesTrigger');
            return;
        }

        let spreadsheetDatosGeneral, nuevoReporteSpreadsheet, hojaFormatoDestino, carpetaReporteIndividual;

        // Configuración Inicial
        if (estado.startIndex === 0) {
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            const hojaDatosGeneral = spreadsheetDatosGeneral.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
            const datosGenerales = hojaDatosGeneral.getDataRange().getValues();
            const encabezados = datosGenerales[0].map(h => typeof h === 'string' ? h.trim() : h);
            const indicePvId = encabezados.indexOf(COLUMNA_PVID);

            let filaDatos = null;
            let rowIndex = -1;
            for (let i = 1; i < datosGenerales.length; i++) {
                if (datosGenerales[i][indicePvId] != null && datosGenerales[i][indicePvId].toString().trim() === estado.valorBuscado.toString().trim()) {
                    filaDatos = datosGenerales[i];
                    rowIndex = i + 1;
                    break;
                }
            }
            if (!filaDatos) throw new Error(`ID '${estado.valorBuscado}' no encontrado.`);

            carpetaReporteIndividual = buscarOCrearCarpetaReporte(hojaDatosGeneral, rowIndex, estado.nombreReporte);
            estado.carpetaId = carpetaReporteIndividual.getId();

            nuevoReporteSpreadsheet = SpreadsheetApp.create(estado.nombreReporte);
            estado.reporteId = nuevoReporteSpreadsheet.getId();
            DriveApp.getFileById(estado.reporteId).moveTo(carpetaReporteIndividual);

            const plantillaSpreadsheet = SpreadsheetApp.openById(ID_PLANTILLA);
            const hojaFormatoPlantilla = plantillaSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
            hojaFormatoDestino = hojaFormatoPlantilla.copyTo(nuevoReporteSpreadsheet);
            hojaFormatoDestino.setName(NOMBRE_HOJA_FORMATO);
            const hojaPorDefecto = nuevoReporteSpreadsheet.getSheetByName('Hoja 1') || nuevoReporteSpreadsheet.getSheetByName('Sheet1');
            if (hojaPorDefecto) nuevoReporteSpreadsheet.deleteSheet(hojaPorDefecto);

            // Mapeo Principal
            for (const nombreColumna in MAPEO_DE_CELDAS) {
                const celdaDestino = MAPEO_DE_CELDAS[nombreColumna];
                const indiceColumna = encabezados.indexOf(nombreColumna);
                if (indiceColumna !== -1) {
                    hojaFormatoDestino.getRange(celdaDestino).setValue(filaDatos[indiceColumna]);
                }
            }

            // Imágenes principales de la tabla madre (Esquema, Registro y Firma)
            const idxImgEsq = encabezados.indexOf('link_imagen_esquema');
            const idxImgReg = encabezados.indexOf('link_imagen_registro');
            const idxLinkFirma = encabezados.indexOf('link_firma');

            if (idxImgEsq !== -1) insertarImagenEnCelda_Excel(filaDatos[idxImgEsq], hojaFormatoDestino.getRange('A28'));
            if (idxImgReg !== -1) insertarImagenEnCelda_Excel(filaDatos[idxImgReg], hojaFormatoDestino.getRange('I28'));
            if (idxLinkFirma !== -1) insertarImagenEnCelda_Excel(filaDatos[idxLinkFirma], hojaFormatoDestino.getRange('C45'));

            estado.sectionKeys = Object.keys(SECTIONS_CONFIG);
            scriptProperties.setProperty(PROP_SECTION_KEYS, JSON.stringify(estado.sectionKeys));
            scriptProperties.setProperty(PROP_REPORTE_ID, estado.reporteId);
            scriptProperties.setProperty(PROP_CARPETA_ID, estado.carpetaId);

        } else {
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            nuevoReporteSpreadsheet = SpreadsheetApp.openById(estado.reporteId);
            hojaFormatoDestino = nuevoReporteSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
            carpetaReporteIndividual = DriveApp.getFolderById(estado.carpetaId);
        }

        // Procesar Lote
        const totalSecciones = estado.sectionKeys.length;
        const indiceFinLote = Math.min(estado.startIndex + SECCIONES_POR_LOTE, totalSecciones);

        for (let i = estado.startIndex; i < indiceFinLote; i++) {
            const key = estado.sectionKeys[i];
            const config = SECTIONS_CONFIG[key];
            if (!config) continue;

            const filasInsertadasEnSeccion = processSection_Excel(
                estado.valorBuscado,
                spreadsheetDatosGeneral,
                hojaFormatoDestino,
                config,
                estado.totalFilasInsertadasGlobal
            );
            estado.totalFilasInsertadasGlobal += filasInsertadasEnSeccion;
        }

        // Decidir Siguiente Paso
        const proximoStartIndex = indiceFinLote;

        if (proximoStartIndex < totalSecciones) {
            scriptProperties.setProperty(PROP_START_INDEX, proximoStartIndex.toString());
            scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, estado.totalFilasInsertadasGlobal.toString());
            ScriptApp.newTrigger('procesarLoteSeccionesTrigger').timeBased().after(2000).create();

        } else {
            // Finalizar PDF
            SpreadsheetApp.flush();
            const archivoFinal = DriveApp.getFileById(estado.reporteId);
            const pdfBlob = archivoFinal.getAs('application/pdf');
            pdfBlob.setName(estado.nombreReporte + '.pdf');
            carpetaReporteIndividual.createFile(pdfBlob);

            try {
                const hojaDatosGeneralFinal = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
                const datos = hojaDatosGeneralFinal.getDataRange().getValues();
                const headers = datos[0].map(h => typeof h === 'string' ? h.trim() : h);
                const idCol = headers.indexOf(COLUMNA_PVID);
                const linkCol = headers.indexOf(COLUMNA_LINK_REPORTE);

                if (idCol !== -1 && linkCol !== -1) {
                    for (let i = 1; i < datos.length; i++) {
                        if (datos[i][idCol] != null && datos[i][idCol].toString().trim() === estado.valorBuscado.toString().trim()) {
                            hojaDatosGeneralFinal.getRange(i + 1, linkCol + 1).setValue(carpetaReporteIndividual.getUrl());
                            break;
                        }
                    }
                }
            } catch (eLink) { }

            limpiarPropiedadesEstado();
        }

    } catch (e) {
        Logger.log(`❌ ERROR: ${e.stack}`);
        limpiarPropiedadesEstado();
    } finally {
        const totalSeccionesFinal = estado.sectionKeys ? estado.sectionKeys.length : 0;
        const proximoStartIndexFinal = estado.startIndex + SECCIONES_POR_LOTE;
        if (proximoStartIndexFinal >= totalSeccionesFinal || !scriptProperties.getProperty(PROP_VALOR_BUSCADO)) {
            borrarTriggerActual('procesarLoteSeccionesTrigger');
        }
    }
}

/**
 * PARTE 4: PROCESAR SECCIÓN Y FOTOS
 */
function processSection_Excel(pvId, spreadsheetDatos, hojaDestino, config, filasInsertadasPreviamente) {
    try {
        let totalFilasInsertadas = 0;
        let filasInsertadasParaDatos = 0;

        // Procesar Datos (Si la hoja no es de solo fotos)
        if (Object.keys(config.mapping).length > 0) {
            const hojaSeccion = spreadsheetDatos.getSheetByName(config.sheetName);
            if (!hojaSeccion) return 0;

            const datosCompletos = hojaSeccion.getDataRange().getValues();
            if (datosCompletos.length >= 2) {
                const encabezados = datosCompletos[0].map(h => typeof h === 'string' ? h.trim() : h);
                const indicePvId = encabezados.indexOf(COLUMNA_PVID);

                if (indicePvId !== -1) {
                    const registrosEncontrados = datosCompletos.slice(1).filter(fila =>
                        fila[indicePvId] != null && fila[indicePvId].toString().trim() == pvId.toString().trim()
                    );

                    const filaInicioDatos = config.dataStartRow + filasInsertadasPreviamente;
                    const cantidadRegistros = registrosEncontrados.length;

                    if (cantidadRegistros > 1) {
                        const filasAInsertar = cantidadRegistros - 1;
                        hojaDestino.insertRowsAfter(filaInicioDatos, filasAInsertar);
                        const rangoFuente = hojaDestino.getRange(filaInicioDatos, 1, 1, hojaDestino.getMaxColumns());
                        const rangoDestino = hojaDestino.getRange(filaInicioDatos + 1, 1, filasAInsertar, hojaDestino.getMaxColumns());
                        rangoFuente.copyTo(rangoDestino, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
                        filasInsertadasParaDatos = filasAInsertar;
                    }

                    registrosEncontrados.forEach((registroActual, i) => {
                        const filaDestino = filaInicioDatos + i;
                        for (const nombreColumna in config.mapping) {
                            const colDestino = config.mapping[nombreColumna].match(/[A-Z]+/)[0];
                            const celdaFinal = `${colDestino}${filaDestino}`;
                            const indiceColumna = encabezados.indexOf(nombreColumna);
                            if (indiceColumna !== -1) {
                                hojaDestino.getRange(celdaFinal).setValue(registroActual[indiceColumna]);
                            }
                        }
                    });
                    totalFilasInsertadas = filasInsertadasParaDatos;
                }
            }
        }

        // Procesar Fotos de la Sección
        if (config.photosConfig) {
            const pConfig = config.photosConfig;
            const hojaFotos = spreadsheetDatos.getSheetByName(pConfig.photoSheetName);
            if (hojaFotos) {
                const datosCompletosFotos = hojaFotos.getDataRange().getValues();
                if (datosCompletosFotos.length >= 2) {
                    const encabezadosFotos = datosCompletosFotos[0].map(h => typeof h === 'string' ? h.trim() : h);
                    const pvIdColumnIndexFotos = encabezadosFotos.indexOf(pConfig.idColumnName);
                    const linkFotoIndex = encabezadosFotos.indexOf(pConfig.photoLinkColumnName);
                    const descFotoIndex = encabezadosFotos.indexOf('observaciones');

                    if (pvIdColumnIndexFotos !== -1 && linkFotoIndex !== -1) {
                        const fotosEncontradas = datosCompletosFotos.slice(1).filter(fila =>
                            fila[pvIdColumnIndexFotos] != null && fila[pvIdColumnIndexFotos].toString().trim() === pvId.toString().trim() &&
                            fila[linkFotoIndex] && typeof fila[linkFotoIndex] === 'string' && fila[linkFotoIndex].startsWith('http')
                        );

                        if (fotosEncontradas.length > 0) {
                            const numFilaPrimeraFotoPlantilla = parseInt(pConfig.photoCells[0].match(/\d+/)[0]);
                            const rowOffset = numFilaPrimeraFotoPlantilla - config.dataStartRow;
                            const basePhotoRow = config.dataStartRow + filasInsertadasPreviamente + filasInsertadasParaDatos + rowOffset;

                            fotosEncontradas.forEach((fotoData, j) => {
                                const FOTOS_POR_FILA = pConfig.photoCells.length; // 4 fotos
                                const chunkIndex = Math.floor(j / FOTOS_POR_FILA);
                                const positionInChunk = j % FOTOS_POR_FILA;
                                const photoRowForThisImage = basePhotoRow + (chunkIndex * 2);
                                const descRowForThisImage = photoRowForThisImage + 1;

                                if (chunkIndex > 0 && positionInChunk === 0) {
                                    hojaDestino.insertRowsAfter(photoRowForThisImage - 1, 2);
                                    totalFilasInsertadas += 2;

                                    const formatSourcePhotoRow = basePhotoRow + ((chunkIndex - 1) * 2);
                                    const maxCols = hojaDestino.getMaxColumns();
                                    const rangoOrigen = hojaDestino.getRange(formatSourcePhotoRow, 1, 2, maxCols);
                                    const rangoDestino = hojaDestino.getRange(photoRowForThisImage, 1, 2, maxCols);
                                    rangoOrigen.copyTo(rangoDestino, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

                                    hojaDestino.setRowHeight(photoRowForThisImage, hojaDestino.getRowHeight(formatSourcePhotoRow));
                                    hojaDestino.setRowHeight(descRowForThisImage, hojaDestino.getRowHeight(formatSourcePhotoRow + 1));
                                }

                                const photoCol = pConfig.photoCells[positionInChunk].match(/[A-Z]+/)[0];
                                const descCol = pConfig.descCells[positionInChunk].match(/[A-Z]+/)[0];

                                insertarImagenEnCelda_Excel(fotoData[linkFotoIndex], hojaDestino.getRange(`${photoCol}${photoRowForThisImage}`));
                                if (descFotoIndex !== -1 && fotoData[descFotoIndex]) {
                                    hojaDestino.getRange(`${descCol}${descRowForThisImage}`).setValue(fotoData[descFotoIndex]);
                                }
                            });
                        }
                    }
                }
            }
        }
        return totalFilasInsertadas;
    } catch (e) {
        throw new Error(`Falla en sección '${config.sheetName}': ${e.message}`);
    }
}

/**
 * PARTE 5: UTILIDADES Y CARPETAS
 */
function buscarOCrearCarpetaReporte(hojaDatosGeneral, rowIndex, nombreReporte) {
    let carpetaReporteIndividual = null;
    const plantillaFile = DriveApp.getFileById(ID_PLANTILLA);
    const parentsIterator = plantillaFile.getParents();
    let carpetaContenedoraPlantilla = parentsIterator.hasNext() ? parentsIterator.next() : DriveApp.getRootFolder();

    const carpetasExistentes = carpetaContenedoraPlantilla.getFoldersByName(NOMBRE_CARPETA_RAIZ_REPORTES);
    let carpetaRaizReportes = carpetasExistentes.hasNext() ? carpetasExistentes.next() : carpetaContenedoraPlantilla.createFolder(NOMBRE_CARPETA_RAIZ_REPORTES);

    const carpetasConMismoNombre = carpetaRaizReportes.getFoldersByName(nombreReporte);
    while (carpetasConMismoNombre.hasNext()) carpetasConMismoNombre.next().setTrashed(true);

    carpetaReporteIndividual = carpetaRaizReportes.createFolder(nombreReporte);
    return carpetaReporteIndividual;
}

function insertarImagenEnCelda_Excel(url, celda) {
    if (url && typeof url === 'string' && url.startsWith('http')) {
        try {
            const cellImage = SpreadsheetApp.newCellImage().setSourceUrl(url).build();
            celda.setValue(cellImage);
        } catch (e) { celda.setValue('Error imagen'); }
    }
}

function borrarTriggerActual(nombreFuncionTrigger) {
    const allTriggers = ScriptApp.getProjectTriggers();
    for (const trigger of allTriggers) {
        if (trigger.getHandlerFunction() === nombreFuncionTrigger) ScriptApp.deleteTrigger(trigger);
    }
}

function borrarTriggersExistentes(nombreFuncionTrigger) { borrarTriggerActual(nombreFuncionTrigger); }

function limpiarPropiedadesEstado() {
    PropertiesService.getScriptProperties().deleteAllProperties();
}
/**
 * Este script de Google Apps Script está diseñado para generar reportes automáticos
 * a partir de una plantilla y una base de datos externa en Google Sheets.
 */

// =================================================================
// --- CONFIGURACIÓN GLOBAL ---
// =================================================================

const CONFIG = {
    // --- IDs y Nombres de Archivos/Carpetas ---
    ID_HOJA_DE_DATOS: "1RINnawr294nSKVoOKtIEbPLFGtkbUMwtcDV-yvLDepI",
    NOMBRE_CARPETA_REPORTES: "Reportes Generados",

    // --- Nombres de Hojas ---
    HOJAS: {
        FORMATO: "PCM",
        ACVG: "ACVG",
        GRAFICA: "GRAFICA",
        REGISTRO_FOTO: "REG-FOTO",
        ENCABEZADO_BD: "Encabezado",
        GENERAL_BD: "general",
        FOTOS_BD: "fotos",
    },

    // --- Celdas y Rangos Específicos ---
    CELDA_BUSQUEDA_ID: "N5",

    // --- Números de Columna (Basado en 1) ---
    COLUMNAS: {
        BUSQUEDA_ID_EN_ENCABEZADO: 21,
        ID_EN_GENERAL: 13,
        ID_ENCABEZADO_FOTOS: 4,
        LINK_FOTOS: 5,
        DESCRIPCION_FOTOS: 3,
    },
};


// =================================================================
// --- DISPARADORES Y MENÚ ---
// =================================================================

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('📄 Reporte PCM')
        .addItem('Generar Nuevo Reporte (Hoja y PDF)', 'generarReporteCompleto')
        .addToUi();
}


// =================================================================
// --- FUNCIÓN PRINCIPAL ORQUESTADORA ---
// =================================================================

function generarReporteCompleto() {
    const ui = SpreadsheetApp.getUi();
    const plantillaSpreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    const response = ui.prompt(
        'Generar Reporte PCM',
        'Por favor, introduce el "id_encabezado" para generar el reporte:',
        ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() == ui.Button.CANCEL || response.getResponseText().trim() === '') {
        ui.alert('Operación cancelada. No se introdujo ningún ID.');
        return;
    }

    const valorBuscado = response.getResponseText().trim();

    try {
        // 2. Obtener datos de la fuente externa
        const spreadsheetDatos = SpreadsheetApp.openById(CONFIG.ID_HOJA_DE_DATOS);
        const datosFuente = obtenerDatosFuente(spreadsheetDatos, valorBuscado);

        if (!datosFuente.filaEncabezado) {
            ui.alert(`❌ No se encontró registro en '${CONFIG.HOJAS.ENCABEZADO_BD}' para el ID: ${valorBuscado}`);
            return;
        }

        // 3. Crear copia del reporte
        const nombreReporte = `Reporte PCM - OT ${datosFuente.filaEncabezado[2] || 'SIN_OT'}`;
        const { nuevoReporteSpreadsheet, carpetaDestino } = crearCopiaReporte(plantillaSpreadsheet, nombreReporte);

        // 4. Llenar el nuevo reporte con los datos (PCM y ACVG)
        llenarDatosReporte(nuevoReporteSpreadsheet, datosFuente.filaEncabezado, datosFuente.datosFiltrados);

        // 5. Procesar e insertar fotos (Ahora devuelve cuántas filas insertó)
        const filasInsertadasRegFoto = procesarFotos(valorBuscado, spreadsheetDatos, nuevoReporteSpreadsheet);

        // 6. Llenar Firmas (NUEVA FUNCIÓN)
        llenarFirmas(nuevoReporteSpreadsheet, datosFuente.datosFirma, filasInsertadasRegFoto);

        // 7. Crear el gráfico
        crearGraficoPCM(nuevoReporteSpreadsheet);

        // 8. Generar el PDF
        generarPDF(nuevoReporteSpreadsheet.getId(), nombreReporte, carpetaDestino);

        // 9. Notificar al usuario
        ui.alert(`✅ ¡Reporte '${nombreReporte}' generado con éxito!`,
            `Puedes encontrar la Hoja de Cálculo y el PDF en la carpeta:\n\n'${CONFIG.NOMBRE_CARPETA_REPORTES}'\n\nURL: ${carpetaDestino.getUrl()}`,
            ui.ButtonSet.OK);

    } catch (e) {
        ui.alert(`Ha ocurrido un error inesperado: ${e.message}`);
        console.error(e);
    }
}


// =================================================================
// --- FUNCIONES DE OBTENCIÓN DE DATOS ---
// =================================================================

function obtenerDatosFuente(spreadsheetDatos, valorBuscado) {
    // Obtener datos del encabezado
    const hojaEncabezado = spreadsheetDatos.getSheetByName(CONFIG.HOJAS.ENCABEZADO_BD);
    if (!hojaEncabezado) throw new Error(`No se encontró la hoja '${CONFIG.HOJAS.ENCABEZADO_BD}'.`);

    const datosEncabezado = hojaEncabezado.getDataRange().getValues();
    const encabezados = datosEncabezado[0].map(h => String(h).toLowerCase().trim()); // Fila 1 para buscar columnas por nombre

    const filaEncabezado = datosEncabezado.find(fila =>
        fila[CONFIG.COLUMNAS.BUSQUEDA_ID_EN_ENCABEZADO - 1]?.toString().trim() === valorBuscado.toString().trim()
    );

    // --- EXTRACCIÓN DE DATOS DE FIRMA (NUEVO) ---
    // Buscamos dinámicamente el índice de las columnas
    const idxNombre = encabezados.indexOf('nombre');
    const idxCargo = encabezados.indexOf('cargo');
    const idxFirma = encabezados.indexOf('firma_link');
    const idxFecha = encabezados.indexOf('fecha'); // Buscamos una columna 'fecha' explícita

    const datosFirma = {
        nombre: (filaEncabezado && idxNombre !== -1) ? filaEncabezado[idxNombre] : '',
        cargo: (filaEncabezado && idxCargo !== -1) ? filaEncabezado[idxCargo] : '',
        firma: (filaEncabezado && idxFirma !== -1) ? filaEncabezado[idxFirma] : '',
        // Si no encuentra columna 'fecha', usa la columna 1 (index 1) que se usaba antes para E7, o vacío
        fecha: (filaEncabezado && idxFecha !== -1) ? filaEncabezado[idxFecha] : (filaEncabezado ? filaEncabezado[1] : '')
    };

    // Obtener datos generales
    const hojaGeneral = spreadsheetDatos.getSheetByName(CONFIG.HOJAS.GENERAL_BD);
    if (!hojaGeneral) throw new Error(`No se encontró la hoja '${CONFIG.HOJAS.GENERAL_BD}'.`);

    const datosGeneral = hojaGeneral.getDataRange().getValues();
    const datosFiltrados = datosGeneral.filter((fila, index) => {
        const noEsEncabezado = index > 0;
        const coincideID = fila[CONFIG.COLUMNAS.ID_EN_GENERAL - 1]?.toString().trim() === valorBuscado.toString().trim();
        const tieneDatoEnColumnaB = fila[1] !== null && fila[1] !== '';
        return noEsEncabezado && coincideID && tieneDatoEnColumnaB;
    }).map(fila => fila.slice(1, 12));

    return { filaEncabezado, datosFiltrados, datosFirma };
}


// =================================================================
// --- FUNCIONES DE MANEJO DE ARCHIVOS Y HOJAS ---
// =================================================================

function crearCopiaReporte(plantillaSpreadsheet, nombreReporte) {
    const carpetas = DriveApp.getFoldersByName(CONFIG.NOMBRE_CARPETA_REPORTES);
    const carpetaDestino = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(CONFIG.NOMBRE_CARPETA_REPORTES);

    const plantillaFile = DriveApp.getFileById(plantillaSpreadsheet.getId());
    const nuevoReporteFile = plantillaFile.makeCopy(nombreReporte, carpetaDestino);
    const nuevoReporteSpreadsheet = SpreadsheetApp.openById(nuevoReporteFile.getId());

    return { nuevoReporteSpreadsheet, carpetaDestino };
}

function generarPDF(spreadsheetId, nombreReporte, carpetaDestino) {
    SpreadsheetApp.flush();
    const reporteFile = DriveApp.getFileById(spreadsheetId);
    const pdfBlob = reporteFile.getAs('application/pdf');
    pdfBlob.setName(`${nombreReporte}.pdf`);
    carpetaDestino.createFile(pdfBlob);
}


// =================================================================
// --- FUNCIONES DE LLENADO DE DATOS EN EL REPORTE ---
// =================================================================

function llenarDatosReporte(spreadsheetReporte, filaEncabezado, datosFiltrados) {
    const hojaFormato = spreadsheetReporte.getSheetByName(CONFIG.HOJAS.FORMATO);
    const hojaACVG = spreadsheetReporte.getSheetByName(CONFIG.HOJAS.ACVG);

    const hojasALlenar = [hojaFormato, hojaACVG];

    hojasALlenar.forEach(hoja => {
        if (!hoja) return;

        hoja.getRange('B7').setValue(filaEncabezado[0]);
        hoja.getRange('E7').setValue(filaEncabezado[1]);
        hoja.getRange('I7').setValue(filaEncabezado[2]);
        hoja.getRange('M7').setValue(filaEncabezado[3]);
        hoja.getRange('B9').setValue(filaEncabezado[4]);
        hoja.getRange('E9').setValue(filaEncabezado[5]);
        hoja.getRange('J9').setValue(filaEncabezado[6]);
        hoja.getRange('C11').setValue(filaEncabezado[7]);
        hoja.getRange('H11').setValue(filaEncabezado[8]);
        hoja.getRange('M11').setValue(filaEncabezado[9]);
        hoja.getRange('B15').setValue(filaEncabezado[10]);
        hoja.getRange('E15').setValue(filaEncabezado[11]);
        hoja.getRange('H15').setValue(filaEncabezado[12]);
        hoja.getRange('M15').setValue(filaEncabezado[13]);
        hoja.getRange('C17').setValue(filaEncabezado[14]);
        hoja.getRange('F17').setValue(filaEncabezado[15]);
        hoja.getRange('I17').setValue(filaEncabezado[16]);
        hoja.getRange('B21').setValue(filaEncabezado[17]);
        hoja.getRange('F21').setValue(filaEncabezado[18]);
        hoja.getRange('M21').setValue(filaEncabezado[19]);
    });

    if (datosFiltrados.length > 0) {
        const rangoPCM = hojaFormato.getRange(32, 1, datosFiltrados.length, datosFiltrados[0].length);
        hojaFormato.insertRowsAfter(31, datosFiltrados.length);
        rangoPCM.setValues(datosFiltrados);
        rangoPCM.setBorder(true, true, true, true, true, true, "#434343", SpreadsheetApp.BorderStyle.SOLID);
    }

    const datosACVG = datosFiltrados.filter(fila => fila[6] !== null && fila[6] !== '');
    if (datosACVG.length > 0) {
        const rangoACVG = hojaACVG.getRange(32, 1, datosACVG.length, datosACVG[0].length);
        hojaACVG.insertRowsAfter(31, datosACVG.length);
        rangoACVG.setValues(datosACVG);
        rangoACVG.setBorder(true, true, true, true, true, true, "#434343", SpreadsheetApp.BorderStyle.SOLID);
    }
}

/**
 * Función NUEVA para llenar las firmas en GRAFICA y REG-FOTO
 */
function llenarFirmas(spreadsheetReporte, datosFirma, filasInsertadasRegFoto) {
    // --- 1. Hoja GRAFICA (Posiciones Fijas) ---
    const hojaGrafica = spreadsheetReporte.getSheetByName(CONFIG.HOJAS.GRAFICA);
    if (hojaGrafica) {
        // Insertar Imagen (Firma)
        if (datosFirma.firma) {
            insertarImagenEnCelda_Excel(datosFirma.firma, hojaGrafica.getRange('B59'));
        }
        // Insertar Textos
        hojaGrafica.getRange('B60').setValue(datosFirma.nombre);
        hojaGrafica.getRange('B61').setValue(datosFirma.cargo);
        hojaGrafica.getRange('B63').setValue(datosFirma.fecha);
    }

    // --- 2. Hoja REG-FOTO (Posiciones Dinámicas) ---
    const hojaRegFoto = spreadsheetReporte.getSheetByName(CONFIG.HOJAS.REGISTRO_FOTO);
    if (hojaRegFoto) {
        // Las posiciones originales eran:
        // Firma: B16, Nombre: B17, Cargo: B18, Fecha: B20
        // Debemos sumar las filas insertadas durante el proceso de fotos.
        const baseRow = 16 + filasInsertadasRegFoto;

        // Insertar Imagen (Firma)
        if (datosFirma.firma) {
            insertarImagenEnCelda_Excel(datosFirma.firma, hojaRegFoto.getRange(`B${baseRow}`));
        }

        // Insertar Textos
        hojaRegFoto.getRange(`B${baseRow + 1}`).setValue(datosFirma.nombre); // B17 original -> B(16+1)
        hojaRegFoto.getRange(`B${baseRow + 2}`).setValue(datosFirma.cargo);  // B18 original -> B(16+2)
        hojaRegFoto.getRange(`B${baseRow + 4}`).setValue(datosFirma.fecha);  // B20 original -> B(16+4)
    }
}


// =================================================================
// --- FUNCIONES DE MANEJO DE FOTOS ---
// =================================================================

function procesarFotos(id, spreadsheetDatos, spreadsheetReporte) {
    const hojaFotosBD = spreadsheetDatos.getSheetByName(CONFIG.HOJAS.FOTOS_BD);
    const hojaRegistroFoto = spreadsheetReporte.getSheetByName(CONFIG.HOJAS.REGISTRO_FOTO);
    if (!hojaFotosBD || !hojaRegistroFoto) {
        throw new Error("No se encontró la hoja de fotos en la BD o la hoja de registro en el reporte.");
    }

    const datosFotos = hojaFotosBD.getDataRange().getValues();
    const fotosFiltradas = datosFotos.filter(fila =>
        fila[CONFIG.COLUMNAS.ID_ENCABEZADO_FOTOS - 1]?.toString().trim() === id.toString().trim()
    );

    hojaRegistroFoto.getDrawings().forEach(drawing => drawing.remove());

    const maxCols = hojaRegistroFoto.getMaxColumns();

    // Limpiar plantilla original
    if (hojaRegistroFoto.getLastRow() >= 13) {
        hojaRegistroFoto.getRange(13, 1, hojaRegistroFoto.getLastRow() - 12, maxCols).clearContent();
    }

    if (fotosFiltradas.length === 0) return 0; // 0 filas insertadas

    const rangoPlantilla = hojaRegistroFoto.getRange(13, 1, 2, maxCols);

    const altoFilaImagen = hojaRegistroFoto.getRowHeight(13);
    const altoFilaDescripcion = hojaRegistroFoto.getRowHeight(14);
    let filaActual = 13;
    let filasTotalesInsertadas = 0; // Contador de filas insertadas

    fotosFiltradas.forEach((fila, index) => {
        let linkFoto = fila[CONFIG.COLUMNAS.LINK_FOTOS - 1];
        const descripcion = fila[CONFIG.COLUMNAS.DESCRIPCION_FOTOS - 1];

        if (!linkFoto || typeof linkFoto !== 'string' || !linkFoto.startsWith('http')) {
            if (linkFoto) linkFoto = linkFoto.toString().trim();
            if (!linkFoto || !linkFoto.startsWith('http')) {
                return;
            }
        }

        if (index >= 2 && index % 2 === 0) {
            hojaRegistroFoto.insertRowsAfter(filaActual + 1, 2);
            filasTotalesInsertadas += 2; // Sumar al contador
            filaActual += 2;

            hojaRegistroFoto.setRowHeight(filaActual, altoFilaImagen);
            hojaRegistroFoto.setRowHeight(filaActual + 1, altoFilaDescripcion);

            rangoPlantilla.copyTo(hojaRegistroFoto.getRange(filaActual, 1));
        }

        const esPar = index % 2 === 0;
        const columnaImg = esPar ? 'A' : 'K';
        const columnaDesc = esPar ? 'A' : 'K';

        const celdaImg = hojaRegistroFoto.getRange(columnaImg + filaActual);
        const celdaDesc = hojaRegistroFoto.getRange(columnaDesc + (filaActual + 1));

        insertarImagenEnCelda_Excel(linkFoto, celdaImg);
        celdaDesc.setValue(descripcion);
    });

    return filasTotalesInsertadas; // Retornamos el número de filas extra
}


// =================================================================
// --- FUNCIÓN DE CREACIÓN DE GRÁFICO ---
// =================================================================

function crearGraficoPCM(spreadsheet) {
    const hojaDatos = spreadsheet.getSheetByName(CONFIG.HOJAS.FORMATO);
    const hojaGrafica = spreadsheet.getSheetByName(CONFIG.HOJAS.GRAFICA);

    if (hojaDatos.getLastRow() < 32) return;

    const datosOriginales = hojaDatos.getRange(32, 1, hojaDatos.getLastRow() - 31, 14).getValues();
    const cabeceras = ['Distancia', 'Corriente', 'P1', 'P2', 'P3', 'SP'];

    const datosParaGrafico = [cabeceras];
    datosOriginales.forEach(fila => {
        const abscisa = fila[1];
        if (abscisa === '' || abscisa === null) return;

        let filaGrafico = [abscisa, fila[8], null, null, null, null];

        switch (fila[13]) {
            case 'PRIORIDAD 1': filaGrafico[2] = fila[12]; break;
            case 'PRIORIDAD 2': filaGrafico[3] = fila[12]; break;
            case 'PRIORIDAD 3': filaGrafico[4] = fila[12]; break;
            case 'SIN PRIORIDAD': filaGrafico[5] = fila[12]; break;
        }
        datosParaGrafico.push(filaGrafico);
    });

    if (datosParaGrafico.length <= 1) return;

    hojaGrafica.getCharts().forEach(chart => hojaGrafica.removeChart(chart));
    const rangoTemporal = hojaGrafica.getRange("Z1").offset(0, 0, datosParaGrafico.length, datosParaGrafico[0].length);
    rangoTemporal.clearContent().setValues(datosParaGrafico);

    let chartBuilder = hojaGrafica.newChart()
        .setChartType(Charts.ChartType.SCATTER)
        .addRange(rangoTemporal)
        .setPosition(32, 1, 0, 0)
        .setOption('title', 'Análisis Gráfico de Inspección PCM')
        .setOption('width', 900)
        .setOption('height', 500)
        .setOption('legend', { position: 'bottom' })
        .setOption('hAxis', { title: 'Distancia (m)', gridlines: { color: '#ccc' } })
        .setOption('vAxes', {
            0: { title: 'Corriente PCM (mA)', textStyle: { color: '#1f77b4' } },
            1: { title: 'Intensidad de Señal (dB Normalizado)', textStyle: { color: '#d62728' }, gridlines: { color: '#f0f0f0' }, viewWindow: { min: 0, max: 100 } }
        })
        .setOption('series', {
            0: { seriesName: 'Corriente PCM (mA)', targetAxisIndex: 0, color: '#1f77b4', pointShape: 'circle', pointSize: 5 },
            1: { seriesName: 'Prioridad 1', targetAxisIndex: 1, color: '#d32f2f', pointShape: 'square', pointSize: 8 },
            2: { seriesName: 'Prioridad 2', targetAxisIndex: 1, color: '#f57c00', pointShape: 'square', pointSize: 8 },
            3: { seriesName: 'Prioridad 3', targetAxisIndex: 1, color: '#388e3c', pointShape: 'square', pointSize: 8 },
            4: { seriesName: 'Sin Prioridad', targetAxisIndex: 1, color: '#757575', pointShape: 'square', pointSize: 8 }
        });

    hojaGrafica.insertChart(chartBuilder.build());
    rangoTemporal.clearContent();
}

/**
 * Inserta la imagen dentro de la celda usando CellImageBuilder.
 */
function insertarImagenEnCelda_Excel(url, celda) {
    if (url && typeof url === 'string' && url.trim().startsWith('http')) {
        try {
            const cellImageBuilder = SpreadsheetApp.newCellImage();
            cellImageBuilder.setSourceUrl(url.trim());
            const cellImage = cellImageBuilder.build();
            celda.setValue(cellImage);
        } catch (e) {
            celda.setValue(`ErrImg`);
        }
    }
}
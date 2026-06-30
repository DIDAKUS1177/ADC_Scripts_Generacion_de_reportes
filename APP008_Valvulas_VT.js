// =================================================================
// --- CONFIGURACIÓN PRINCIPAL ---
// =================================================================

// Nombres de las hojas en tu archivo
const HOJA_GENERAL = "1_general";
const HOJA_VALVULAS = "2_valvulas";
const HOJA_FORMATO = "formatos_valvulas";

// Mapeo de la hoja 1_general hacia el formato (celdas estáticas)
// NOTA: Tienes dos "FECHA" (Z6 y B13). Asegúrate de que los encabezados en tu hoja 
// se llamen distinto (ej. "FECHA_REPORTE" y "FECHA_FIRMA") para que el script no se confunda.
const MAPEO_GENERAL = {
    'CLIENTE': 'B6',
    'CONTRATO': 'F6',
    'OT': 'M6',
    'REPORTE: Nº': 'U6',
    'FECHA_REPORTE': 'Z6', // Mapeado al primer 'FECHA'
    'NOMBRE': 'B10',
    'Nº de Certificado': 'B11',
    'FIRMA': 'B12',
    'FECHA_FIRMA': 'B13'  // Mapeado al segundo 'FECHA'
};

// Mapeo de la hoja 2_valvulas hacia el formato (columnas dinámicas a partir de la fila 8)
const FILA_INICIO_VALVULAS = 8;
const MAPEO_VALVULAS = {
    'ÍTEM': 'A',
    'TRONCAL': 'B',
    'ESTACION': 'C',
    'SISTEMA': 'D',
    'UBICACIÓN/DESCRIPSION': 'E',
    'CODIGO SAP': 'F',
    'CODIGO UBICACIÓN TECNICA': 'G',
    'TAG': 'H',
    'TIPO': 'I',
    'Ø in': 'J',
    'RATING': 'K',
    'MARCA': 'L',
    'MODELO': 'M',
    'CONEXIÓN': 'N', // Corregido de Ñ a N
    'MATERIAL DEL CUERPO': 'O',
    'FACILIDADES DE LUBRICACION': 'P',
    'VENTEO Y DRENAJE': 'Q',
    'CODIGO DE DISEÑO': 'R',
    'PRODUCTO': 'S',
    'Señal de fuga': 'T',
    'Falla en recubrimiento': 'U',
    'Corrosión': 'V',
    'ESTADO INTEGRIDAD': 'W',
    'ESTADO OPERATIVO': 'X',
    // La Y es para la foto, la procesaremos con una función especial buscando 'link_image'
    'OBSERVACIONES': 'Z'
};

// =================================================================
// --- MENÚ PERSONALIZADO ---
// =================================================================
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Reportes Válvulas')
        .addItem('Generar Reporte Activo', 'ejecutarGeneracionManual')
        .addToUi();
}

// =================================================================
// --- FUNCIÓN DE EJECUCIÓN MANUAL ---
// =================================================================
function ejecutarGeneracionManual() {
    const ui = SpreadsheetApp.getUi();

    // Pedimos el ID general al usuario
    const response = ui.prompt('Generar Reporte', 'Por favor, ingresa el "id_general" que deseas generar:', ui.ButtonSet.OK_CANCEL);

    if (response.getSelectedButton() == ui.Button.OK) {
        const idGeneralBuscado = response.getResponseText().trim();
        if (!idGeneralBuscado) {
            ui.alert('El ID no puede estar vacío.');
            return;
        }

        try {
            generarReporteDeValvulas(idGeneralBuscado);
            ui.alert('✅ ¡Reporte Generado con Éxito!', `Se ha creado una nueva pestaña con el reporte del ID: ${idGeneralBuscado}`, ui.ButtonSet.OK);
        } catch (error) {
            ui.alert(`❌ Error al generar el reporte: ${error.message}`);
        }
    }
}

// =================================================================
// --- LÓGICA PRINCIPAL ---
// =================================================================
function generarReporteDeValvulas(idGeneralBuscado) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const hojaGeneral = ss.getSheetByName(HOJA_GENERAL);
    const hojaValvulas = ss.getSheetByName(HOJA_VALVULAS);
    const hojaFormato = ss.getSheetByName(HOJA_FORMATO);

    if (!hojaGeneral || !hojaValvulas || !hojaFormato) {
        throw new Error("No se encontró alguna de las hojas base (1_general, 2_valvulas o formatos_valvulas).");
    }

    // 1. Buscar los datos en 1_general
    const datosGeneral = hojaGeneral.getDataRange().getValues();
    const encabezadosGen = datosGeneral[0].map(h => h.toString().trim());
    const idxIdGen = encabezadosGen.indexOf('id_general');

    if (idxIdGen === -1) throw new Error("No existe la columna 'id_general' en 1_general.");

    let filaEncontradaGen = null;
    for (let i = 1; i < datosGeneral.length; i++) {
        if (datosGeneral[i][idxIdGen].toString().trim() === idGeneralBuscado) {
            filaEncontradaGen = datosGeneral[i];
            break;
        }
    }

    if (!filaEncontradaGen) throw new Error(`No se encontró el id_general: ${idGeneralBuscado} en 1_general.`);

    // 2. Crear una copia de la plantilla
    const nombreNuevoReporte = `Reporte_${idGeneralBuscado}`;
    let hojaDestino = ss.getSheetByName(nombreNuevoReporte);

    // Si ya existe un reporte con ese nombre, lo eliminamos para regenerarlo
    if (hojaDestino) {
        ss.deleteSheet(hojaDestino);
    }

    hojaDestino = hojaFormato.copyTo(ss);
    hojaDestino.setName(nombreNuevoReporte);

    // 3. Llenar los datos generales
    for (const columna in MAPEO_GENERAL) {
        const celdaDestino = MAPEO_GENERAL[columna];
        const indiceCol = encabezadosGen.indexOf(columna);

        if (indiceCol !== -1) {
            const valor = filaEncontradaGen[indiceCol];

            // Si es la firma y tiene un link de imagen, usamos la función de imagen
            if (columna === 'FIRMA' && valor.toString().startsWith('http')) {
                insertarImagenEnCelda(valor, hojaDestino.getRange(celdaDestino));
            } else {
                hojaDestino.getRange(celdaDestino).setValue(valor);
            }
        }
    }

    // 4. Buscar y procesar los datos en 2_valvulas (Lógica incremental)
    const datosValvulas = hojaValvulas.getDataRange().getValues();
    const encabezadosVal = datosValvulas[0].map(h => h.toString().trim());
    const idxIdGenVal = encabezadosVal.indexOf('id_general');
    const idxLinkImage = encabezadosVal.indexOf('link_image');

    if (idxIdGenVal === -1) throw new Error("No existe la columna 'id_general' en 2_valvulas.");

    // Filtramos todas las válvulas que pertenezcan a este reporte
    const valvulasAsociadas = datosValvulas.filter((fila, idx) => idx > 0 && fila[idxIdGenVal].toString().trim() === idGeneralBuscado);

    if (valvulasAsociadas.length > 0) {
        valvulasAsociadas.forEach((valvula, index) => {
            const filaActualDestino = FILA_INICIO_VALVULAS + index;

            // Si es la segunda válvula o más, insertamos una fila y copiamos el formato de la primera
            if (index > 0) {
                hojaDestino.insertRowAfter(filaActualDestino - 1);
                const rangoOrigenFormato = hojaDestino.getRange(`${FILA_INICIO_VALVULAS}:${FILA_INICIO_VALVULAS}`);
                const rangoDestinoNuevo = hojaDestino.getRange(`${filaActualDestino}:${filaActualDestino}`);
                rangoOrigenFormato.copyTo(rangoDestinoNuevo); // Copia bordes y estilos
                rangoDestinoNuevo.clearContent(); // Limpia los datos copiados
            }

            // Llenamos las columnas para esta válvula
            for (const columna in MAPEO_VALVULAS) {
                const letraColDestino = MAPEO_VALVULAS[columna];
                const indiceColVal = encabezadosVal.indexOf(columna);

                if (indiceColVal !== -1) {
                    hojaDestino.getRange(`${letraColDestino}${filaActualDestino}`).setValue(valvula[indiceColVal]);
                }
            }

            // Procesamos la imagen de la válvula en la columna Y
            if (idxLinkImage !== -1) {
                const urlImagen = valvula[idxLinkImage];
                if (urlImagen) {
                    insertarImagenEnCelda(urlImagen, hojaDestino.getRange(`Y${filaActualDestino}`));
                }
            }
        });
    }
}

// =================================================================
// --- FUNCIONES AUXILIARES ---
// =================================================================
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
// =================================================================
// --- CONFIGURACIÓN PRINCIPAL ---
// =================================================================

const ID_BD_ORIGEN = "1RTgmI6Ftwuf3b00ELIgnQZrBvbN3Jiw36HBCAbTWuwY";
const ID_PLANTILLA_FORMATO = "1PXYfszbSF8S6ixREW1dHQemj2zCUg02FVHcNsIkrbXQ";
const ID_CARPETA_DESTINO = "1jCBZRzDskIDWDj6sHAj32YvtkTtPvfko";

const HOJA_DATOS_GENERAL = "0.ceaklist_trampas";
const HOJA_DATOS_BOQUILLAS = "0.1.Boquillas";
const HOJA_PLANTILLA_NOMBRE = "CheckList_Trampas";

// Solo necesitamos estas dos columnas clave ahora
const COLUMNA_ID_BUSQUEDA = "id_cheak_list";
const COLUMNA_LINK_SALIDA = "link_reporte";

// =================================================================
// --- MAPEO DE VARIABLES GENERALES ---
// =================================================================
const MAPEO_GENERAL = {
    // --- Cabecera General ---
    'Llave_Identificacion': 'C6', 'Item': 'D5', 'OT': 'H5', 'Vice': 'X5', 'Troncal': 'AC5',
    'Sistema': 'K6', 'Estación': 'C6', 'Trampa': 'AA6', 'NombreTag': 'T6', 'Fluido': 'AG6', 'Fecha_Inspeccion': 'AO6',

    // --- Datos Técnicos Trampa ---
    'Placa_Identificacion_Equipo': 'Z9', 'Fabricante_Trampa': 'AF9', 'Presion_Diseno_psi_Trampa': 'W11',
    'MDMT_F': 'AC11', 'Codigo_Construccion_Trampa': 'AL11', 'Year_Built_Trampa': 'X13',
    'Presion_Prueba_psi_Trampa': 'AF13', 'Num_Ensamblaje_Trampa': 'Y15', 'Tamano_Ensamablaje_Trampa': 'AL15',
    'Observación:': 'V17',

    // --- Tapa ---
    'Tapa_Apertura': 'X25', 'Forma_Tapa': 'AF25', 'h_tapa_m': 'AO25', '2.1.Observación:': 'X26',
    'Doble_Bloqueo_Tapa': 'W30', 'Venteo_Tapa': 'AF30', '2.2.Observación:': 'X31',
    'Placa_Tapa': 'W35', 'Estampe_U_Tapa': 'AE35', 'Fabricante_Tapa': 'AI35',
    'Size_Tapa_pulg': 'W37', 'Pressure_Rating_Tapa': 'AE37', 'MAWP_MWP_MOP_Tapa_psi': 'AM37',
    'Material_Placa_Tapa': 'X39', 'Temperatura_Diseno_F_Tapa': 'AJ39',
    'Factor_Diseno_Tapa': 'X41', 'Numero_Parte_Tapa': 'AE41', 'Serial_Tapa': 'AM41',
    'Fecha_Construccion_Tapa': 'X43', 'Fecha_Prueba_Tapa': 'AG43', 'Presion_Prueba_psi_Tapa': 'AO43',
    '2.3.Observación:': 'X45', 'Tipo_Union_Cuerpo_Tapa': 'AA49', '2.4.Observación:': 'V50',
    'Corrosion_Tapa': 'V54', 'Dano_Mecanico_Tapa': 'X56', 'Deform_Mecanico_Tapa': 'W58',
    'Recub_Tapa': 'Z60', 'Defec_Soldaduras_Tapa': 'Y62', '2.5.Observación:': 'X64',

    // --- Barriles y Cuerpo ---
    'Diam_Barril_Mayor_pulg': 'AA70', 'Long_Barril_Mayor_m': 'AL70', 'Barril_Menor': 'AF72',
    'Diam_Barril_Menor_pulg': 'Z74', 'Long_Barril_Menor_m': 'AK74', 'Tipo_Reduccion': 'X76',
    'Long_Reduccion_pulg': 'AJ76', 'Diam_Mayor_Reduccion_pulg': 'AD78', 'Diam_Menor_Reduccion_pulg': 'AM78',
    'Tee_Cuerpo': 'AH80', 'Tipo_Tee': 'V82', 'Long_Tee_m': 'AE82', 'Ubicacion_Tee': 'AM82',
    'Diametro_Princ_Tee_pulg': 'AD84', 'Diametro_Deriv_Tee_pulg': 'AN84', '3.1.Observación:': 'X86',

    // --- Inspección Barriles ---
    'Corrosion_Barril_Menor': 'V90', 'Dano_Mecanico_Barril_Menor': 'X92', 'Deform_Mecanico_Barril_Menor': 'W94',
    'Recub_Barril_Menor': 'Z96', 'Defec_Soldaduras_Barril_Menor': 'Y98', '3.2.Observación:': 'X100',
    'Corrosion_Barril_Mayor': 'V104', 'Dano_Mecanico_Barril_Mayor': 'X106', 'Deform_Mecanico_Barril_Mayor': 'W108',
    'Recub_Barril_Mayor': 'Z110', 'Defec_Soldaduras_Barril_Mayor': 'Y112', '3.3.Observación:': 'V114',
    'Corrosion_Reduccion': 'V119', 'Dano_Mecanico_Reduccion': 'X121', 'Deform_Mecanico_Reduccion': 'W123',
    'Recub_Reduccion': 'Z125', 'Defec_Soldaduras_Reduccion': 'Y127', '3.4.Observación:': 'X129',

    // --- Conexiones / Instrumentación ---
    'Drenaje_Barril_Menor': 'AF135', 'Diam_Drenaje__Barril_Menor_pulg': 'AN135', 'Dist_Dren_Barril_Menor_m': 'AO137',
    'Drenaje_Barril_Mayor': 'AF139', 'Diam_Drenaje_Barril_Mayor_pulg': 'AN139', 'Dist_Dren_Barril_Mayor_m': 'AO141',
    'PI_Barril_Menor': 'AL143', 'Diam_PI_Barril_Menor_pulg': 'AC145', 'Dist_PI_Barril_Menor_m': 'AN147',
    'PI_Barril_Mayor': 'AL149', 'Diam_PI_Barril_Mayor_pulg': 'AC151', 'Dist_PI_Barril_Mayor_m': 'AN153',
    'Venteo_Trampa': 'AA155', 'Diam_Venteo_pulg': 'AH155', 'Dist_Venteo_m': 'AN157',
    'Línea_Balance': 'AD159', 'Diam_Lbalance_pulg': 'AN159', 'Conexión_Lbalance_Barriles': 'AK161',
    'Dist_Lbalance_BMayor_m': 'AM163', 'Dist_Lbalance_BMenor_m': 'AM165',
    'Indicador_Paso': 'AD167', 'Diam_GIS_pulg': 'AN167', 'Dist_GIS_m': 'AN169',
    'Válvula_Alivio': 'AD171', 'Diam_PRD_pulg': 'AN171', 'Dist_PRD_m': 'AN173', 'Válvula_Alivio2': 'AH215',

    // --- PRD Datos ---
    'PRD_Tag': 'AL215', 'PRD_Placa_Calibracion': 'AA217', 'PRD_Set_Pressure_psi': 'AF217', 'PRD_Fecha_Cal': 'AN217',
    'PRD_Empresa_Cal': 'Y219', 'PRD_Marca': 'AJ219', 'PRD_Serie': 'U221', 'PRD_Modelo': 'AD221', 'PRD_Material': 'AM221',
    'PRD_Diam_In_pulg': 'W223', 'PRD_Tipo_Conexión_In': 'AE223', 'PRD_Rating_Class_In': 'AM223',
    'PRD_Diam_Out_pulg': 'W225', 'PRD_Tipo_Conexión_Out': 'AE225', 'PRD_Rating_Class_Out': 'AM225',
    'PRD_Placa_Fabrica': 'AA227', 'PRD_Fabrica_Set_Pressure_psi': 'AF227', 'PRD_Fabrica_Fecha_Cal': 'AN227',
    'PRD_Capacidad_gpm': 'V229', 'PRD_ContraPresion': 'AD229', 'PRD_Temp_F': 'AI229', 'PRD_CDTP': 'AM229',
    'PRD_Vcorte_Arriba': 'AA233', 'PRD_Vcorte_Arriba_Posicion': 'AE233', 'PRD_Vcorte_Arriba_Precinto': 'AO233',
    'PRD_Vcorte_Abajo': 'AA235', 'PRD_Vcorte_Abajo_Posicion': 'AE235', 'PRD_Vcorte_Abajo_Precinto': 'AO235',
    'PRD_Fugas': 'V237', 'PRD_Corrosion': 'V239', 'PRD_OtraCondicion': 'W241',

    // --- PI e Instrumentos Adicionales ---
    'PI_Barril_Mayor2': 'AL247', 'PI_Barril_Mayor_Rango_Inf_psi': 'W249', 'PI_Barril_Mayor_Rango_Sup_psi': 'Z249',
    'PI_Barril_Mayor_Mirrilla': 'AH249', 'PI_Barril_Mayor_Lamorti': 'AQ249',
    'PI_Barril_Menor2': 'AL251', 'PI_Barril_Menor_Rango_Inf_psi': 'W253', 'PI_Barril_Menor_Rango_Sup_psi': 'Z253',
    'PI_Barril_Menor_Mirrilla': 'AH253', 'PI_Barril_Menor_Lamorti': 'AQ253',
    'GiS_Cuerpo': 'AI255', 'GiS_Cuerpo_Ubicacion': 'AM255', 'GiS_Cuerpo_Marca': 'V257', 'GiS_Cuerpo_Modelo': 'AD257',
    'GiS_Cuerpo_Estado': 'AK257', 'GiS_Cuerpo_Fugas': 'AQ257',
    'GIS_Lprincipa': 'AL259', 'GiS_LPrincipa_Marca': 'U261', 'GiS_LPrincipa_Modelo': 'AB261',
    'GiS_LPrincipa_Estado': 'AL261', 'GiS_LPrincipa_Fugas': 'AO261', 'GIS_Dist_Deriva_m': 'AM263',

    // --- Líneas ---
    'Lbypass_Diam_pulg': 'Z271', 'Lbypass_Vbloqueo': 'AP271', 'Lpateo_Diam_Pulg': 'AF273',
    'Lpresurizacion': 'AM275', 'Lpresurizacion_Diam_Pulg': 'AA277', 'Lpresurizacion_Vbloqueo': 'AF279', 'Lpresurizacion_Vglobo': 'AF281',

    // --- Area de Trabajo ---
    'Atrabajo_X': 'V291', 'Atrabajo_Y': 'AC291', 'Atrabajo_Dist_BOP_Tapa': 'AM293',

    // --- Soportes y Fundación ---
    'Soporte_Silleta_Metalicas': 'AD302', 'Soporte_SKID': 'AN302', 'Soporte_Oizaje': 'AB304', 'Soporte_Aterram': 'AO304',
    'Soporte_NoSilleta_Barril_Mayor': 'AA306', 'Soporte_NoSilleta_Barril_Menor': 'AL306',
    'Soporte_Dis_Silleta_m': 'Y308', 'Altura_Pedestales_m': 'AL308',
    'Soporte_Actual_Tipo': 'W316', 'Soporte_Nactual': 'AL316', 'Soporte_Rec': 'Y318',
    'Soporte_Agr': 'AG318', 'Soporte_Pmaterial': 'AO318', 'Soporte_Hilos_Panclaje': 'AB320',
    'Soporte_Deformacion': 'AH320', 'Soporte_Desajuste': 'AN320', 'Fundacion_Agrit': 'AG322', 'Fundacion_Pmaterial': 'AO322',

    // --- Empaque ---
    'Tipo de Empaque': 'Z331', 'Frecuencia de cambio de empaque': 'AB333', 'Empaque Original': 'Z335',
    'Evento de falla': 'AK337', 'Frecuencia de falla': 'AB343', 'Frecuencia de Operación trampa': 'W347'
};

// =================================================================
// --- MAPEO DE BOQUILLAS ---
// =================================================================
const CONFIG_BOQUILLAS = {
    tabla1: {
        filaInicioOriginal: 180,
        mapeo: {
            'Ítem': 'B', 'Diámetro pulg NPS': 'D', 'Tipo Derivación': 'G', 'Rating / Class': 'K',
            'Tipo de Conexión': 'N', 'Tipo de Cara': 'Q', 'Distancia a Soldadura de Referencia (m)': 'S',
            'Soldadura de Referencia': 'W', 'Ubicación Horaria': 'Z', 'Ubicación en cuerpo': 'AC', 'Servicio': 'AG'
        }
    },
    tabla2: {
        filaInicioOriginal: 199,
        mapeo: {
            'Corrosión Espárragos': 'D', 'Corrosión en Tuercas': 'G', 'Corrosión en Cuerpo': 'J',
            'Corrosión en Cara': 'M', 'Corrosión en Hilos': 'P', 'Fugas': 'S', 'Grietas': 'U',
            'Desalineamiento': 'W', 'Tensionamiento o Sobreesfuerzos': 'AA', 'Estado de Soldaduras': 'AE',
            'Recubri.': 'AH', 'Observaciones': 'AK'
        }
    }
};

// =================================================================
// --- FUNCIONES DE INTERFAZ Y MENÚ ---
// =================================================================
function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('📄 Reportes Trampas')
        .addItem('⚡ Generar Faltantes (Sin Link)', 'generarMultiplesReportes')
        .addItem('Generar Reporte por ID Manual', 'dialogoManual')
        .addToUi();
}

function dialogoManual() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.prompt('Generar Reporte', 'Ingresa el ID (id_cheak_list):', ui.ButtonSet.OK_CANCEL);
    if (result.getSelectedButton() == ui.Button.OK) {
        const id = result.getResponseText();
        ui.alert('Iniciando... espera el mensaje de confirmación.');
        try {
            const url = generarReporteMaestro(id);
            ui.alert(`✅ Reporte generado con éxito:\n${url}`);
        } catch (e) {
            ui.alert(`❌ Error: ${e.message}`);
        }
    }
}

// =================================================================
// --- PROCESAMIENTO MASIVO (SOLO FALTANTES) ---
// =================================================================
function generarMultiplesReportes() {
    const ss = SpreadsheetApp.openById(ID_BD_ORIGEN);
    const sheet = ss.getSheetByName(HOJA_DATOS_GENERAL);
    const data = sheet.getDataRange().getValues();

    // Normalización de encabezados
    const headers = data[0].map(h => String(h).trim().toLowerCase());

    const idIdx = headers.indexOf(COLUMNA_ID_BUSQUEDA.toLowerCase());
    const linkIdx = headers.indexOf(COLUMNA_LINK_SALIDA.toLowerCase());

    if (idIdx === -1) {
        SpreadsheetApp.getUi().alert(`Error: No se encontró la columna de ID (${COLUMNA_ID_BUSQUEDA}).`);
        return;
    }
    if (linkIdx === -1) {
        SpreadsheetApp.getUi().alert(`Error: No se encontró la columna de salida (${COLUMNA_LINK_SALIDA}). Asegúrate de que exista.`);
        return;
    }

    let generados = 0;

    for (let i = 1; i < data.length; i++) {
        let valId = data[i][idIdx];
        let valLink = data[i][linkIdx];

        // Si hay un ID y el link_reporte está vacío o no es un link de drive
        if (valId && (!valLink || !String(valLink).includes("drive.google.com"))) {

            // Escribe "Generando..." temporalmente en la columna de link para que sepas por dónde va
            sheet.getRange(i + 1, linkIdx + 1).setValue("Generando...");
            SpreadsheetApp.flush();

            try {
                let urlCreada = generarReporteMaestro(valId);
                // Pega el link directo en la columna link_reporte
                sheet.getRange(i + 1, linkIdx + 1).setValue(urlCreada);
                generados++;
            } catch (e) {
                // Si hay error, lo pone en la columna de link
                sheet.getRange(i + 1, linkIdx + 1).setValue("Error: " + e.message);
            }
        }
    }

    SpreadsheetApp.getUi().alert('✅ Proceso Finalizado', `Se generaron ${generados} reportes exitosamente.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

// =================================================================
// --- FUNCIÓN MAESTRA DE GENERACIÓN (POR ID) ---
// =================================================================
function generarReporteMaestro(idObjetivo) {
    const ssOrigen = SpreadsheetApp.openById(ID_BD_ORIGEN);
    const hojaGeneral = ssOrigen.getSheetByName(HOJA_DATOS_GENERAL);

    if (!hojaGeneral) throw new Error(`No se encontró la hoja: ${HOJA_DATOS_GENERAL}`);

    const datosG = hojaGeneral.getDataRange().getValues();
    const headersGRaw = datosG[0].map(h => String(h).trim());
    const headersGLower = headersGRaw.map(h => h.toLowerCase());

    // Buscar la columna del ID
    const idxIdG = headersGLower.indexOf(COLUMNA_ID_BUSQUEDA.toLowerCase());
    if (idxIdG === -1) throw new Error("No se encontró la columna de ID en la hoja general.");

    // Encontrar la fila del ID
    const filaDatos = datosG.find(row => String(row[idxIdG]).trim() == String(idObjetivo).trim());
    if (!filaDatos) throw new Error(`El ID "${idObjetivo}" no existe en los registros.`);

    // --- Construcción del Nombre del Archivo con Fecha ---
    const hoy = new Date();
    const fechaFormateada = Utilities.formatDate(hoy, Session.getScriptTimeZone(), "dd-MM-yyyy");
    const idxTag = headersGLower.indexOf('nombretag');
    const tagName = idxTag > -1 ? filaDatos[idxTag] : "SinTag";
    const nombreArchivo = `Reporte_${tagName}_ID-${idObjetivo}_${fechaFormateada}`;

    // --- Carpeta Destino Directa ---
    const carpetaSalida = DriveApp.getFolderById(ID_CARPETA_DESTINO);
    const archivoPlantilla = DriveApp.getFileById(ID_PLANTILLA_FORMATO);

    // Crear copia
    const archivoNuevo = archivoPlantilla.makeCopy(nombreArchivo, carpetaSalida);
    const ssNuevo = SpreadsheetApp.openById(archivoNuevo.getId());

    let hojaDestino = ssNuevo.getSheetByName(HOJA_PLANTILLA_NOMBRE);
    if (!hojaDestino) hojaDestino = ssNuevo.getSheets()[0];

    // --- Llenado de Variables Generales ---
    for (const [columnaBD, celdaDestino] of Object.entries(MAPEO_GENERAL)) {
        const idx = headersGLower.indexOf(columnaBD.toLowerCase().trim());
        if (idx !== -1) {
            hojaDestino.getRange(celdaDestino).setValue(filaDatos[idx]);
        }
    }

    // --- Procesar Boquillas ---
    const hojaBoquillas = ssOrigen.getSheetByName(HOJA_DATOS_BOQUILLAS);
    procesarBoquillas(idObjetivo, hojaBoquillas, hojaDestino);

    SpreadsheetApp.flush();

    // --- Generar PDF ---
    try {
        const pdfBlob = archivoNuevo.getAs('application/pdf');
        carpetaSalida.createFile(pdfBlob).setName(nombreArchivo + ".pdf");
    } catch (e) {
        // Falla de PDF ignorada, devuelve el link del sheet de todos modos
    }

    return archivoNuevo.getUrl();
}

// =================================================================
// --- LÓGICA DE BOQUILLAS ---
// =================================================================
function procesarBoquillas(id, hojaFuente, hojaDestino) {
    if (!hojaFuente) return;

    const datos = hojaFuente.getDataRange().getValues();
    const headers = datos[0].map(h => String(h).trim().toLowerCase());
    const idxId = headers.indexOf(COLUMNA_ID_BUSQUEDA.toLowerCase());

    if (idxId === -1) return;

    const boquillas = datos.filter(row => String(row[idxId]).trim() == String(id).trim());
    if (boquillas.length === 0) return;

    let filasAgregadas = 0;
    boquillas.forEach((boquilla, i) => {
        let f1 = CONFIG_BOQUILLAS.tabla1.filaInicioOriginal + i;
        let f2 = CONFIG_BOQUILLAS.tabla2.filaInicioOriginal + filasAgregadas + i;

        if (i > 0) {
            hojaDestino.insertRowAfter(f1 - 1);
            hojaDestino.getRange(f1 - 1, 1, 1, 50).copyTo(hojaDestino.getRange(f1, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
            filasAgregadas++;

            f2 = CONFIG_BOQUILLAS.tabla2.filaInicioOriginal + filasAgregadas + i;
            hojaDestino.insertRowAfter(f2 - 1);
            hojaDestino.getRange(f2 - 1, 1, 1, 50).copyTo(hojaDestino.getRange(f2, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        }

        for (const [header, col] of Object.entries(CONFIG_BOQUILLAS.tabla1.mapeo)) {
            const idx = headers.indexOf(header.toLowerCase());
            if (idx !== -1) hojaDestino.getRange(`${col}${f1}`).setValue(boquilla[idx]);
        }

        for (const [header, col] of Object.entries(CONFIG_BOQUILLAS.tabla2.mapeo)) {
            const idx = headers.indexOf(header.toLowerCase());
            if (idx !== -1) hojaDestino.getRange(`${col}${f2}`).setValue(boquilla[idx]);
        }
    });
}
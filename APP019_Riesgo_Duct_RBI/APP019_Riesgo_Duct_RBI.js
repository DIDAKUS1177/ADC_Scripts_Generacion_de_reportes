/**
 * =================================================================
 * --- ARCHIVO: ReporteChecklistLinea.gs (v16 - Con Selector de Secciones) ---
 * =================================================================
 * v16: Versión con interfaz gráfica para seleccionar secciones específicas.
 * * CAMBIOS:
 * 1. UI MEJORADA: Se reemplaza el prompt simple por un diálogo HTML con checkboxes.
 * 2. FILTRADO: El reporte solo genera las secciones marcadas en el diálogo.
 * 3. COMPATIBILIDAD: El trigger automático (onEdit) sigue generando TODO por defecto.
 * @author  Diego Alejandro Hernandez Blanco
 */

// =================================================================
// --- CONFIGURACIÓN PRINCIPAL (CHECKLIST LÍNEA) ---
// =================================================================

const ID_BD_GENERAL = SpreadsheetApp.getActiveSpreadsheet().getId();
const ID_PLANTILLA = ID_BD_GENERAL;
const NOMBRE_CARPETA_RAIZ_REPORTES = "REPORTES_CHECKLIST_LINEA";
const NOMBRE_HOJA_FORMATO = "formato_cheack_list_format";
const NOMBRE_HOJA_ACTIVADORA = "1_general";
const COLUMNA_PVID = "id_general";
const COLUMNA_ACTIVADORA = "GenerarReporteTrigger";
const COLUMNA_LINK_REPORTE = "LinkReporte";

const MAPEO_DE_CELDAS = {
    'Nombre_de_la_Linea': 'I8',
    'Fecha': 'V8',
    'DR_Inicial_(m)': 'AL8',
    'DR_Final_(m)': 'AV8'
};

// =================================================================
// --- CONFIGURACIÓN DE PROCESAMIENTO ---
// =================================================================

const SECCIONES_POR_LOTE = 1;
// Límite de seguridad: 4.5 Minutos (270,000 ms)
const TIEMPO_MAXIMO_EJECUCION_MS = 4.5 * 60 * 1000;

// --- CLAVES PARA GUARDAR EL ESTADO ---
const PROP_VALOR_BUSCADO = 'VALOR_BUSCADO';
const PROP_START_INDEX = 'START_INDEX';
const PROP_TOTAL_FILAS_INSERTADAS = 'TOTAL_FILAS_INSERTADAS';
const PROP_SECTION_KEYS = 'SECTION_KEYS';
const PROP_REPORTE_ID = 'REPORTE_ID';
const PROP_CARPETA_ID = 'CARPETA_ID';
const PROP_NOMBRE_REPORTE = 'NOMBRE_REPORTE';

// --- CLAVES PARA PAGINACIÓN DE FOTOS (ESTADO PARCIAL) ---
const PROP_RESUME_SECTION_KEY = 'RESUME_SECTION_KEY';
const PROP_RESUME_PHOTO_INDEX = 'RESUME_PHOTO_INDEX';
const PROP_ACUM_ROWS_SECTION = 'ACUM_ROWS_SECTION';


// =================================================================
// --- CONFIGURACIÓN MODULAR POR SECCIONES ---
// =================================================================
const SECTIONS_CONFIG = {
    // #2_operacional
    operacional: {
        sheetName: '2_operacional',
        mapping: { 'Verificar_en_los_planos_de_la_linea': 'B17', 'Verificar_en_los_planos_de_la_estacion': 'J17', 'Verificar_en_los_diagramas': 'S17', 'Presencia_de_hitos_de_concreto': 'W17', 'Observaciones': 'AG17', 'cordenadas': 'AB17' },
        dataStartRow: 17,
        photosConfig: { photoSheetName: '2_operacional_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C21', 'P21', 'AC21', 'AP21'], descCells: ['C22', 'P22', 'AC22', 'AP22'] }
    },
    // #3_valvulas_corte_unidireccionales
    valvulasCorte: {
        sheetName: '3_valvula',
        mapping: { 'DR_(m)': 'C27', 'NPS': 'F27', 'Tipo_de_Valvula': 'H27', 'Material_Cuerpo': 'J27', 'Rating_Class': 'O27', 'Tipo_Conexion': 'S27', 'Condicion_Sello': 'W27', 'Estado_Recubrimiento': 'AA27', 'Hay_presencia_de_fugas': 'AE27', 'Observaciones': 'AG27', 'cordenadas': 'AB27' },
        dataStartRow: 27,
        photosConfig: { photoSheetName: '3_valvulas_corte_unidireccionales_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C31', 'P31', 'AC31', 'AP31'], descCells: ['C32', 'P32', 'AC32', 'AP32'] }
    },
    // #4_dispositivos
    dispositivos: {
        sheetName: '4_dispositivos',
        mapping: { 'DR_(m)': 'C37', 'Tag': 'F37', 'Marca': 'H37', 'Modelo': 'J37', 'Serial': 'M37', 'Registrar_tamano_de_la_brida_de_entrada': 'O37', 'Registrar_tamano_de_la_brida_de_salida': 'S37', 'Registrar_la_presion_de_ajuste': 'W37', 'Registrar_la_fecha_de_la_ultima_calibracion': 'AA37', 'Hay_fugas_en_uniones': 'AE37', 'pernos_bridas_seguros': 'AI37', 'Los_pernos_de_las_bridas_estan_completos': 'AM37', 'Las_valvulas_de_bloqueo_estan_abiertas_y_selladas': 'AP37', 'Observaciones': 'AV37', 'cordenadas': 'AS37' },
        dataStartRow: 37,
        photosConfig: { photoSheetName: '4_dispositivos_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C41', 'P41', 'AC41', 'AP41'], descCells: ['C42', 'P42', 'AC42', 'AP42'] }
    },
    // #5_soportes
    soportes: {
        sheetName: '5_soportes',
        mapping: { 'DR_(m)': 'C47', 'Tipo_Soporte': 'F47', 'Anclaje_Soporte': 'H47', 'Accesorio_Soporte': 'J47', 'Aislamiento_Dielectrico': 'M47', 'Contacto_Soporte_Tubo': 'Q47', 'Estado_Recubrimiento': 'U47', 'Estado_Concreto': 'Y47', 'Ausencia_Partes_Flojas': 'AC47', 'Desajuste_Pernos': 'AG47', 'Corrosion_Soporte': 'AK47', 'Deformacion_Soporte': 'AO47', 'Observaciones': 'AV47', 'cordenadas': 'AS47' },
        dataStartRow: 47,
        photosConfig: { photoSheetName: '5_soportes_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C51', 'P51', 'AC51', 'AP51'], descCells: ['C52', 'P52', 'AC52', 'AP52'] }
    },
    // #6_recubrimiento
    recubrimiento: {
        sheetName: '6_recubrimiento',
        mapping: { 'DR_Inicial_(m)': 'C57', 'DR_Final_(m)': 'H57', 'NPS': 'M57', 'Tipo_Dano': 'R57', 'Tipo_Calidad': 'W57', 'Observaciones': 'AC57', 'cordenadas': 'Z57' },
        dataStartRow: 57,
        photosConfig: { photoSheetName: '6_recubrimiento_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C61', 'P61', 'AC61', 'AP61'], descCells: ['C62', 'P62', 'AC62', 'AP62'] }
    },
    // #7_estado_mecanico
    estadoMecanico: {
        sheetName: '7_estado_mecanico',
        mapping: { 'DR_Inicio': 'C67', 'DR_Final': 'G67', 'NPS': 'K67', 'Condicion': 'O67', 'Observaciones': 'W67', 'cordenadas': 'S67' },
        dataStartRow: 67,
        photosConfig: { photoSheetName: '7_estado_mecanico_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C71', 'P71', 'AC71', 'AP71'], descCells: ['C72', 'P72', 'AC72', 'AP72'] }
    },
    // #8_interfase
    interfase: {
        sheetName: '8_interfase',
        mapping: { 'DR_(m)': 'C77', 'Estado_de_Recubrimiento': 'K77', 'Observaciones': 'W77', 'cordenadas': 'S77' },
        dataStartRow: 77,
        photosConfig: { photoSheetName: '8_interfase_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C81', 'P81', 'AC81', 'AP81'], descCells: ['C82', 'P82', 'AC82', 'AP82'] }
    },
    // #9_interferencia
    interferencia: {
        sheetName: '9_interferencia',
        mapping: { 'DR': 'C87', 'Tipo_interferencia': 'K87', 'Observaciones': 'W87', 'cordenadas': 'S87' },
        dataStartRow: 87,
        photosConfig: { photoSheetName: '9_interferencia_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C91', 'P91', 'AC91', 'AP91'], descCells: ['C92', 'P92', 'AC92', 'AP92'] }
    },
    // #10_cuerpos_de_agua
    cuerposDeAgua: {
        sheetName: '10_cuerpos_de_agua',
        mapping: { 'DR_Inicio': 'C97', 'DR_Final': 'G97', 'Tuberia_esta_soportada': 'K97', 'Documentacion': 'O97', 'Observaciones': 'W97', 'cordenadas': 'S97' },
        dataStartRow: 97,
        photosConfig: { photoSheetName: '10_cuerpos_de_agua_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C101', 'P101', 'AC101', 'AP101'], descCells: ['C102', 'P102', 'AC102', 'AP102'] }
    },
    // #11_cruces_de_via
    crucesDeVia: {
        sheetName: '11_cruces_de_via',
        mapping: { 'DR_Inicio': 'C107', 'DR_Final': 'G107', 'Tuberia_esta_encamisada': 'K107', 'Documentar_estado_del_sello_venteo': 'O107', 'Pasan_por_encima_o_por_debajo': 'W107', 'La_tuberia_esta_soportada': 'AA107', 'En_caso_de_puente_registrar_estado': 'AE107', 'Observaciones': 'AI107', 'cordenadas': 'S107' },
        dataStartRow: 107,
        photosConfig: { photoSheetName: '11_cruces_de_via_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C111', 'P111', 'AC111', 'AP111'], descCells: ['C112', 'P112', 'AC112', 'AP112'] }
    },
    // #12_vivienda
    vivienda: {
        sheetName: '12_vivienda',
        mapping: { 'DR_Inicio': 'C117', 'DR_Final': 'G117', 'Registrar_proximidad_de_viviendas': 'K117', 'Hay_viviendas_dentro_de_la_servidumbre': 'W117', 'Observaciones': 'AE117', 'cordenadas': 'S117' },
        dataStartRow: 117,
        photosConfig: { photoSheetName: '12_vivienda_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C121', 'P121', 'AC121', 'AP121'], descCells: ['C122', 'P122', 'AC122', 'AP122'] }
    },
    // #13_servidumbre
    servidumbre: {
        sheetName: '13_servidumbre',
        mapping: { 'DR_Inicio': 'C127', 'DR_Final': 'G127', 'Condicion_estado_de_la_servidumbre': 'K127', 'Observaciones': 'W127', 'cordenadas': 'S127' },
        dataStartRow: 127,
        photosConfig: { photoSheetName: '13_servidumbre_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C131', 'P131', 'AC131', 'AP131'], descCells: ['C132', 'P132', 'AC132', 'AP132'] }
    },
    // #14_interferencias
    interferenciasElectricas: {
        sheetName: '14_interferencias',
        mapping: { 'DR_(m)': 'C136', 'Fuente_de_corriente': 'K136', 'Observaciones': 'W136', 'cordenadas': 'S136' },
        dataStartRow: 136,
        photosConfig: { photoSheetName: '14_interferencias_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C140', 'P140', 'AC140', 'AP140'], descCells: ['C141', 'P141', 'AC141', 'AP141'] }
    },
    // #15_instrumentacion
    instrumentacion: {
        sheetName: '15_instrumentacion',
        mapping: { 'DR_(m)': 'C146', 'tipo_de_instrumento': 'K146', 'tag_instrumento': 'W146', 'observaciones_instrumento': 'AA146', 'cordenadas': 'S146' },
        dataStartRow: 146,
        photosConfig: { photoSheetName: '15_instrumentacion_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C150', 'P150', 'AC150', 'AP150'], descCells: ['C151', 'P151', 'AC151', 'AP151'] }
    },
    // #16_aislamiento_termico
    aislamientoTermico: {
        sheetName: '16_aislamiento_termico',
        mapping: { 'DR_Inicio': 'C157', 'DR_Final': 'G157', 'nps_aislamiento': 'K157', 'danos_perforaciones_aislamiento': 'O157', 'falta_recubrimiento_aislamiento': 'S157', 'deterioro_sellado_aislamiento': 'W157', 'abultamiento_aislamiento': 'AA157', 'cintas_rotas_faltantes': 'AE157', 'observaciones_aislamiento': 'AM157', 'cordenadas': 'AI157' },
        dataStartRow: 157,
        photosConfig: { photoSheetName: '16_aislamiento_termico_photos', idColumnName: 'id_general', photoLinkColumnName: 'photo_url', photoCells: ['C161', 'P161', 'AC161', 'AP161'], descCells: ['C162', 'P162', 'AC162', 'AP162'] }
    },
    // #17_abscisa_tuberia
    abscisaTuberia: {
        sheetName: '17_abscisa_de_tuberia',
        mapping: { 'DR_(m)': 'C169', 'cordenadas': 'O169', 'observaciones': 'W169' },
        dataStartRow: 169,
        photosConfig: null
    }
};


// =================================================================
// --- PARTE 1: ACTIVADORES (onOpen, onEdit)
// =================================================================

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Reportes Checklist RBI')
        .addItem('1. 📄 Generar reporte por ID (manual)', 'generarPorIdManual')
        .addItem('2. 🚀 Generar reportes (selección múltiple)', 'mostrarPanelSelectorMasivo')
        .addItem('3. ⏳ Generar todos los pendientes', 'generarTodosPendientes')
        .addSeparator()
        .addItem('🗑️ Limpiar cola / reiniciar disparadores', 'limpiarColaDisparo')
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
        if (range.getColumn() !== triggerColIndex) return;
        if (linkColIndex === 0 || pvIdColIndex === 0) return;
        Utilities.sleep(1000);
        const valorDeLaCelda = range.getValue();
        const valorNormalizado = valorDeLaCelda ? valorDeLaCelda.toString().trim().toLowerCase() : '';
        if (valorNormalizado === 'yes' || valorNormalizado === 'true') {
            const pvId = sheet.getRange(editedRow, pvIdColIndex).getValue();
            if (!pvId) {
                sheet.getRange(editedRow, linkColIndex).setValue('ERROR: Falta ID');
                range.setValue('Error');
                return;
            }
            try {
                // Generación automática: envía SOLO el ID, esto provoca que se seleccionen TODAS las secciones
                iniciarGeneracionEncadenada(pvId);
                sheet.getRange(editedRow, linkColIndex).setValue('Generando...');
                range.setValue('No');
            } catch (error) {
                Logger.log(`Error al *iniciar* reporte para pvID ${pvId}: ${error.toString()}`);
                sheet.getRange(editedRow, linkColIndex).setValue(`ERROR al iniciar: ${error.message}`);
                range.setValue('Error');
            }
        }
    }
}


// =================================================================
// --- PARTE 2: INTERFAZ Y PROCESO ENCADENADO
// =================================================================

/**
 * Muestra el panel HTML lateral/modal para seleccionar secciones.
 */
function mostrarPanelDeEntrada() {
    // Generar lista de checkboxes dinámicamente basada en SECTIONS_CONFIG
    let optionsHtml = '';
    for (const key in SECTIONS_CONFIG) {
        const label = SECTIONS_CONFIG[key].sheetName || key;
        // Checkbox marcado por defecto
        optionsHtml += `
        <div style="margin-bottom: 5px;">
            <label>
                <input type="checkbox" name="secciones" value="${key}" checked> 
                ${label}
            </label>
        </div>`;
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <base target="_top">
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 15px; color: #333; }
            .group { margin-bottom: 15px; border: 1px solid #ccc; padding: 10px; border-radius: 5px; background: #fafafa; }
            button { background-color: #1976d2; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; font-size: 14px; transition: 0.3s; }
            button:hover { background-color: #1565c0; }
            h3 { margin-top: 0; color: #1565c0; }
        </style>
    </head>
    <body>
        <h3>Configurar Reporte</h3>
        
        <div class="group">
            <label style="font-weight:bold; display:block; margin-bottom:5px;">ID General (${COLUMNA_PVID}):</label>
            <input type="text" id="reporteId" style="width: 100%; padding: 5px;" placeholder="Ej: ID_001">
        </div>

        <div class="group">
            <label style="font-weight:bold; display:block; margin-bottom:5px;">Secciones a incluir:</label>
            <div id="listaSecciones" style="max-height: 250px; overflow-y: auto;">
                ${optionsHtml}
            </div>
        </div>

        <button onclick="ejecutar()">Generar Reporte</button>
        <div id="mensaje" style="margin-top:10px; color: green;"></div>

        <script>
            function ejecutar() {
                const id = document.getElementById('reporteId').value;
                if(!id) {
                    alert('Por favor ingrese un ID.');
                    return;
                }
                
                // Obtener checkboxes marcados
                const checkboxes = document.querySelectorAll('input[name="secciones"]:checked');
                let seleccionadas = [];
                checkboxes.forEach((cb) => {
                    seleccionadas.push(cb.value);
                });

                if(seleccionadas.length === 0) {
                    alert('Debe seleccionar al menos una sección.');
                    return;
                }

                document.getElementById('mensaje').innerText = 'Iniciando... puede cerrar esta ventana.';
                
                // Llamar a la función del servidor
                google.script.run
                    .withSuccessHandler(function() { google.script.host.close(); })
                    .withFailureHandler(function(e) { alert('Error: ' + e); })
                    .iniciarGeneracionEncadenada(id, seleccionadas);
            }
        </script>
    </body>
    </html>
    `;

    const htmlOutput = HtmlService.createHtmlOutput(htmlContent)
        .setWidth(400)
        .setHeight(500);

    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Generador de Reportes');
}

/**
 * Función principal llamada por el HTML o el Trigger.
 * @param {string} valorBuscado - El ID del reporte.
 * @param {Array<string>} [seccionesSeleccionadas] - Array opcional con las keys de las secciones. Si es null, usa todas.
 */
function iniciarGeneracionEncadenada(valorBuscado, seccionesSeleccionadas) {
    const ui = SpreadsheetApp.getUi();

    if (!valorBuscado) {
        Logger.log(`El ID del reporte no puede estar vacío.`);
        try { ui.alert(`El ID del reporte no puede estar vacío.`); } catch (e) { }
        return;
    }

    try {
        limpiarPropiedadesEstado();
        borrarTriggersExistentes('procesarLoteSeccionesTrigger');

        // Determinar qué secciones correr
        let keysToRun;
        if (seccionesSeleccionadas && Array.isArray(seccionesSeleccionadas) && seccionesSeleccionadas.length > 0) {
            keysToRun = seccionesSeleccionadas;
            Logger.log("Iniciando con selección manual: " + JSON.stringify(keysToRun));
        } else {
            keysToRun = Object.keys(SECTIONS_CONFIG); // Todas
            Logger.log("Iniciando con TODAS las secciones (Automático)");
        }

        const scriptProperties = PropertiesService.getScriptProperties();
        scriptProperties.setProperty(PROP_VALOR_BUSCADO, valorBuscado);

        // Guardar las secciones filtradas en las propiedades para que el trigger las lea
        scriptProperties.setProperty(PROP_SECTION_KEYS, JSON.stringify(keysToRun));

        scriptProperties.setProperty(PROP_START_INDEX, '0');
        scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, '0');

        // Resetear estado de reanudación
        scriptProperties.deleteProperty(PROP_RESUME_SECTION_KEY);
        scriptProperties.deleteProperty(PROP_RESUME_PHOTO_INDEX);
        scriptProperties.deleteProperty(PROP_ACUM_ROWS_SECTION);

        scriptProperties.setProperty(PROP_REPORTE_ID, '');
        scriptProperties.setProperty(PROP_CARPETA_ID, '');
        scriptProperties.setProperty(PROP_NOMBRE_REPORTE, '');

        crearSiguienteTrigger('procesarLoteSeccionesTrigger');

        // Solo mostramos alerta si estamos en modo manual (UI disponible)
        // try {
        //     ui.alert('Proceso Iniciado en segundo plano.'); 
        // } catch (e) {}

    } catch (e) {
        Logger.log(`Error inicio: ${e.stack}`);
        limpiarPropiedadesEstado();
        throw e; // Re-lanzar para que el frontend lo vea
    }
}

// =================================================================
// --- PARTE 3: EL TRABAJADOR PRINCIPAL (TRIGGER)
// =================================================================
function procesarLoteSeccionesTrigger() {
    const scriptProperties = PropertiesService.getScriptProperties();
    let estado = {};

    try {
        const startTime = new Date().getTime();

        // --- 1. Recuperar Estado ---
        estado.valorBuscado = scriptProperties.getProperty(PROP_VALOR_BUSCADO);
        if (!estado.valorBuscado) {
            borrarTriggerActual('procesarLoteSeccionesTrigger');
            return;
        }

        estado.startIndex = parseInt(scriptProperties.getProperty(PROP_START_INDEX) || '0');
        estado.totalFilasInsertadasGlobal = parseInt(scriptProperties.getProperty(PROP_TOTAL_FILAS_INSERTADAS) || '0');

        estado.resumeSectionKey = scriptProperties.getProperty(PROP_RESUME_SECTION_KEY);
        estado.resumePhotoIndex = parseInt(scriptProperties.getProperty(PROP_RESUME_PHOTO_INDEX) || '0');
        estado.acumRowsSection = parseInt(scriptProperties.getProperty(PROP_ACUM_ROWS_SECTION) || '0');

        estado.reporteId = scriptProperties.getProperty(PROP_REPORTE_ID);
        estado.carpetaId = scriptProperties.getProperty(PROP_CARPETA_ID);
        estado.nombreReporte = scriptProperties.getProperty(PROP_NOMBRE_REPORTE);

        // RECUPERAR LAS SECCIONES FILTRADAS O COMPLETAS
        let sectionKeysStr = scriptProperties.getProperty(PROP_SECTION_KEYS);
        estado.sectionKeys = sectionKeysStr ? JSON.parse(sectionKeysStr) : [];

        // Fallback de seguridad si el array estuviera vacío (no debería pasar si iniciarGeneracionEncadenada funciona bien)
        if (estado.sectionKeys.length === 0) {
            estado.sectionKeys = Object.keys(SECTIONS_CONFIG);
        }

        Logger.log(`Trigger Ejecutando. ID: ${estado.valorBuscado}. Reanudando Key: ${estado.resumeSectionKey || 'No'}. Idx Foto: ${estado.resumePhotoIndex}`);

        let spreadsheetDatosGeneral, nuevoReporteSpreadsheet, hojaFormatoDestino, carpetaReporteIndividual;

        // --- 2. Setup Inicial (Solo si es nuevo y no estamos reanudando a medias) ---
        if (estado.startIndex === 0 && !estado.resumeSectionKey) {
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            const hojaDatosGeneral = spreadsheetDatosGeneral.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
            const datosGenerales = hojaDatosGeneral.getDataRange().getValues();
            const headers = datosGenerales[0].map(h => typeof h === 'string' ? h.trim() : h);
            const idCol = headers.indexOf(COLUMNA_PVID);
            let rowData = null, rowIndex = -1;
            for (let i = 1; i < datosGenerales.length; i++) {
                if (datosGenerales[i][idCol] != null && datosGenerales[i][idCol].toString().trim() === estado.valorBuscado.toString().trim()) {
                    rowData = datosGenerales[i];
                    rowIndex = i + 1;
                    break;
                }
            }
            if (!rowData) throw new Error("ID no encontrado en BD General");

            const nameCol = headers.indexOf('Nombre_de_la_Linea');
            const nombreLinea = nameCol !== -1 ? rowData[nameCol] : 'SIN_LINEA';
            estado.nombreReporte = `Reporte CheckList - ${nombreLinea} (${estado.valorBuscado})`;

            // Usamos la función auxiliar ROBUSTA
            carpetaReporteIndividual = buscarOCrearCarpetaReporte(hojaDatosGeneral, rowIndex, estado.nombreReporte);
            estado.carpetaId = carpetaReporteIndividual.getId();

            nuevoReporteSpreadsheet = SpreadsheetApp.create(estado.nombreReporte);
            estado.reporteId = nuevoReporteSpreadsheet.getId();
            DriveApp.getFileById(estado.reporteId).moveTo(carpetaReporteIndividual);

            const plantillaSpreadsheet = SpreadsheetApp.openById(ID_PLANTILLA);
            const plantillaSheet = plantillaSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
            hojaFormatoDestino = plantillaSheet.copyTo(nuevoReporteSpreadsheet).setName(NOMBRE_HOJA_FORMATO);
            try {
                const defaultSheet = nuevoReporteSpreadsheet.getSheets()[0];
                if (defaultSheet.getName() !== NOMBRE_HOJA_FORMATO) nuevoReporteSpreadsheet.deleteSheet(defaultSheet);
            } catch (e) { }

            for (const col in MAPEO_DE_CELDAS) {
                const idx = headers.indexOf(col);
                if (idx !== -1) hojaFormatoDestino.getRange(MAPEO_DE_CELDAS[col]).setValue(rowData[idx]);
            }

            // IMPORTANTE: NO sobrescribir SECTION_KEYS aquí si ya vienen filtradas desde properties
            // Solo aseguramos que existan en properties
            if (!scriptProperties.getProperty(PROP_SECTION_KEYS)) {
                scriptProperties.setProperty(PROP_SECTION_KEYS, JSON.stringify(Object.keys(SECTIONS_CONFIG)));
            }

            scriptProperties.setProperty(PROP_REPORTE_ID, estado.reporteId);
            scriptProperties.setProperty(PROP_CARPETA_ID, estado.carpetaId);
            scriptProperties.setProperty(PROP_NOMBRE_REPORTE, estado.nombreReporte);
        } else {
            // Apertura de archivos existentes
            spreadsheetDatosGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
            nuevoReporteSpreadsheet = SpreadsheetApp.openById(estado.reporteId);
            hojaFormatoDestino = nuevoReporteSpreadsheet.getSheetByName(NOMBRE_HOJA_FORMATO);
            carpetaReporteIndividual = DriveApp.getFolderById(estado.carpetaId);
        }

        // --- 3. Selección de Secciones ---
        let seccionesAProcesar = [];
        if (estado.resumeSectionKey) {
            seccionesAProcesar.push(estado.resumeSectionKey);
        } else {
            const total = estado.sectionKeys.length;
            const fin = Math.min(estado.startIndex + SECCIONES_POR_LOTE, total);
            for (let i = estado.startIndex; i < fin; i++) seccionesAProcesar.push(estado.sectionKeys[i]);
        }

        let incompleta = false;

        // --- 4. Procesamiento ---
        for (const key of seccionesAProcesar) {
            const config = SECTIONS_CONFIG[key];
            if (!config) continue;

            // FIX BUCLE: Determinamos explícitamente si estamos reanudando esta sección.
            // Esta es la clave para que NO inserte textos repetidos.
            const isResumingContext = (key === estado.resumeSectionKey);
            const startPhotoIdx = isResumingContext ? estado.resumePhotoIndex : 0;

            const resultado = processSection_ConFotos_Paginada(
                estado.valorBuscado,
                spreadsheetDatosGeneral,
                spreadsheetDatosGeneral,
                hojaFormatoDestino,
                config,
                estado.totalFilasInsertadasGlobal,
                startPhotoIdx,
                startTime,
                isResumingContext // <--- PARÁMETRO CRÍTICO
            );

            estado.acumRowsSection += resultado.filasInsertadas;

            if (resultado.status === 'PARTIAL') {
                Logger.log(`⚠️ PAUSA FORZADA en ${key}. Foto Idx: ${resultado.nextPhotoIndex}`);
                scriptProperties.setProperty(PROP_RESUME_SECTION_KEY, key);
                scriptProperties.setProperty(PROP_RESUME_PHOTO_INDEX, resultado.nextPhotoIndex.toString());
                scriptProperties.setProperty(PROP_ACUM_ROWS_SECTION, estado.acumRowsSection.toString());
                incompleta = true;
                break; // Salir del loop de secciones
            } else {
                Logger.log(`✅ Sección ${key} terminada.`);
                // Solo sumamos al global cuando la sección se termina COMPLETA
                estado.totalFilasInsertadasGlobal += estado.acumRowsSection;

                scriptProperties.deleteProperty(PROP_RESUME_SECTION_KEY);
                scriptProperties.deleteProperty(PROP_RESUME_PHOTO_INDEX);
                scriptProperties.deleteProperty(PROP_ACUM_ROWS_SECTION);
                estado.acumRowsSection = 0;

                if (!isResumingContext) {
                    estado.startIndex++;
                } else {
                    // Si terminamos una que estaba pausada, avanzamos el índice general
                    const idx = estado.sectionKeys.indexOf(key);
                    if (idx !== -1) estado.startIndex = idx + 1;
                }
            }
        }

        // --- 5. Guardado y Continuación ---
        scriptProperties.setProperty(PROP_TOTAL_FILAS_INSERTADAS, estado.totalFilasInsertadasGlobal.toString());
        scriptProperties.setProperty(PROP_START_INDEX, estado.startIndex.toString());

        if (incompleta) {
            crearSiguienteTrigger('procesarLoteSeccionesTrigger');
        } else if (estado.startIndex < estado.sectionKeys.length) {
            crearSiguienteTrigger('procesarLoteSeccionesTrigger');
        } else {
            // --- FIN DEL REPORTE ---
            Logger.log("Generando PDF final...");
            SpreadsheetApp.flush();
            const pdfBlob = DriveApp.getFileById(estado.reporteId).getAs('application/pdf');
            pdfBlob.setName(estado.nombreReporte + '.pdf');
            carpetaReporteIndividual.createFile(pdfBlob);

            // Actualizar Link
            try {
                const sheet = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
                const data = sheet.getDataRange().getValues();
                const headers = data[0].map(h => typeof h === 'string' ? h.trim() : h);
                const idCol = headers.indexOf(COLUMNA_PVID);
                const linkCol = headers.indexOf(COLUMNA_LINK_REPORTE);
                if (idCol !== -1 && linkCol !== -1) {
                    for (let i = 1; i < data.length; i++) {
                        if (data[i][idCol] != null && data[i][idCol].toString().trim() === estado.valorBuscado.toString().trim()) {
                            sheet.getRange(i + 1, linkCol + 1).setValue(carpetaReporteIndividual.getUrl());
                            break;
                        }
                    }
                }
            } catch (e) { Logger.log("Error actualizando link: " + e.message); }

            limpiarPropiedadesEstado();
            _continuarBatchRBI();
            Logger.log("Proceso finalizado.");
        }

    } catch (e) {
        Logger.log(`❌ ERROR CRÍTICO: ${e.stack}`);
        try {
            const hojaError = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
            // Intento simple de notificar error en la celda si es posible, sin complicar lógica
        } catch (e2) { }
        limpiarPropiedadesEstado();
    } finally {
        if (!scriptProperties.getProperty(PROP_VALOR_BUSCADO)) borrarTriggerActual('procesarLoteSeccionesTrigger');
    }
}


// =================================================================
// --- PARTE 4: LÓGICA DE SECCIÓN (FIXED & ROBUST)
// =================================================================
function processSection_ConFotos_Paginada(pvId, spreadsheetDatos, spreadsheetFotos, hojaDestino, config, filasInsertadasPreviamenteGlobal, startPhotoIdx, globalStartTime, isResumingContext) {
    try {
        let filasAgregadasEstaEjecucion = 0;

        // --- 1. PROCESAR DATOS ---
        let filasInsertadasParaDatos = 0;
        const hojaSeccion = spreadsheetDatos.getSheetByName(config.sheetName);
        let registrosEncontrados = [];

        if (hojaSeccion) {
            const data = hojaSeccion.getDataRange().getValues();
            if (data.length >= 2) {
                const headers = data[0].map(h => typeof h === 'string' ? h.trim() : h);
                const idCol = headers.indexOf(COLUMNA_PVID);
                if (idCol !== -1) {
                    registrosEncontrados = data.slice(1).filter(r => r[idCol] != null && r[idCol].toString().trim() == pvId.toString().trim());
                }
            }
        }

        if (registrosEncontrados.length > 0) {
            if (!isResumingContext) {
                // --- MODO NORMAL: Insertar filas y datos ---
                const headers = hojaSeccion.getDataRange().getValues()[0].map(h => typeof h === 'string' ? h.trim() : h);
                registrosEncontrados.forEach((registroActual, i) => {
                    const filaDestino = config.dataStartRow + filasInsertadasPreviamenteGlobal + i;
                    if (i > 0) {
                        hojaDestino.insertRowAfter(filaDestino - 1);
                        const filaFuente = config.dataStartRow + filasInsertadasPreviamenteGlobal;
                        hojaDestino.getRange(filaFuente, 1, 1, hojaDestino.getMaxColumns())
                            .copyTo(hojaDestino.getRange(filaDestino, 1, 1, hojaDestino.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
                        hojaDestino.setRowHeight(filaDestino, hojaDestino.getRowHeight(filaFuente));
                        hojaDestino.getRange(filaDestino, 1, 1, hojaDestino.getMaxColumns()).clearContent();
                        filasInsertadasParaDatos++;
                        filasAgregadasEstaEjecucion++;
                    }
                    for (const col in config.mapping) {
                        const idx = headers.indexOf(col);
                        if (idx !== -1) {
                            const colLetter = config.mapping[col].match(/[A-Z]+/)[0];
                            hojaDestino.getRange(`${colLetter}${filaDestino}`).setValue(registroActual[idx]);
                        }
                    }
                });
            } else {
                // --- MODO RESUME: Solo calcular espacio, NO TOCAR CELDAS ---
                // Esto evita el bucle infinito de insertar datos una y otra vez.
                filasInsertadasParaDatos = registrosEncontrados.length > 0 ? registrosEncontrados.length - 1 : 0;
            }
        }

        // --- 2. PROCESAR FOTOS ---
        if (config.photosConfig) {
            const pConfig = config.photosConfig;
            const FOTOS_POR_FILA = pConfig.photoCells.length;
            if (FOTOS_POR_FILA === 0) return { status: 'COMPLETE', filasInsertadas: filasAgregadasEstaEjecucion, nextPhotoIndex: 0 };

            const hojaFotos = spreadsheetFotos.getSheetByName(pConfig.photoSheetName);
            if (hojaFotos) {
                const dataF = hojaFotos.getDataRange().getValues();
                if (dataF.length >= 2) {
                    const headersF = dataF[0].map(h => typeof h === 'string' ? h.trim() : h);
                    const idColF = headersF.indexOf(pConfig.idColumnName);
                    const urlColF = headersF.indexOf(pConfig.photoLinkColumnName);
                    let descColF = headersF.indexOf('descripcion');
                    if (descColF === -1) descColF = headersF.indexOf('Observaciones');
                    if (descColF === -1) descColF = headersF.indexOf('observaciones');

                    if (idColF !== -1 && urlColF !== -1) {
                        const fotos = dataF.slice(1).filter(r => r[idColF] != null && r[idColF].toString().trim() == pvId.toString().trim() && r[urlColF] && r[urlColF].toString().startsWith('http'));

                        if (fotos.length > 0) {
                            const primeraCelda = pConfig.photoCells[0];
                            const baseRowTemplate = parseInt(primeraCelda.match(/\d+/)[0]);
                            // El Base Row siempre es relativo al inicio + datos
                            const BASE_PHOTO_ROW = baseRowTemplate + filasInsertadasPreviamenteGlobal + filasInsertadasParaDatos;

                            const hFoto = hojaDestino.getRowHeight(BASE_PHOTO_ROW);
                            const hDesc = hojaDestino.getRowHeight(BASE_PHOTO_ROW + 1);

                            for (let j = startPhotoIdx; j < fotos.length; j++) {
                                // CHECK TIEMPO CADA 2 FOTOS (Muy estricto)
                                if (j % 2 === 0) {
                                    if ((new Date().getTime() - globalStartTime) > TIEMPO_MAXIMO_EJECUCION_MS) {
                                        // Aseguramos terminar el bloque horizontal de fotos antes de cortar
                                        if (j % FOTOS_POR_FILA === 0) {
                                            return { status: 'PARTIAL', filasInsertadas: filasAgregadasEstaEjecucion, nextPhotoIndex: j };
                                        }
                                    }
                                }

                                const foto = fotos[j];
                                const chunkIdx = Math.floor(j / FOTOS_POR_FILA);
                                const posInChunk = j % FOTOS_POR_FILA;
                                const currentRowFoto = BASE_PHOTO_ROW + (chunkIdx * 2);

                                if (chunkIdx > 0 && posInChunk === 0) {
                                    // Solo insertamos fila si estamos en un chunk nuevo que NO ha sido creado previamente.
                                    // Como las inserciones son secuenciales y el script se detiene y guarda,
                                    // asumimos que si j >= startPhotoIdx, el chunk para 'j' aún no existe.

                                    hojaDestino.insertRowsAfter(currentRowFoto - 1, 2);
                                    filasAgregadasEstaEjecucion += 2;

                                    // Copiar formato de BASE
                                    hojaDestino.getRange(BASE_PHOTO_ROW, 1, 1, hojaDestino.getMaxColumns()).copyTo(
                                        hojaDestino.getRange(currentRowFoto, 1, 1, hojaDestino.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
                                    hojaDestino.getRange(BASE_PHOTO_ROW + 1, 1, 1, hojaDestino.getMaxColumns()).copyTo(
                                        hojaDestino.getRange(currentRowFoto + 1, 1, 1, hojaDestino.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

                                    hojaDestino.getRange(currentRowFoto, 1, 2, hojaDestino.getMaxColumns()).clearContent();
                                    hojaDestino.setRowHeight(currentRowFoto, hFoto);
                                    hojaDestino.setRowHeight(currentRowFoto + 1, hDesc);
                                }

                                if (posInChunk < pConfig.photoCells.length) {
                                    const colFoto = pConfig.photoCells[posInChunk].match(/[A-Z]+/)[0];
                                    const colDesc = pConfig.descCells[posInChunk].match(/[A-Z]+/)[0];

                                    insertarImagenEnCelda_Excel(foto[urlColF], hojaDestino.getRange(`${colFoto}${currentRowFoto}`));
                                    if (descColF !== -1) hojaDestino.getRange(`${colDesc}${currentRowFoto + 1}`).setValue(foto[descColF]);
                                }
                            }
                        }
                    }
                }
            }
        }
        return { status: 'COMPLETE', filasInsertadas: filasAgregadasEstaEjecucion, nextPhotoIndex: 0 };
    } catch (e) {
        throw new Error(`Error Sección ${config.sheetName}: ${e.message}`);
    }
}

// =================================================================
// --- PARTE 5: FUNCIONES AUXILIARES (COMPLETAS) ---
// =================================================================

function probarAccesoALasBasesDeDatos() {
    const ui = SpreadsheetApp.getUi();
    let msg = '';
    try {
        const bdGeneral = SpreadsheetApp.openById(ID_BD_GENERAL);
        msg += `✅ Éxito al acceder a la BD General:\n${bdGeneral.getName()}\n\n`;
    } catch (e) {
        msg += `❌ FALLÓ ACCESO a BD General: ${e.message}\n\n`;
    }
    ui.alert(msg);
}

function buscarOCrearCarpetaReporte(hojaDatosGeneral, rowIndex, nombreReporte) {
    const linkColIndex = hojaDatosGeneral.getDataRange().getValues()[0]
        .map(h => typeof h === 'string' ? h.trim() : h)
        .indexOf(COLUMNA_LINK_REPORTE);
    const linkReporteExistente = (linkColIndex !== -1 && rowIndex !== -1) ? hojaDatosGeneral.getRange(rowIndex, linkColIndex + 1).getValue() : '';
    let carpetaReporteIndividual = null;
    if (linkReporteExistente && typeof linkReporteExistente === 'string' && linkReporteExistente.includes('drive.google.com/drive/folders/')) {
        try {
            const folderId = linkReporteExistente.split('/folders/')[1].split('?')[0];
            const carpetaExistente = DriveApp.getFolderById(folderId);
            carpetaReporteIndividual = carpetaExistente;
        } catch (e) {
            carpetaReporteIndividual = null;
        }
    }
    if (!carpetaReporteIndividual) {
        const plantillaFile = DriveApp.getFileById(ID_PLANTILLA);
        const carpetaContenedoraPlantilla = plantillaFile.getParents().next();
        let carpetaRaizReportes;
        const carpetasExistentes = carpetaContenedoraPlantilla.getFoldersByName(NOMBRE_CARPETA_RAIZ_REPORTES);
        carpetaRaizReportes = carpetasExistentes.hasNext() ? carpetasExistentes.next() : carpetaContenedoraPlantilla.createFolder(NOMBRE_CARPETA_RAIZ_REPORTES);

        // Limpieza de carpetas duplicadas si hubiera
        const carpetasConMismoNombre = carpetaRaizReportes.getFoldersByName(nombreReporte);
        while (carpetasConMismoNombre.hasNext()) {
            carpetasConMismoNombre.next().setTrashed(true);
        }
        carpetaReporteIndividual = carpetaRaizReportes.createFolder(nombreReporte);
    }
    return carpetaReporteIndividual;
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

function crearSiguienteTrigger(nombreFuncionTrigger) {
    ScriptApp.newTrigger(nombreFuncionTrigger)
        .timeBased()
        .after(10 * 1000) // 10 segundos de espera
        .create();
}

function borrarTriggerActual(nombreFuncionTrigger) {
    try {
        const allTriggers = ScriptApp.getProjectTriggers();
        for (const trigger of allTriggers) {
            if (trigger.getHandlerFunction() === nombreFuncionTrigger) {
                ScriptApp.deleteTrigger(trigger);
                break;
            }
        }
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

function limpiarPropiedadesEstado() {
    try {
        const props = PropertiesService.getScriptProperties();
        const batchRbi = props.getProperty('BATCH_RBI');
        props.deleteAllProperties();
        if (batchRbi) props.setProperty('BATCH_RBI', batchRbi);
    } catch (e) { }
}

function limpiarEstadoYTriggersManualmente() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
        'Confirmar Limpieza de Emergencia',
        'Esto borrará cualquier reporte que esté "Generando..." y todos los triggers asociados.\n\n¿Está seguro?',
        ui.ButtonSet.YES_NO);
    if (result == ui.Button.YES) {
        limpiarPropiedadesEstado();
        borrarTriggersExistentes('procesarLoteSeccionesTrigger');
        ui.alert('Limpieza completada. Es seguro iniciar un nuevo reporte.');
    }
}

// ── Menú estándar: helpers batch RBI ─────────────────────────────────────────

function obtenerListaReportes_019() {
    const hoja = SpreadsheetApp.openById(ID_BD_GENERAL).getSheetByName(NOMBRE_HOJA_ACTIVADORA);
    const datos = hoja.getDataRange().getValues();
    const enc = datos[0].map(function(h){ return typeof h === 'string' ? h.trim() : String(h); });
    const iId   = enc.indexOf(COLUMNA_PVID);
    const iLink = enc.indexOf(COLUMNA_LINK_REPORTE);
    if (iId === -1) return [];
    const res = [];
    for (let i = 1; i < datos.length; i++) {
        const id   = datos[i][iId]   ? String(datos[i][iId]).trim()   : '';
        const link = iLink !== -1 && datos[i][iLink] ? String(datos[i][iLink]).trim() : '';
        if (id) res.push({ id: id, status: link ? 'Generado' : 'Pendiente' });
    }
    return res;
}

function iniciarBatchRBI(ids) {
    if (!ids || !ids.length) return;
    const props = PropertiesService.getScriptProperties();
    props.setProperty('BATCH_RBI', JSON.stringify(ids.slice(1)));
    iniciarGeneracionEncadenada(ids[0]);
    SpreadsheetApp.getActiveSpreadsheet().toast(
        'Procesando ' + ids.length + ' reportes en cola. Revisa el log al terminar.',
        'Cola iniciada', 7
    );
}

function _continuarBatchRBI() {
    try {
        const props = PropertiesService.getScriptProperties();
        const queueStr = props.getProperty('BATCH_RBI');
        if (!queueStr) return;
        const queue = JSON.parse(queueStr);
        if (!queue.length) { props.deleteProperty('BATCH_RBI'); return; }
        const next = queue.shift();
        props.setProperty('BATCH_RBI', JSON.stringify(queue));
        iniciarGeneracionEncadenada(next);
    } catch(e) { Logger.log('Error en _continuarBatchRBI: ' + e.message); }
}

// ── Wrappers menu estandar ────────────────────────────────────────────────────

function generarPorIdManual()  { mostrarPanelDeEntrada(); }

function mostrarPanelSelectorMasivo() {
    const html =
        '<!DOCTYPE html><html><head><base target="_top"><style>' +
        'body{font-family:"Segoe UI",sans-serif;padding:15px;color:#333}' +
        'h2{text-align:center;color:#1565c0;font-size:17px;margin-top:0}' +
        '.controls{display:flex;justify-content:space-between;margin-bottom:10px}' +
        '.controls button{background:#e0e0e0;color:#333;border:none;padding:5px 10px;cursor:pointer;border-radius:4px;font-size:12px}' +
        '.controls button:hover{background:#d5d5d5}' +
        '#list-container{max-height:250px;overflow-y:auto;border:1px solid #ccc;padding:10px;border-radius:5px;background:#fafafa;margin-bottom:15px}' +
        '.item{display:flex;align-items:center;margin-bottom:8px;font-size:13px}' +
        '.item input{margin-right:8px;cursor:pointer;width:16px;height:16px}' +
        '.badge{margin-left:auto;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:bold}' +
        '.bg-pending{background-color:#ffebee;color:#c62828}' +
        '.bg-done{background-color:#e8f5e9;color:#2e7d32}' +
        '#msg{margin-top:10px;padding:10px;border-radius:4px;display:none}' +
        '.btn-primary{width:100%;background:#1976d2;color:white;border:none;padding:12px;cursor:pointer;border-radius:4px;font-size:14px;font-weight:bold}' +
        '.btn-primary:hover{background:#1565c0}' +
        '</style></head><body>' +
        '<h2>Selector de Reportes RBI</h2>' +
        '<div class="controls">' +
        '<button onclick="sel(true)">✔ Todos</button>' +
        '<button onclick="sel(false)">✖ Ninguno</button>' +
        '<button onclick="selPend()">⏳ Pendientes</button>' +
        '</div>' +
        '<div id="list-container"><em>Cargando...</em></div>' +
        '<button class="btn-primary" onclick="gen()">Generar seleccionados</button>' +
        '<div id="msg"></div>' +
        '<script>' +
        'window.onload=function(){google.script.run.withSuccessHandler(render).withFailureHandler(function(e){alert(e.message);}).obtenerListaReportes_019();};' +
        'function render(d){' +
        '  var c=document.getElementById("list-container");c.innerHTML="";' +
        '  if(!d.length){c.innerHTML="<em>Sin registros.</em>";return;}' +
        '  d.forEach(function(x){' +
        '    var lbl=document.createElement("label");lbl.className="item";' +
        '    var chk=document.createElement("input");chk.type="checkbox";chk.className="chk";chk.value=x.id;' +
        '    if(x.status==="Pendiente")chk.checked=true;' +
        '    var nm=document.createTextNode(" "+x.id);' +
        '    var bdg=document.createElement("span");' +
        '    bdg.className="badge "+(x.status==="Pendiente"?"bg-pending":"bg-done");' +
        '    bdg.textContent=x.status;' +
        '    lbl.appendChild(chk);lbl.appendChild(nm);lbl.appendChild(bdg);c.appendChild(lbl);' +
        '  });' +
        '}' +
        'function sel(v){document.querySelectorAll(".chk").forEach(function(c){c.checked=v;});}' +
        'function selPend(){document.querySelectorAll(".chk").forEach(function(c){c.checked=c.parentElement.querySelector(".badge").classList.contains("bg-pending");});}' +
        'function gen(){' +
        '  var ids=Array.from(document.querySelectorAll(".chk:checked")).map(function(c){return c.value;});' +
        '  if(!ids.length){alert("Selecciona al menos un ID.");return;}' +
        '  google.script.run' +
        '    .withSuccessHandler(function(){var m=document.getElementById("msg");m.style.display="block";m.style.background="#e8f5e9";m.innerText="OK: "+ids.length+" reportes enviados a cola.";})' +
        '    .withFailureHandler(function(e){alert("Error: "+e.message);})' +
        '    .iniciarBatchRBI(ids);' +
        '}' +
        '<\/script></body></html>';
    SpreadsheetApp.getUi().showModalDialog(
        HtmlService.createHtmlOutput(html).setWidth(420).setHeight(480),
        'Generador de Reportes en Lote'
    );
}

function generarTodosPendientes() {
    const pendientes = obtenerListaReportes_019().filter(function(r){ return r.status === 'Pendiente'; });
    if (!pendientes.length) { SpreadsheetApp.getUi().alert('No hay reportes pendientes.'); return; }
    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert('Confirmar', 'Se generarán ' + pendientes.length + ' reportes pendientes en cola. ¿Continuar?', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
    iniciarBatchRBI(pendientes.map(function(r){ return r.id; }));
}

function limpiarColaDisparo() {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert('Confirmar limpieza', 'Se cancelará la cola de generación y se eliminarán todos los disparadores activos. ¿Continuar?', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
    try { PropertiesService.getScriptProperties().deleteProperty('BATCH_RBI'); } catch(e) {}
    limpiarPropiedadesEstado();
    borrarTriggersExistentes('procesarLoteSeccionesTrigger');
    ui.alert('Cola y disparadores limpiados correctamente.');
}

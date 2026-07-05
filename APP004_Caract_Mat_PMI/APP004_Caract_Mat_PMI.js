/**
 * ===========================================================================
 * SCRIPT INTEGRADO: REPORTES DE MATERIALES + CÁLCULO DE CARBONO EQUIVALENTE
 * ===========================================================================
 * Incluye:
 *  1. Generador de reportes (química, durezas, imágenes) con menú en español.
 *  2. Cálculo automático de CE (una sola columna) con trigger onChange.
 *  3. CORRECCIÓN: imágenes flotantes (insertImage) para que NO salgan
 *     pequeñas al descargar el Excel y abrirlo en el PC.
 *  4. UN SOLO onOpen que combina ambos menús (evita el conflicto de menús).
 * ===========================================================================
 */

// --- CONFIGURACIÓN PRINCIPAL ---
const ID_BD_DATOS = "1F4bR_f0Vyap9yY8iLXrOw75ni3rk1_D1s7xSPlEDosw";
const NOMBRE_CARPETA_REPORTES = "REPORTES_MATERIALES_GENERADOS";
const NOMBRE_HOJA_FORMATO = "FORMATO_MATERIALES";

const HOJA_DB_GENERAL = "1_general";
const HOJA_DB_QUIMICA = "2_quimica";
const HOJA_DB_DUREZAS = "3_durezas";

// Nombre de la columna donde se escribirá el Carbono Equivalente
const COLUMNA_CE = "CE";

// --- MAPEOS DE CELDAS (Datos Generales) ---
const MAPEO_GENERAL = {
    'Cliente': 'E7',
    'Contrato': 'M7',
    'N_Reporte': 'R7',
    'OT': 'Z7',
    'Fecha': 'AE7',
    'Departamento': 'E9',
    'Ciudad': 'M9',
    'Troncal': 'U9',
    'Estación': 'AC9',
    'Sistema': 'E11',
    'Linea': 'R11',
    'PK': 'AC11',
    'Equipo_Inspeccionado': 'G16',
    'Tag': 'N16',
    'Descripcion_Componente': 'G18',
    'Estado_Componente': 'G20',
    'Observacion_Estado': 'M20',
    'Ubicacion_Componente': 'G22',
    'Dimensiones': 'G24',
    'NPS': 'G26',
    'Espesor_Min_Pulg': 'M26',
    'Plano_Referencia': 'G28',
    'Observaciones_Generales': 'B31',

    // Metalografía (1_M)
    '1_M_Procedimiento': 'G54',
    '1_M_Tecnica': 'Q54',
    '1_M_Normas_Referencia': 'AC54',
    '1_M_Abrasivo': 'F54',
    '1_M_Equipo_Desbaste': 'F60',
    '1_M_Marca_Desbaste': 'M60',
    '1_M_Modelo_Desbaste': 'F62',
    '1_M_Serie_Desbaste': 'M62',
    '1_M_Micro_Marca': 'V60',
    '1_M_Micro_Modelo': 'AC60',
    '1_M_Micro_Serie': 'V62',
    '1_M_Micro_Lentes': 'AC62',
    '1_M_Material_Analizar': 'J68',
    '1_M_Tiempo_Ataque_Seg': 'J69',
    '1_M_Reactivo_Norma': 'AB68',
    '1_M_Calc_Vol_Solucion': 'AB73',
    '1_M_Calc_Conc_Acido_Base': 'AB74',
    '1_M_Calc_Conc_Deseada': 'AB75',
    '1_M_Res_Vol_Acido': 'AB75',
    '1_M_Res_Vol_Dilusor': 'AB76',
    '1_M_aumentos_metalografias': 'L79',
    '1_M_comentario_2': 'P84',
    '1_M_comentario_3': 'Z84',
    '1_M_analisis_inclusiones': 'L86',
    '1_M_comentario_4': 'P91',
    '1_M_comentario_5': 'Z91',
    '1_M_analisis_de_inclusiones': 'L93',
    '1_M_comentario_6': 'U99',
    '1_M_tamano_grano': 'F101',
    '1_M_fases': 'N101',
    '1_M_porceso_fabricacion': 'V101',
    '1_M_defectos': 'AD101',
    '1_M_analisis_metalografico': 'L103',
    'Material_referencia': 'B125',
    'Material_referencia_2': 'B130',

    // Química (2_Q)
    '2_Q_Procedimiento': 'G110',
    '2_Q_Tecnica': 'Q110',
    '2_Q_Normas_Referencia': 'AC110',
    '2_Q_Equipo_Desbaste': 'F114',
    '2_Q_Marca_Desbaste': 'V114',
    '2_Q_Modelo_Desbaste': 'F116',
    '2_Q_Serie_Desbaste': 'Q116',
    '2_Q_fecha_calibracion': 'AB116',
    '2_Q_comentario_7': 'E163',
    '2_Q_comentario_8': 'U163',

    // Dureza (3_D)
    '3_D_Procedimiento': 'G169',
    '3_D_Tecnica': 'Q169',
    '3_D_Normas_Referencia': 'AC169',
    '3_D_Marca_Durometro': 'F173',
    '3_D_Modelo_Durometro': 'F175',
    '3_D_Serie_Durometro': 'W173',
    '3_D_Fecha_Calibracion': 'W175',
    '3_D_Ubicacion_Horaria': 'E179',
    '3_D_Escala_Dureza': 'M179',
    '3_D_Tolerancia': 'U179',
    '3_D_Material_Referencia': 'AC179',
    '3_D_comentario_9': 'E219',
    '3_D_comentario_10': 'U219',
    '3_D_analisis_mecanicas': 'B221',

    // Extras
    'comentario_1': 'U32',
    'nombre': 'G224',
    'cargo': 'G225'
};

const MAPEO_IMAGENES = {
    'link_foto': 'R16',
    'link_imagen_2': 'M83',
    'link_imagen_3': 'W83',
    'link_imagen_4': 'M90',
    'link_imagen_5': 'W90',
    'link_imagen_6': 'R98',
    'link_imagen_7': 'B146',
    'link_imagen_8': 'R146',
    'link_imagen_9': 'B202',
    'link_imagen_10': 'R202',
    'link_firma': 'G223'
};

// --- RANGOS PARA TABLAS DINÁMICAS ---
const RANGOS_QUIMICA_ELEMENTO = generarListaRangos(['D136:D141', 'N136:N141', 'X136:X141']);
const RANGOS_QUIMICA_VALOR = generarListaRangos(['G136:G141', 'Q136:Q141', 'AA136:AA141']);
const RANGOS_DUREZAS = generarListaRangos(['F184:F198', 'M184:M198', 'U184:U198', 'AB184:AB197']);
const RANGOS_KSI = generarListaRangos(['H184:H198', 'O184:O198', 'W184:W198', 'AD184:AD197']);

// Mapeo de nombres de elementos químicos -> clave interna (para el CE)
const ELEM_KEY = {
    "c (carbono)": "c", "c": "c",
    "mn (manganeso)": "mn", "mn": "mn",
    "si (silicio)": "si", "si": "si",
    "cu (cobre)": "cu", "cu": "cu",
    "ni (niquel)": "ni", "ni (níquel)": "ni", "ni": "ni",
    "cr (cromo)": "cr", "cr": "cr",
    "mo (molibdeno)": "mo", "mo": "mo",
    "v (vanadio)": "v", "v": "v",
    "b (boro)": "b", "b": "b"
};

// =================================================================
// --- MENÚ ÚNICO (combina Reportes + CE) ---
// =================================================================

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Caracterización de Materiales')
        .addItem('1. 🚀 Generar reportes (selección múltiple)', 'mostrarPanelSelectorMasivo')
        .addItem('2. 📄 Generar reporte por ID (manual)', 'generarReporteMaterialesManual')
        .addSeparator()
        .addItem('3. 🧪 Activar cálculo automático de CE', 'configurarTriggerCE')
        .addItem('4. 🧮 Calcular CE ahora (manual)', 'calcularCE')
        .addSeparator()
        .addItem('5. 🗑️ Eliminar disparadores (reiniciar)', 'borrarTodosLosTriggers')
        .addToUi();
}

function borrarTodosLosTriggers() {
    const ui = SpreadsheetApp.getUi();
    const triggers = ScriptApp.getProjectTriggers();

    if (triggers.length === 0) {
        ui.alert('Información', 'No hay disparadores activos en este momento.', ui.ButtonSet.OK);
        return;
    }

    const respuesta = ui.alert(
        'Confirmar',
        `Se encontraron ${triggers.length} disparadores. ¿Desea eliminarlos para reiniciar?`,
        ui.ButtonSet.YES_NO
    );

    if (respuesta == ui.Button.YES) {
        let cont = 0;
        triggers.forEach(function (trigger) {
            try { ScriptApp.deleteTrigger(trigger); cont++; } catch (e) { }
        });
        ui.alert(`Se eliminaron correctamente ${cont} disparadores.`);
    }
}

// =================================================================
// --- CÁLCULO DE CARBONO EQUIVALENTE (Opción B: columna en 1_general) ---
// =================================================================

// Configura el trigger automático onChange (se ejecuta solo cuando AppSheet escribe)
function configurarTriggerCE() {
    const ui = SpreadsheetApp.getUi();

    // Elimina triggers anteriores de calcularCE para no duplicar
    ScriptApp.getProjectTriggers().forEach(t => {
        if (t.getHandlerFunction() === 'calcularCE') ScriptApp.deleteTrigger(t);
    });

    ScriptApp.newTrigger("calcularCE")
        .forSpreadsheet(SpreadsheetApp.openById(ID_BD_DATOS))
        .onChange()
        .create();

    ui.alert("✅ Cálculo automático activado.\nEl CE se recalculará cada vez que haya cambios en la base de datos.");
}

// Calcula el CE para todos los id_general y lo escribe en la columna CE de 1_general
function calcularCE() {
    const ss = SpreadsheetApp.openById(ID_BD_DATOS);
    const sheetQuim = ss.getSheetByName(HOJA_DB_QUIMICA);
    const sheetGen = ss.getSheetByName(HOJA_DB_GENERAL);

    if (!sheetQuim || !sheetGen) return;

    // 1. Leer química y agrupar por id_general
    // Se usa getDisplayValues() para leer el valor TAL COMO SE VE en pantalla
    // (ej. "0.20%"), evitando que Google guarde por dentro 0.002 y se elija
    // la fórmula equivocada. Así todo queda siempre en magnitud porcentaje.
    const quimData = sheetQuim.getDataRange().getDisplayValues();
    const quimHeaders = quimData[0].map(h => String(h).trim().toLowerCase());

    const iIdGen = quimHeaders.indexOf("id_general");
    const iElem = quimHeaders.indexOf("elemento");
    const iValor = quimHeaders.indexOf("valor");

    if ([iIdGen, iElem, iValor].includes(-1)) return;

    const quimMap = {};
    for (let r = 1; r < quimData.length; r++) {
        const row = quimData[r];
        const idGen = row[iIdGen] ? String(row[iIdGen]).trim() : "";
        const elem = row[iElem] ? String(row[iElem]).trim().toLowerCase() : "";
        const rawVal = row[iValor] != null ? String(row[iValor]).trim() : "";
        if (!idGen || !elem || !rawVal) continue;

        // Limpia "%", espacios y normaliza la coma decimal -> punto
        const valor = parseFloat(rawVal.replace("%", "").replace(",", ".").trim());
        if (isNaN(valor)) continue;

        const key = ELEM_KEY[elem];
        if (!key) continue;

        if (!quimMap[idGen]) quimMap[idGen] = {};
        if (!quimMap[idGen][key]) quimMap[idGen][key] = [];
        quimMap[idGen][key].push(valor);
    }

    // 2. Calcular CE por id_general
    const avg = arr => (arr && arr.length) ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

    const ceMap = {};
    for (const idGen in quimMap) {
        const e = quimMap[idGen];
        const c = avg(e["c"]);
        const mn = avg(e["mn"]);
        const si = avg(e["si"]);
        const cu = avg(e["cu"]);
        const ni = avg(e["ni"]);
        const cr = avg(e["cr"]);
        const mo = avg(e["mo"]);
        const v = avg(e["v"]);
        const b = avg(e["b"]);

        // CE_Pcm (C <= 0.12%) o CE_IIW (C > 0.12%) - se elige automáticamente
        const ce = (c <= 0.12)
            ? c + si / 30 + mn / 20 + cu / 20 + ni / 60 + cr / 20 + mo / 15 + v / 10 + 5 * b
            : c + mn / 6 + (cr + mo + v) / 5 + (ni + cu) / 15;

        ceMap[idGen] = Math.round(ce * 10000) / 10000;
    }

    // 3. Buscar o crear la columna CE en 1_general
    const genData = sheetGen.getDataRange().getValues();
    const genHeaders = genData[0].map(h => String(h).trim());
    const iIdGenGen = genHeaders.indexOf("id_general");
    if (iIdGenGen === -1) return;

    let iCE = genHeaders.indexOf(COLUMNA_CE);
    if (iCE === -1) {
        iCE = genHeaders.length;
        sheetGen.getRange(1, iCE + 1).setValue(COLUMNA_CE);
    }

    // 4. Escribir el CE fila por fila
    for (let r = 1; r < genData.length; r++) {
        const idGen = genData[r][iIdGenGen] ? String(genData[r][iIdGenGen]).trim() : "";
        if (!idGen || ceMap[idGen] === undefined) continue;
        sheetGen.getRange(r + 1, iCE + 1).setValue(ceMap[idGen]);
    }
}

// =================================================================
// --- PANEL HTML (selección múltiple) - en español ---
// =================================================================

function mostrarPanelSelectorMasivo() {
    const htmlTemplate = `
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
        .item input { margin-right: 8px; cursor: pointer; width: 16px; height: 16px;}
        .badge { margin-left: auto; padding: 2px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; }
        .bg-pending { background-color: #ffebee; color: #c62828; }
        .bg-done { background-color: #e8f5e9; color: #2e7d32; }
        #status-box { display: none; border: 2px solid #e0e0e0; border-radius: 8px; padding: 10px; background: #fff; margin-bottom: 15px; text-align: center; }
        #progress-text { font-size: 18px; font-weight: bold; color: #2e7d32; margin-bottom: 5px;}
        #log { font-size: 11px; color: #555; text-align: left; max-height: 80px; overflow-y: auto; }
        .btn-primary { width: 100%; background: #1976d2; color: white; border: none; padding: 12px; cursor: pointer; border-radius: 4px; font-size: 14px; font-weight: bold; transition: 0.3s; }
        .btn-primary:disabled { background: #b0bec5; cursor: not-allowed; }
        .btn-primary:hover:not(:disabled) { background: #1565c0; }
        .loading { text-align: center; padding: 20px; font-style: italic; color: #666; }
      </style>
    </head>
    <body>
      <h2>🚀 Selector de Reportes</h2>
      <div id="selection-area">
        <div class="controls">
          <button onclick="seleccionar(true)">✔ Todos</button>
          <button onclick="seleccionar(false)">✖ Ninguno</button>
          <button onclick="seleccionarPendientes()">⏳ Pendientes</button>
        </div>
        <div id="list-container">
          <div class="loading">Cargando registros...</div>
        </div>
        <button id="btn-start" class="btn-primary" onclick="iniciarGeneracion()">Generar seleccionados</button>
      </div>
      <div id="status-box">
        <div id="progress-text">0 / 0</div>
        <div id="log"></div>
      </div>
      <button id="btn-close" class="btn-primary" style="display:none;" onclick="google.script.host.close()">Cerrar ventana</button>

      <script>
        let allIds = [];
        let toProcess = [];
        let currentIndex = 0;

        window.onload = function() {
          google.script.run
            .withSuccessHandler(renderList)
            .withFailureHandler(err => alert("Error: " + err.message))
            .obtenerTodosLosIdsInfo();
        };

        function renderList(data) {
          allIds = data;
          const container = document.getElementById('list-container');
          if(data.length === 0) {
            container.innerHTML = "<div class='loading'>No se encontraron registros.</div>";
            return;
          }
          let html = '';
          data.forEach(item => {
             const badgeClass = item.status === 'Pendiente' ? 'bg-pending' : 'bg-done';
             const isChecked = item.status === 'Pendiente' ? 'checked' : '';
             html += \`
               <label class="item">
                 <input type="checkbox" class="chk-id" value="\${item.id}" \${isChecked}>
                 <span>\${item.id}</span>
                 <span class="badge \${badgeClass}">\${item.status}</span>
               </label>
             \`;
          });
          container.innerHTML = html;
        }

        function seleccionar(estado) {
          document.querySelectorAll('.chk-id').forEach(chk => chk.checked = estado);
        }
        function seleccionarPendientes() {
          document.querySelectorAll('.chk-id').forEach(chk => {
            const badge = chk.parentElement.querySelector('.badge').innerText;
            chk.checked = (badge === 'Pendiente');
          });
        }
        function iniciarGeneracion() {
          const checkboxes = document.querySelectorAll('.chk-id:checked');
          toProcess = Array.from(checkboxes).map(c => c.value);
          if(toProcess.length === 0) { alert("Seleccione al menos un ID."); return; }
          document.getElementById('selection-area').style.display = 'none';
          document.getElementById('status-box').style.display = 'block';
          currentIndex = 0;
          actualizarProgreso();
          logMessage("Iniciando generación de " + toProcess.length + " reportes...");
          procesarSiguiente();
        }
        function procesarSiguiente() {
          if (currentIndex >= toProcess.length) {
            document.getElementById('progress-text').innerText = "¡Listo!";
            document.getElementById('btn-close').style.display = 'block';
            logMessage("🎉 Proceso finalizado.");
            google.script.run.mostrarAlertaFinal(toProcess.length);
            return;
          }
          let id = toProcess[currentIndex];
          logMessage("⏳ Generando ID: <b>" + id + "</b>...");
          google.script.run
            .withSuccessHandler(function(url) {
              logMessage("<span style='color:green;'>✅ " + id + " generado.</span>");
              currentIndex++; actualizarProgreso(); procesarSiguiente();
            })
            .withFailureHandler(function(err) {
              logMessage("<span style='color:red;'>❌ Error en " + id + ": " + err.message + "</span>");
              currentIndex++; actualizarProgreso(); procesarSiguiente();
            })
            .procesarUnReporteYGuardar(id);
        }
        function actualizarProgreso() {
          document.getElementById('progress-text').innerText = currentIndex + " / " + toProcess.length;
        }
        function logMessage(msg) {
          const logDiv = document.getElementById('log');
          logDiv.innerHTML += "<div>" + msg + "</div>";
          logDiv.scrollTop = logDiv.scrollHeight;
        }
      </script>
    </body>
    </html>
  `;

    const htmlOutput = HtmlService.createHtmlOutput(htmlTemplate).setWidth(400).setHeight(550);
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Selector de Reportes');
}

// Obtiene todos los IDs y su estado para mostrarlos en el panel
function obtenerTodosLosIdsInfo() {
    const bdSpreadsheet = SpreadsheetApp.openById(ID_BD_DATOS);
    const hoja = bdSpreadsheet.getSheetByName(HOJA_DB_GENERAL);
    const datos = hoja.getDataRange().getValues();
    const encabezados = datos[0].map(h => String(h).trim().toLowerCase());

    const idxId = encabezados.indexOf('id_general');
    const idxLink = encabezados.indexOf('link_reporte');
    if (idxId === -1) throw new Error("No se encontró 'id_general' en 1_general.");

    let resultado = [];
    for (let i = 1; i < datos.length; i++) {
        let id = String(datos[i][idxId]).trim();
        let link = idxLink !== -1 ? String(datos[i][idxLink]).trim() : "";
        if (id !== "") {
            resultado.push({ id: id, status: (link === "") ? "Pendiente" : "Generado" });
        }
    }
    return resultado;
}

// =================================================================
// --- PROCESAR Y GUARDAR ---
// =================================================================

function procesarUnReporteYGuardar(idBuscado) {
    const urlReporte = procesarReporteIndividual(idBuscado);

    const bdSpreadsheet = SpreadsheetApp.openById(ID_BD_DATOS);
    const hoja = bdSpreadsheet.getSheetByName(HOJA_DB_GENERAL);
    const datos = hoja.getDataRange().getValues();
    const encabezados = datos[0].map(h => String(h).trim().toLowerCase());

    const idxId = encabezados.indexOf('id_general');
    const idxLink = encabezados.indexOf('link_reporte');

    if (idxId !== -1 && idxLink !== -1) {
        for (let i = 1; i < datos.length; i++) {
            if (String(datos[i][idxId]).trim() === String(idBuscado).trim()) {
                hoja.getRange(i + 1, idxLink + 1).setValue(urlReporte);
                break;
            }
        }
    }
    return urlReporte;
}

function generarReporteMaterialesManual() {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt('Generar reporte (manual)', 'Ingrese el "id_general":', ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() == ui.Button.CANCEL || !response.getResponseText().trim()) return;
    const idBuscado = response.getResponseText().trim();

    try {
        SpreadsheetApp.getActiveSpreadsheet().toast(`Generando reporte para el ID: ${idBuscado}...`, "⚙️ Procesando", 10);
        const urlReporte = procesarUnReporteYGuardar(idBuscado);
        ui.alert('✅ Éxito', `Reporte "${idBuscado}" generado.\n🔗 Enlace: ${urlReporte}`, ui.ButtonSet.OK);
    } catch (e) {
        ui.alert('❌ Error', e.message, ui.ButtonSet.OK);
    }
}

function mostrarAlertaFinal(cantidad) {
    SpreadsheetApp.getUi().alert(
        "✅ Proceso finalizado",
        `Se generaron correctamente ${cantidad} reportes.`,
        SpreadsheetApp.getUi().ButtonSet.OK
    );
}

// =================================================================
// --- LÓGICA DE CREACIÓN DEL REPORTE ---
// =================================================================

function procesarReporteIndividual(idBuscado) {
    let bdSpreadsheet = SpreadsheetApp.openById(ID_BD_DATOS);

    const dataGeneral = obtenerFilaPorId(bdSpreadsheet, HOJA_DB_GENERAL, 'id_general', idBuscado);
    if (!dataGeneral.fila) throw new Error(`No se encontró id_general "${idBuscado}".`);

    const rowsQuimica = obtenerFilasRelacionadas(bdSpreadsheet, HOJA_DB_QUIMICA, 'id_general', idBuscado);
    const rowsDurezas = obtenerFilasRelacionadas(bdSpreadsheet, HOJA_DB_DUREZAS, 'id_general', idBuscado);

    const idxNReporte = dataGeneral.encabezados.indexOf('N_Reporte');
    const idxOT = dataGeneral.encabezados.indexOf('OT');
    const idxEstacion = dataGeneral.encabezados.indexOf('Estación');

    const valNReporte = idxNReporte !== -1 && dataGeneral.fila[idxNReporte] ? dataGeneral.fila[idxNReporte] : 'SIN_NREPORTE';
    const valOT = idxOT !== -1 && dataGeneral.fila[idxOT] ? dataGeneral.fila[idxOT] : 'SIN_OT';
    const valEstacion = idxEstacion !== -1 && dataGeneral.fila[idxEstacion] ? dataGeneral.fila[idxEstacion] : 'SIN_ESTACION';

    const fechaHora = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HH-mm-ss");
    const nombreReporte = `${idBuscado}_${valNReporte}_${valOT}_(${fechaHora})_${valEstacion}`;

    const plantillaSs = SpreadsheetApp.getActiveSpreadsheet();
    const reporteSs = crearReporteUnicaHoja(plantillaSs, NOMBRE_HOJA_FORMATO, nombreReporte, idBuscado);
    if (!reporteSs) throw new Error(`Error grave al crear el reporte.`);

    const hojaDestino = reporteSs.getSheetByName(NOMBRE_HOJA_FORMATO);

    procesarDatosGenerales(hojaDestino, dataGeneral, MAPEO_GENERAL);
    procesarImagenes(hojaDestino, dataGeneral, MAPEO_IMAGENES, rowsDurezas);
    procesarQuimica(hojaDestino, rowsQuimica);
    procesarDurezas(hojaDestino, rowsDurezas);

    SpreadsheetApp.flush();
    return reporteSs.getUrl();
}

function procesarDatosGenerales(hoja, dataObj, mapeo) {
    const encabezados = dataObj.encabezados;
    const fila = dataObj.fila;
    for (const columnaBD in mapeo) {
        const celdaDestino = mapeo[columnaBD];
        const indice = encabezados.indexOf(columnaBD);
        if (indice !== -1) hoja.getRange(celdaDestino).setValue(fila[indice]);
    }
}

function procesarImagenes(hoja, dataObj, mapeoImagenes, rowsDurezas) {
    const encabezados = dataObj.encabezados;
    const fila = dataObj.fila;
    for (const columnaBD in mapeoImagenes) {
        const celdaDestino = mapeoImagenes[columnaBD];
        const indice = encabezados.indexOf(columnaBD);
        if (indice === -1) continue;

        const valor = fila[indice];
        const rango = hoja.getRange(celdaDestino);

        // link_imagen_10 (R202) es el gráfico Tensión vs Punto que antes se
        // generaba corriendo un script en R y subiendo el PNG a mano
        // (decisión 2026-07-04). Si no hay nada subido ahí, se genera aquí
        // mismo con el servicio Charts a partir de las durezas del informe.
        // Si SÍ hay un link manual, se respeta (permite reemplazar el
        // gráfico automático en un caso puntual).
        if (columnaBD === 'link_imagen_10' && (!valor || String(valor).trim() === '')) {
            rango.clearContent();
            generarGraficoDurezas(hoja, rowsDurezas, celdaDestino);
            continue;
        }

        rango.clearContent();
        insertarImagenFlotante(valor, rango);
    }
}

function procesarQuimica(hoja, rowsData) {
    if (!rowsData || rowsData.filas.length === 0) return;
    const encabezados = rowsData.encabezados;
    const idxElemento = encabezados.indexOf('Elemento');
    const idxValor = encabezados.indexOf('Valor');
    if (idxElemento === -1 || idxValor === -1) return;

    const acumulador = {};
    rowsData.filas.forEach(fila => {
        const el = String(fila[idxElemento]).trim();
        const val = parseFloat(String(fila[idxValor]).replace("%", "").replace(",", "."));
        if (el && !isNaN(val)) {
            if (!acumulador[el]) acumulador[el] = { suma: 0, count: 0 };
            acumulador[el].suma += val;
            acumulador[el].count += 1;
        }
    });

    let indiceRango = 0;
    for (const elementoKey in acumulador) {
        if (indiceRango >= RANGOS_QUIMICA_ELEMENTO.length) break;
        const datos = acumulador[elementoKey];
        hoja.getRange(RANGOS_QUIMICA_ELEMENTO[indiceRango]).setValue(elementoKey);
        hoja.getRange(RANGOS_QUIMICA_VALOR[indiceRango]).setValue(datos.suma / datos.count);
        indiceRango++;
    }
}

function procesarDurezas(hoja, rowsData) {
    if (!rowsData || rowsData.filas.length === 0) return;
    const encabezados = rowsData.encabezados;
    const idxDureza = encabezados.indexOf('Dureza');
    let idxKsi = encabezados.indexOf('"ksi", H - O-  W - AD');
    if (idxKsi === -1) idxKsi = encabezados.findIndex(c => String(c).toLowerCase().includes('ksi'));
    if (idxDureza === -1 && idxKsi === -1) return;

    let indiceRango = 0;
    rowsData.filas.forEach(fila => {
        if (indiceRango >= RANGOS_DUREZAS.length) return;
        if (idxDureza !== -1) hoja.getRange(RANGOS_DUREZAS[indiceRango]).setValue(fila[idxDureza]);
        if (idxKsi !== -1 && indiceRango < RANGOS_KSI.length) hoja.getRange(RANGOS_KSI[indiceRango]).setValue(fila[idxKsi]);
        indiceRango++;
    });
}

// =================================================================
// --- UTILIDADES DE ARCHIVO Y CARPETA ---
// =================================================================

function crearReporteUnicaHoja(plantillaSs, nombreHojaOrigen, nombreNuevoReporte, idBuscado) {
    const hojaOrigen = plantillaSs.getSheetByName(nombreHojaOrigen);
    if (!hojaOrigen) return null;

    let carpetaRaiz;
    try {
        const driveFile = DriveApp.getFileById(plantillaSs.getId());
        const parents = driveFile.getParents();
        carpetaRaiz = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    } catch (e) {
        Logger.log("No se pudo obtener carpeta padre. Se usa Root. " + e.message);
        carpetaRaiz = DriveApp.getRootFolder();
    }

    const it = carpetaRaiz.getFoldersByName(NOMBRE_CARPETA_REPORTES);
    let carpetaDestino = it.hasNext() ? it.next() : carpetaRaiz.createFolder(NOMBRE_CARPETA_REPORTES);

    // Sobrescribir: borra archivos viejos que empiecen con el id_general
    const prefijoAsobrescribir = idBuscado + "_";
    const archivosExistentes = carpetaDestino.getFiles();
    while (archivosExistentes.hasNext()) {
        const arch = archivosExistentes.next();
        if (arch.getName().startsWith(prefijoAsobrescribir)) arch.setTrashed(true);
    }

    const nuevoSS = SpreadsheetApp.create(nombreNuevoReporte);
    const hojaCopiada = hojaOrigen.copyTo(nuevoSS);
    hojaCopiada.setName(nombreHojaOrigen);

    const hojas = nuevoSS.getSheets();
    if (hojas[0].getName() !== nombreHojaOrigen) nuevoSS.deleteSheet(hojas[0]);

    const archivoNuevo = DriveApp.getFileById(nuevoSS.getId());
    archivoNuevo.moveTo(carpetaDestino);

    return nuevoSS;
}

/**
 * CORRECCIÓN DE IMÁGENES PEQUEÑAS:
 * Usa insertImage (imagen flotante con tamaño propio) en lugar de newCellImage.
 * Las imágenes flotantes conservan su tamaño al exportar a Excel/PC.
 * Se escalan para llenar el área de la celda (incluso celdas combinadas).
 */
function insertarImagenFlotante(url, rango) {
    if (!url || typeof url !== 'string' || url.trim() === '') return;
    let finalUrl = url.trim();

    if (finalUrl.includes('drive.google.com')) {
        const idMatch = finalUrl.match(/id=([^&]+)/) || finalUrl.match(/\/d\/([^/]+)/);
        if (idMatch && idMatch[1]) finalUrl = 'https://drive.google.com/uc?export=download&id=' + idMatch[1];
    }
    if (!finalUrl.startsWith('http')) { rango.setValue('No URL'); return; }

    try {
        const resp = UrlFetchApp.fetch(finalUrl, { muteHttpExceptions: true, followRedirects: true });
        if (resp.getResponseCode() !== 200) { rango.setValue('Error Img'); return; }
        insertarBlobFlotante(resp.getBlob(), rango);
    } catch (e) {
        Logger.log('Error insertando imagen: ' + e.message);
        rango.setValue('Error Img');
    }
}

/**
 * Igual que insertarImagenFlotante pero a partir de un Blob que YA se tiene
 * en memoria (no una URL que descargar) — usado tanto para fotos ya
 * descargadas como para el gráfico de durezas generado con Charts service
 * (ver generarGraficoDurezas). Centra y escala manteniendo proporción,
 * soporta celdas combinadas.
 */
function insertarBlobFlotante(blob, rango) {
    const hoja = rango.getSheet();
    try {
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
        Logger.log('Error insertando blob: ' + e.message);
        rango.setValue('Error Img');
    }
}

// =================================================================
// --- GRÁFICO TENSIÓN VS PUNTO (durezas) — celda R202 ---
// Traducción del script en R (ggplot2) que el usuario corría manualmente
// antes de subir el PNG a mano (decisión 2026-07-04). Misma tabla de
// referencia y misma fórmula de límites (IQR) que chart_durezas.py en el
// backend Python — ver ese archivo para el detalle de las decisiones.
// LIMITACIÓN: Charts.newComboChart() no soporta etiquetas de texto en
// coordenadas de datos como ggplot (geom_label) — se usa una leyenda a la
// derecha en su lugar. El backend Python sí tiene las etiquetas inline.
// =================================================================
const ELEMENTO_DEFAULT_GRAFICO = 'TUBERIA';

// (ELEMENTO, MATERIAL, FLUENCIA, TENSION, COLOR) — mismo catálogo fijo que
// TABLA_ELEMENTOS en chart_durezas.py, extraído el 2026-07-04 de la hoja
// ELEMENTO de referencia (catálogo API/ASME, no cambia por proyecto).
const TABLA_ELEMENTOS_GRAFICO = [
    ['CODO', 'A234 Gr WPB', 35, 60, '#A7B4C9'],
    ['CODO', 'A860 WPHY 46', 46, 63, '#89AEE0'],
    ['CODO', 'A860 WPHY 52', 52, 66, '#89AEE0'],
    ['CODO', 'A860 WPHY 60', 60, 75, '#89AEE0'],
    ['CODO', 'A860 WPHY 65', 65, 77, '#89AEE0'],
    ['CODO', 'A860 WPHY 70', 70, 80, '#89AEE0'],
    ['RED', 'A694 F42', 42, 60, '#395882'],
    ['RED', 'A694 F48', 48, 62, '#395882'],
    ['RED', 'A694 F52', 52, 66, '#395882'],
    ['RED', 'A694 F56', 56, 68, '#395882'],
    ['RED', 'A694 F60', 60, 75, '#395882'],
    ['RED', 'A694 F65', 65, 77, '#395882'],
    ['RED', 'A694 F70', 70, 82, '#395882'],
    ['TUBERIA', 'X46', 46.4, 63.1, '#808080'],
    ['TUBERIA', 'X52', 52.2, 66.7, '#808080'],
    ['TUBERIA', 'X56', 56.6, 71.1, '#808080'],
    ['TUBERIA', 'X60', 60.2, 75.4, '#A7B4C9'],
    ['TUBERIA', 'X65', 65.3, 77.6, '#808080'],
    ['TUBERIA', 'X70', 70.3, 82.7, '#808080'],
    ['TUBERIA', 'A53 Gr B/A106 Gr B / X42', 36, 60, '#395882'],
    ['RED', 'ASTM A105', 36, 70, '#9199AB'],
    ['RED', 'A234 Gr WPB', 35, 60, '#A7B4C9'],
    ['WELDOLET', 'ASTM A105', 36, 70, '#9199AB'],
    ['WELDOLET', 'A694 F42', 42, 60, '#395882'],
    ['WELDOLET', 'A694 F52', 52, 66, '#395882'],
    ['WELDOLET', 'A694 F56', 56, 68, '#395882'],
    ['WELDOLET', 'A694 F60', 60, 75, '#395882'],
    ['WELDOLET', 'A694 F65', 65, 77, '#395882'],
    ['WELDOLET', 'A694 F70', 70, 82, '#395882'],
    ['VAL', 'A216 WCB Inf./ A105', 70, 70, '#395882'],
    ['VAL', 'A216 WCB Sup.', 95, 95, '#395882'],
    ['TAPA', 'A694 F42 / A694 F46', 42, 60, '#395882'],
    ['TAPA', 'A694 F52', 52, 66, '#395882'],
    ['TAPA', 'A694 F56', 56, 68, '#395882'],
    ['TAPA', 'A694 F60', 60, 75, '#395882'],
    ['TAPA', 'A694 F65', 65, 77, '#395882'],
    ['TAPA', 'A694 F70', 70, 82, '#395882'],
    ['TAPA', 'A105', 65, 70, '#89AEE0'],
    ['PULMON', 'A283 Gr. C', 30, 55, '#89AEE0'],
    ['PULMON', 'A283 Gr. C', 30, 75, '#89AEE0'],
    ['PULMON', 'A53 Gr B / 516 Gr. 60', 36, 60, '#395882'],
    ['PULMON', 'A516 Gr. 60', 52, 80, '#395882'],
];

/** quantile(..., type=7) de R (interpolación lineal) — `valoresOrdenados`
 * debe venir ya ordenado ascendente. Mismo método que numpy.percentile
 * (default) usado en chart_durezas.py, para que Q1/Q3/límites coincidan
 * entre el reporte generado por Sheets y el generado por la webapp. */
function cuantilTipo7(valoresOrdenados, p) {
    const n = valoresOrdenados.length;
    if (n === 1) return valoresOrdenados[0];
    const h = (n - 1) * p;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    if (lo === hi) return valoresOrdenados[lo];
    return valoresOrdenados[lo] + (h - lo) * (valoresOrdenados[hi] - valoresOrdenados[lo]);
}

function generarGraficoDurezas(hojaDestino, rowsDurezas, celdaDestino, elemento) {
    elemento = elemento || ELEMENTO_DEFAULT_GRAFICO;
    const rango = hojaDestino.getRange(celdaDestino);
    if (!rowsDurezas || !rowsDurezas.filas || !rowsDurezas.filas.length) return;

    const encabezados = rowsDurezas.encabezados;
    let idxKsi = encabezados.indexOf('"ksi", H - O-  W - AD');
    if (idxKsi === -1) idxKsi = encabezados.findIndex(c => String(c).toLowerCase().includes('ksi'));
    if (idxKsi === -1) return;

    const valores = rowsDurezas.filas
        .map(f => parseFloat(String(f[idxKsi]).replace(',', '.')))
        .filter(v => !isNaN(v));
    if (valores.length < 2) return;

    const ordenados = [...valores].sort((a, b) => a - b);
    const q1 = cuantilTipo7(ordenados, 0.25);
    const q3 = cuantilTipo7(ordenados, 0.75);
    const iqr = q3 - q1;
    const limInf = q1 - 1.5 * iqr;
    const limSup = q3 + 1.5 * iqr;

    // distinct(MATERIAL, TENSION, COLOR) del elemento pedido
    const vistos = new Set();
    const materialesUnicos = [];
    TABLA_ELEMENTOS_GRAFICO.forEach(([elem, material, , tension, color]) => {
        if (elem !== elemento) return;
        const key = material + '|' + tension + '|' + color;
        if (vistos.has(key)) return;
        vistos.add(key);
        materialesUnicos.push({ material: material, tension: tension, color: color });
    });

    try {
        const dataTable = Charts.newDataTable();
        dataTable.addColumn(Charts.ColumnType.NUMBER, 'Punto');
        dataTable.addColumn(Charts.ColumnType.NUMBER, 'Tensión (ksi)');
        dataTable.addColumn(Charts.ColumnType.NUMBER, 'Lim. Inf.');
        dataTable.addColumn(Charts.ColumnType.NUMBER, 'Lim. Sup.');
        materialesUnicos.forEach(m => dataTable.addColumn(Charts.ColumnType.NUMBER, m.material));

        valores.forEach((v, i) => {
            const fila = [i + 1, v, limInf, limSup];
            materialesUnicos.forEach(m => fila.push(m.tension));
            dataTable.addRow(fila);
        });

        // Series 0 = puntos reales (scatter). El resto (límites + líneas de
        // material) se fuerzan a tipo 'line' con valor constante, que es la
        // forma estándar de simular hlines en un combo chart de Apps Script.
        const seriesOptions = {};
        for (let i = 1; i <= 2 + materialesUnicos.length; i++) {
            seriesOptions[i] = {
                type: 'line',
                lineWidth: i <= 2 ? 2 : 1.2,
                lineDashStyle: i <= 2 ? null : [4, 4],
                pointSize: 0,
            };
        }
        const colores = ['#f8996d', '#ff0000', '#ff0000'].concat(materialesUnicos.map(m => m.color));

        const chart = Charts.newComboChart()
            .setDataTable(dataTable)
            .setXAxisTitle('Punto')
            .setYAxisTitle('Resistencia a la tensión (Ksi)')
            .setDimensions(1100, 520)
            .setOption('seriesType', 'scatter')
            .setOption('backgroundColor', '#ffffff')
            .setOption('legend', { position: 'right', textStyle: { fontSize: 9 } })
            .setOption('pointSize', 5)
            .setOption('colors', colores)
            .setOption('series', seriesOptions)
            .build();

        insertarBlobFlotante(chart.getAs('image/png'), rango);
    } catch (e) {
        Logger.log('Error generando gráfico de durezas: ' + e.message);
    }
}

function obtenerFilaPorId(spreadsheet, nombreHoja, colIdNombre, valorId) {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) return { fila: null, encabezados: [] };
    const datos = hoja.getDataRange().getValues();
    const encabezados = datos.shift();
    const idx = encabezados.indexOf(colIdNombre);
    if (idx === -1) return { fila: null, encabezados: encabezados };
    const fila = datos.find(r => String(r[idx]).trim() === String(valorId).trim());
    return { fila: fila || null, encabezados: encabezados };
}

function obtenerFilasRelacionadas(spreadsheet, nombreHoja, colIdNombre, valorId) {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) return { filas: [], encabezados: [] };
    const datos = hoja.getDataRange().getValues();
    const encabezados = datos.shift();
    const idx = encabezados.indexOf(colIdNombre);
    if (idx === -1) return { filas: [], encabezados: encabezados };
    const filas = datos.filter(r => String(r[idx]).trim() === String(valorId).trim());
    return { filas: filas, encabezados: encabezados };
}

function generarListaRangos(listaRangosString) {
    const listaCeldas = [];
    const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    listaRangosString.forEach(rangoStr => {
        const rango = hoja.getRange(rangoStr);
        const numFilas = rango.getNumRows();
        const numCols = rango.getNumColumns();
        const rowInicio = rango.getRow();
        const colInicio = rango.getColumn();
        for (let c = 0; c < numCols; c++) {
            for (let r = 0; r < numFilas; r++) {
                listaCeldas.push(hoja.getRange(rowInicio + r, colInicio + c).getA1Notation());
            }
        }
    });
    return listaCeldas;
}
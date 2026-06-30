/**
 * =================================================================
 * --- ARCHIVO: Reporte_Medicion_Espesores.gs  (v3) ---
 * =================================================================
 * Generador de Reportes de Medición de Espesores (FORMATOS_SCAN_C)
 * ✅ Panel masivo HTML con progreso en tiempo real
 * ✅ Imágenes flotantes (conservan tamaño al exportar a Excel)
 * @author  Diego Alejandro Hernandez Blanco
 * ✅ Menú unificado (Manual / Masivo / Todos los pendientes)
 * ✅ Integrado con Sistema de COLA (Queue) y guardado automático de enlaces
 *
 * CAMBIOS v3:
 * ✅ Columna "item" ahora se mapea a celda A34 (columna A)
 * ✅ Columna "certificado" de 1_general se mapea a celda C43
 * ✅ Las fórmulas de Z34, AB34, AD34, AF34, AH34 se copian
 *    hacia abajo junto con cada fila de lectura insertada
 */

// =================================================================
// --- 1. CONFIGURACIÓN PRINCIPAL ---
// =================================================================
const ID_SPREADSHEET = "18pN681sIIu3rT6gO_MDfDFr9OZkOaFpAOPfQxooJpXk";
const NOMBRE_CARPETA_REPORTES = "REPORTES_MEDICION_ESPESORES";

const NOMBRE_HOJA_ACTIVADORA = "1_general";
const HOJA_GENERAL = "1_general";
const COLUMNA_PVID = "id_general";
const COLUMNA_ACTIVADORA = "GenerarReporteTrigger";
const COLUMNA_LINK_REPORTE = "LinkReporte";

const HOJA_LECTURAS = "2_lecturas_tomadas";
const HOJA_FOTOGRAFIAS = "3_fotografias";
const HOJA_FORMATO = "FORMATOS_SCAN_C";

// --- MAPEO DE DATOS GENERALES ---
const MAPEO_GENERAL = {
    'cliente': 'D7', 'contrato': 'K7', 'fecha_reporte': 'U7', 'ot': 'AD7', 'num_reporte': 'AK7',
    'zona': 'D9', 'estacion': 'K9', 'sistema': 'U8', 'alcance': 'AD9',
    'norma_referencia': 'F11', 'criterio_aceptacion': 'AB11',
    'material': 'E15', 'temperatura_servicio': 'R15', 'tipo_recubrimiento': 'AB15', 'condicion_recubrimiento': 'AJ15',
    'rating_sistema': 'E17', 'presion_diseno': 'S17', 'mop': 'Z17', 'codigo_diseno': 'AG17',
    'marca_equipo': 'G21', 'modelo_equipo': 'X21', 'serie_equipo': 'AF21', 'fecha_calibracion': 'AL21',
    'tipo_palpador': 'E23', 'frecuencia': 'R23', 'tamano_diametro': 'AB23', 'bloque_calibracion': 'AE23',
    'material_bloque': 'E25', 'procedimiento': 'P25', 'tecnica': 'AC25', 'velocidad_calibracion': 'AL25',
    // Firmas y pie de página
    'nombre': 'C41', 'cargo': 'C42', 'certificado': 'C43', 'fecha': 'C44'
    // ✅ CAMBIO v3: Se agregó 'certificado' → C43
};

// --- MAPEO DE IMÁGENES (celda destino en el formato) ---
const MAPEO_IMAGENES = {
    'link_foto_equipo': 'D21',   // Foto del equipo medidor
    'link_firma': 'C40'          // Firma del inspector
};

// --- CONFIGURACIÓN DE FILAS DINÁMICAS ---
const FILA_INICIO_LECTURAS = 34;

// ✅ CAMBIO v3: Se agregó 'item' → columna A34
const COLUMNAS_LECTURAS = {
    'item': 'A',          // ← NUEVO: campo item en columna A
    'CML': 'F', 'componente': 'B', 'diametro': 'H', 't_nominal': 'I',
    'med1': 'J', 'med2': 'K', 'med3': 'L', 'med4': 'M', 'med5': 'N', 'med6': 'O',
    'med7': 'P', 'med8': 'Q', 'med9': 'R', 'med10': 'S', 'med11': 'T', 'med12': 'U',
    'med13': 'V', 'med14': 'W', 'med15': 'X', 'med16': 'Y',
    'observaciones': 'AJ'
    // Nota: Z, AB, AD, AF, AH tienen FÓRMULAS en la plantilla → se propagan
    // automáticamente por copiarFormulasLecturas()
};

// ✅ CAMBIO v3: Columnas con fórmulas que deben copiarse hacia abajo en cada fila nueva
// (MÁXIMO, MÍNIMO, PROMEDIO, %PERDIDA Vs NOMINAL, %PERDIDA Vs PROMEDIO)
const COLUMNAS_FORMULA_LECTURAS = ['Z', 'AB', 'AD', 'AF', 'AH'];

const FILA_INICIO_FOTOS = 37;
const COLUMNAS_FOTOS = ['A', 'N', 'AA']; // 3 columnas por bloque de fotos

// --- VARIABLES DE ESTADO PARA LA COLA ---
const PROP_QUEUE_IDS = 'QUEUE_IDS';
const PROP_VALOR_BUSCADO = 'VALOR_BUSCADO';


// =================================================================
// --- 2. MENÚ ÚNICO ---
// =================================================================

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Reportes Espesores UT')
        .addItem('1. 📄 Generar reporte por ID (manual)', 'generarPorIdManual')
        .addItem('2. 🚀 Generar reportes (selección múltiple)', 'mostrarPanelSelectorMasivo')
        .addItem('3. ⏳ Generar todos los pendientes', 'generarTodosPendientes')
        .addSeparator()
        .addItem('🗑️ Limpiar cola / reiniciar disparadores', 'limpiarColaDisparo')
        .addToUi();
}


// =================================================================
// --- 3. ACTIVADOR onEdit ---
// =================================================================

function onEditTrigger(e) {
    const range = e.range;
    const sheet = range.getSheet();
    const editedRow = range.getRow();

    if (editedRow === 1) return;

    if (sheet.getName() === NOMBRE_HOJA_ACTIVADORA) {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const triggerColIdx = headers.indexOf(COLUMNA_ACTIVADORA) + 1;
        const linkColIdx = headers.indexOf(COLUMNA_LINK_REPORTE) + 1;
        const pvIdColIdx = headers.indexOf(COLUMNA_PVID) + 1;

        if (range.getColumn() === triggerColIdx) {
            Utilities.sleep(1000);

            const valorCelda = range.getValue();
            const valorNorm = valorCelda ? valorCelda.toString().trim().toLowerCase() : '';

            if (valorNorm === 'yes' || valorNorm === 'true') {
                const pvId = sheet.getRange(editedRow, pvIdColIdx).getValue();

                if (!pvId) {
                    if (linkColIdx > 0) sheet.getRange(editedRow, linkColIdx).setValue('ERROR: Falta ID');
                    range.setValue('Error');
                    return;
                }

                try {
                    if (linkColIdx > 0) sheet.getRange(editedRow, linkColIdx).setValue('Generando...');
                    iniciarGeneracionCola([pvId.toString().trim()], false);
                    range.setValue('No');
                } catch (error) {
                    if (linkColIdx > 0) sheet.getRange(editedRow, linkColIdx).setValue(`ERROR: ${error.message}`);
                    range.setValue('Error');
                }
            }
        }
    }
}


// =================================================================
// --- 4. OPCIONES DE GENERACIÓN ---
// =================================================================

// --- OPCIÓN 1: Manual por ID ---
function mostrarPanelManual() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.prompt(
        'Generar Reporte Individual',
        `Ingrese el ID del reporte (columna "${COLUMNA_PVID}").\nSi ya existe, se reemplazará el archivo antiguo:`,
        ui.ButtonSet.OK_CANCEL
    );

    if (result.getSelectedButton() == ui.Button.OK) {
        const id = result.getResponseText().trim();
        if (!id) {
            ui.alert(`Por favor, ingrese un ${COLUMNA_PVID} válido.`);
            return;
        }
        try {
            SpreadsheetApp.getActiveSpreadsheet().toast(`Generando reporte para ID: ${id}...`, '⚙️ Procesando', 15);
            const res = ejecutarGeneracion(id, SpreadsheetApp.openById(ID_SPREADSHEET));
            if (res.success) {
                _guardarLinkEnHoja(id, res.url);
                ui.alert('✅ Éxito', `Reporte "${id}" generado.\n🔗 Enlace: ${res.url}`, ui.ButtonSet.OK);
            } else {
                ui.alert('❌ Error', res.error, ui.ButtonSet.OK);
            }
        } catch (e) {
            ui.alert('❌ Error', e.message, ui.ButtonSet.OK);
        }
    }
}

// --- OPCIÓN 2: Panel masivo HTML con progreso ---
function mostrarPanelSelectorMasivo() {
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
    #log { font-size: 11px; color: #555; text-align: left; max-height: 80px; overflow-y: auto; }
    .btn-primary { width: 100%; background: #1976d2; color: white; border: none; padding: 12px; cursor: pointer; border-radius: 4px; font-size: 14px; font-weight: bold; transition: 0.3s; }
    .btn-primary:hover { background: #1565c0; }
    .loading { text-align: center; padding: 20px; font-style: italic; color: #666; }
  </style>
</head>
<body>
  <h2>🚀 Selector de Reportes de Espesores</h2>

  <div id="selection-area">
    <div class="controls">
      <button onclick="seleccionar(true)">✔ Todos</button>
      <button onclick="seleccionar(false)">✖ Ninguno</button>
      <button onclick="seleccionarPendientes()">⏳ Pendientes</button>
    </div>
    <div id="list-container">
      <div class="loading">Cargando registros...</div>
    </div>
    <button id="btn-start" class="btn-primary" onclick="iniciarGeneracion()">
      Generar seleccionados
    </button>
  </div>

  <div id="status-box">
    <div id="progress-text">0 / 0</div>
    <div id="log"></div>
  </div>

  <button id="btn-close" class="btn-primary" style="display:none;"
          onclick="google.script.host.close()">
    Cerrar ventana
  </button>

  <script>
    let toProcess = [];
    let currentIndex = 0;

    window.onload = function() {
      google.script.run
        .withSuccessHandler(renderList)
        .withFailureHandler(function(err){ alert("Error al cargar: " + err.message); })
        .obtenerListaReportes();
    };

    function renderList(data) {
      const container = document.getElementById('list-container');
      if (!data || data.length === 0) {
        container.innerHTML = "<div class='loading'>No se encontraron registros.</div>";
        return;
      }
      let html = '';
      data.forEach(function(item) {
        const badgeClass = item.hasLink ? 'bg-done' : 'bg-pending';
        const badgeText  = item.hasLink ? 'Generado' : 'Pendiente';
        const checked    = item.hasLink ? '' : 'checked';
        html += '<label class="item">' +
                  '<input type="checkbox" class="chk-id" value="' + item.id + '" ' + checked + '>' +
                  '<span>' + item.id + '</span>' +
                  '<span class="badge ' + badgeClass + '">' + badgeText + '</span>' +
                '</label>';
      });
      container.innerHTML = html;
    }

    function seleccionar(estado) {
      document.querySelectorAll('.chk-id').forEach(function(c){ c.checked = estado; });
    }
    function seleccionarPendientes() {
      document.querySelectorAll('.chk-id').forEach(function(c) {
        const badge = c.parentElement.querySelector('.badge').innerText;
        c.checked = (badge === 'Pendiente');
      });
    }

    function iniciarGeneracion() {
      const checks = document.querySelectorAll('.chk-id:checked');
      toProcess = Array.from(checks).map(function(c){ return c.value; });
      if (toProcess.length === 0) { alert("Seleccione al menos un ID."); return; }

      document.getElementById('selection-area').style.display = 'none';
      document.getElementById('status-box').style.display     = 'block';
      currentIndex = 0;
      actualizarProgreso();
      logMsg("Iniciando generación de <b>" + toProcess.length + "</b> reportes...");
      procesarSiguiente();
    }

    function procesarSiguiente() {
      if (currentIndex >= toProcess.length) {
        document.getElementById('progress-text').innerText = '¡Listo! ✅';
        document.getElementById('btn-close').style.display = 'block';
        logMsg("🎉 Proceso finalizado.");
        return;
      }
      const id = toProcess[currentIndex];
      logMsg("⏳ Generando ID: <b>" + id + "</b>...");
      google.script.run
        .withSuccessHandler(function(res) {
          if (res && res.success) {
            logMsg("<span style='color:green;'>✅ " + id + " generado.</span>");
          } else {
            logMsg("<span style='color:red;'>❌ Error en " + id + ": " + (res ? res.error : 'desconocido') + "</span>");
          }
          currentIndex++;
          actualizarProgreso();
          procesarSiguiente();
        })
        .withFailureHandler(function(err) {
          logMsg("<span style='color:red;'>❌ Error en " + id + ": " + err.message + "</span>");
          currentIndex++;
          actualizarProgreso();
          procesarSiguiente();
        })
        .procesarUnReporteYGuardar(id);
    }

    function actualizarProgreso() {
      document.getElementById('progress-text').innerText = currentIndex + " / " + toProcess.length;
    }
    function logMsg(msg) {
      const d = document.getElementById('log');
      d.innerHTML += "<div>" + msg + "</div>";
      d.scrollTop = d.scrollHeight;
    }
  </script>
</body>
</html>
  `;

    const output = HtmlService.createHtmlOutput(htmlContent).setWidth(450).setHeight(530);
    SpreadsheetApp.getUi().showModalDialog(output, '🚀 Generador Masivo de Reportes');
}

// Llamada desde el panel HTML: genera un reporte y guarda el link
function procesarUnReporteYGuardar(idBuscado) {
    const ss = SpreadsheetApp.openById(ID_SPREADSHEET);
    const res = ejecutarGeneracion(idBuscado, ss);
    if (res.success) _guardarLinkEnHoja(idBuscado, res.url);
    return res;
}

// --- OPCIÓN 3: Todos los pendientes (vía cola de triggers) ---
function generarTodosPendientes() {
    const ui = SpreadsheetApp.getUi();
    const reportes = obtenerListaReportes();
    const pendientes = reportes.filter(r => !r.hasLink).map(r => r.id);

    if (pendientes.length === 0) {
        ui.alert('ℹ️ Sin pendientes', 'No hay reportes pendientes por generar.', ui.ButtonSet.OK);
        return;
    }

    const res = ui.alert(
        'Confirmar generación masiva',
        `Se detectaron ${pendientes.length} reportes pendientes.\n¿Iniciar la generación progresiva en cola?`,
        ui.ButtonSet.YES_NO
    );
    if (res === ui.Button.YES) iniciarGeneracionCola(pendientes, true);
}


// =================================================================
// --- 5. COLA DE TRIGGERS ---
// =================================================================

function iniciarGeneracionCola(idsArray, mostrarAlertas = true) {
    if (!idsArray || idsArray.length === 0) return;

    try {
        limpiarPropiedadesEstado();

        const total = idsArray.length;
        const primerId = idsArray.shift();

        const props = PropertiesService.getScriptProperties();
        props.setProperty(PROP_QUEUE_IDS, JSON.stringify(idsArray));
        props.setProperty(PROP_VALOR_BUSCADO, primerId);

        ScriptApp.newTrigger('procesadorDeColaTrigger').timeBased().after(2000).create();

        if (mostrarAlertas) {
            SpreadsheetApp.getUi().alert(
                '✅ Cola iniciada',
                `Se procesarán ${total} reporte(s) de forma progresiva.\nEl sistema finalizará uno y comenzará el siguiente automáticamente.`,
                SpreadsheetApp.getUi().ButtonSet.OK
            );
        }
    } catch (e) {
        Logger.log(`Error en iniciarGeneracionCola: ${e.stack}`);
        limpiarPropiedadesEstado();
    }
}

function avanzarSiguienteEnCola() {
    const props = PropertiesService.getScriptProperties();
    let queueStr = props.getProperty(PROP_QUEUE_IDS);
    let queue = queueStr ? JSON.parse(queueStr) : [];

    if (queue.length > 0) {
        const nextId = queue.shift();
        props.setProperty(PROP_QUEUE_IDS, JSON.stringify(queue));
        props.setProperty(PROP_VALOR_BUSCADO, nextId);
        ScriptApp.newTrigger('procesadorDeColaTrigger').timeBased().after(3000).create();
    } else {
        Logger.log('Cola finalizada exitosamente.');
        limpiarPropiedadesEstado();
    }
}


// =================================================================
// --- 6. PROCESADOR DE LA COLA (trigger) ---
// =================================================================

function procesadorDeColaTrigger() {
    borrarTriggersExistentes('procesadorDeColaTrigger');

    const props = PropertiesService.getScriptProperties();
    const valorBuscado = props.getProperty(PROP_VALOR_BUSCADO);
    if (!valorBuscado) return;

    try {
        const ss = SpreadsheetApp.openById(ID_SPREADSHEET);
        const resultado = ejecutarGeneracion(valorBuscado, ss);

        if (resultado.success) {
            _guardarLinkEnHoja(valorBuscado, resultado.url);
        } else {
            _guardarLinkEnHoja(valorBuscado, `ERROR: ${resultado.error}`);
        }

        avanzarSiguienteEnCola();
    } catch (e) {
        Logger.log(`❌ ERROR CRÍTICO procesando ID ${valorBuscado}: ${e.stack}`);
        avanzarSiguienteEnCola();
    }
}

// Escribe el link en la columna LinkReporte de 1_general
function _guardarLinkEnHoja(idBuscado, valor) {
    try {
        const ss = SpreadsheetApp.openById(ID_SPREADSHEET);
        const hoja = ss.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
        const datos = hoja.getDataRange().getValues();
        const hdrs = datos[0].map(h => (typeof h === 'string' ? h.trim() : h));
        const idCol = hdrs.indexOf(COLUMNA_PVID);
        const lkCol = hdrs.indexOf(COLUMNA_LINK_REPORTE);
        if (idCol === -1 || lkCol === -1) return;

        for (let i = 1; i < datos.length; i++) {
            if (datos[i][idCol] != null &&
                datos[i][idCol].toString().trim() === idBuscado.toString().trim()) {
                hoja.getRange(i + 1, lkCol + 1).setValue(valor);
                break;
            }
        }
    } catch (e) {
        Logger.log(`Error guardando link para ${idBuscado}: ${e.message}`);
    }
}


// =================================================================
// --- 7. LÓGICA DE NEGOCIO: GENERACIÓN DEL REPORTE ---
// =================================================================

function ejecutarGeneracion(idBuscado, ss) {
    try {
        // 1. Obtener datos
        const datosGeneral = obtenerFilaPorId(ss, HOJA_GENERAL, COLUMNA_PVID, idBuscado);
        if (!datosGeneral) throw new Error(`El ID "${idBuscado}" no existe en la hoja "${HOJA_GENERAL}".`);

        const datosLecturas = obtenerFilasRelacionadas(ss, HOJA_LECTURAS, COLUMNA_PVID, idBuscado);
        const datosFotos = obtenerFilasRelacionadas(ss, HOJA_FOTOGRAFIAS, COLUMNA_PVID, idBuscado);

        // 2. Limpiar archivos anteriores del mismo ID
        const carpeta = obtenerCarpeta(NOMBRE_CARPETA_REPORTES);
        const busqueda = carpeta.searchFiles(`title contains 'Reporte_Espesores_${idBuscado}'`);
        while (busqueda.hasNext()) {
            const f = busqueda.next();
            f.setTrashed(true);
            Logger.log(`Archivo antiguo eliminado: ${f.getName()}`);
        }

        // 3. Crear copia de la plantilla
        const nombreArchivo = `Reporte_Espesores_${idBuscado}_${Utilities.formatDate(new Date(), 'GMT-5', 'yyyyMMdd')}`;
        const copiaSS = crearCopiaPlantilla(ss, nombreArchivo);
        const hojaDestino = copiaSS.getSheetByName(HOJA_FORMATO);
        if (!hojaDestino) throw new Error(`No se encontró la hoja "${HOJA_FORMATO}" en la plantilla.`);

        // 4. Insertar filas extra para lecturas y propagar fórmulas de cálculo
        let filasInsertadas = 0;
        const nLecturas = datosLecturas.length;

        if (nLecturas > 1) {
            // 4a. Insertar filas necesarias después de la fila base
            hojaDestino.insertRowsAfter(FILA_INICIO_LECTURAS, nLecturas - 1);

            // 4b. Copiar formato visual (bordes, colores, alto de fila) a todas las filas nuevas
            const rangoBase = hojaDestino.getRange(FILA_INICIO_LECTURAS, 1, 1, hojaDestino.getMaxColumns());
            rangoBase.copyTo(
                hojaDestino.getRange(FILA_INICIO_LECTURAS + 1, 1, nLecturas - 1, hojaDestino.getMaxColumns()),
                SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false
            );

            // ✅ CAMBIO v3: Propagar fórmulas de Z, AB, AD, AF, AH a cada fila nueva
            copiarFormulasLecturas(hojaDestino, FILA_INICIO_LECTURAS, nLecturas);

            filasInsertadas = nLecturas - 1;
        }

        // 5. Llenar lecturas (incluyendo campo 'item' en columna A)
        datosLecturas.forEach((lectura, i) => {
            const fila = FILA_INICIO_LECTURAS + i;
            for (const key in COLUMNAS_LECTURAS) {
                if (lectura[key] !== undefined && lectura[key] !== '') {
                    hojaDestino.getRange(`${COLUMNAS_LECTURAS[key]}${fila}`).setValue(lectura[key]);
                }
            }
        });

        // 6. Llenar datos generales (ajustando filas desplazadas por las lecturas)
        for (const campo in MAPEO_GENERAL) {
            const celdaAjustada = ajustarReferenciaFila(MAPEO_GENERAL[campo], filasInsertadas, FILA_INICIO_LECTURAS);
            if (datosGeneral[campo] !== undefined && datosGeneral[campo] !== '') {
                let valor = datosGeneral[campo];
                if (valor instanceof Date) valor = Utilities.formatDate(valor, 'GMT-5', 'dd/MM/yyyy');
                hojaDestino.getRange(celdaAjustada).setValue(valor);
            }
        }

        // 7. Insertar imágenes del MAPEO_IMAGENES (foto equipo, firma, etc.)
        for (const campo in MAPEO_IMAGENES) {
            if (datosGeneral[campo]) {
                const celdaAjustada = ajustarReferenciaFila(MAPEO_IMAGENES[campo], filasInsertadas, FILA_INICIO_LECTURAS);
                insertarImagenFlotante(datosGeneral[campo], hojaDestino.getRange(celdaAjustada));
            }
        }

        // 8. Insertar fotos desde hoja 3_fotografias (bloques de 3 columnas)
        const filaFotosBase = FILA_INICIO_FOTOS + filasInsertadas;
        const bloquesFotos = chunkArray(datosFotos, 3);

        if (bloquesFotos.length > 1) {
            const filasAInsertar = (bloquesFotos.length - 1) * 2;
            hojaDestino.insertRowsAfter(filaFotosBase + 1, filasAInsertar);

            const rangoTemplateFotos = hojaDestino.getRange(filaFotosBase, 1, 2, hojaDestino.getMaxColumns());
            for (let i = 1; i < bloquesFotos.length; i++) {
                const filaD = filaFotosBase + (i * 2);
                rangoTemplateFotos.copyTo(
                    hojaDestino.getRange(filaD, 1),
                    SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false
                );
                hojaDestino.setRowHeight(filaD, hojaDestino.getRowHeight(filaFotosBase));
                hojaDestino.setRowHeight(filaD + 1, hojaDestino.getRowHeight(filaFotosBase + 1));
            }
        }

        bloquesFotos.forEach((bloque, idxBloque) => {
            const fFoto = filaFotosBase + (idxBloque * 2);
            const fDesc = fFoto + 1;
            bloque.forEach((foto, idxImg) => {
                const col = COLUMNAS_FOTOS[idxImg];
                if (foto['link_imagen']) {
                    insertarImagenFlotante(foto['link_imagen'], hojaDestino.getRange(`${col}${fFoto}`));
                }
                if (foto['descripccion']) {
                    hojaDestino.getRange(`${col}${fDesc}`).setValue(foto['descripccion']);
                }
            });
        });

        // 9. Exportar a Excel y limpiar hoja temporal
        SpreadsheetApp.flush();
        const hojasCopia = copiaSS.getSheets();
        hojasCopia.forEach(h => { if (h.getName() !== HOJA_FORMATO) copiaSS.deleteSheet(h); });

        const blobExcel = exportarAExcel(copiaSS.getId(), nombreArchivo);
        const archivoFin = carpeta.createFile(blobExcel);
        DriveApp.getFileById(copiaSS.getId()).setTrashed(true);

        return { success: true, url: archivoFin.getUrl(), nombre: nombreArchivo };

    } catch (e) {
        Logger.log(`Error en ejecutarGeneracion: ${e.stack}`);
        return { success: false, error: e.toString() };
    }
}


// =================================================================
// --- 8. UTILIDADES ---
// =================================================================

/**
 * ✅ NUEVO v3: Copia las fórmulas de cálculo (columnas Z, AB, AD, AF, AH)
 * desde la fila base hacia todas las filas adicionales de lecturas.
 *
 * Esto garantiza que las columnas de MÁXIMO, MÍNIMO, PROMEDIO,
 * %PERDIDA Vs NOMINAL y %PERDIDA Vs PROMEDIO se calculen correctamente
 * en cada fila de lectura, no sólo en la primera.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} hoja  - La hoja de destino
 * @param {number} filaBase   - Fila base de lecturas (FILA_INICIO_LECTURAS = 34)
 * @param {number} totalFilas - Cantidad total de filas de lectura para este ID
 */
function copiarFormulasLecturas(hoja, filaBase, totalFilas) {
    if (totalFilas <= 1) return;

    COLUMNAS_FORMULA_LECTURAS.forEach(col => {
        const celdaFuente = hoja.getRange(`${col}${filaBase}`);
        const formulaOrigen = celdaFuente.getFormula();

        // Solo actuar si la celda origen realmente tiene una fórmula
        if (!formulaOrigen || formulaOrigen.trim() === '') return;

        for (let i = 1; i < totalFilas; i++) {
            const filaDestino = filaBase + i;
            const formulaAjustada = ajustarFormulaPorFila(formulaOrigen, filaBase, filaDestino);
            hoja.getRange(`${col}${filaDestino}`).setFormula(formulaAjustada);
        }
    });
}

/**
 * ✅ NUEVO v3: Ajusta los números de fila dentro de una fórmula.
 *
 * Reemplaza todas las referencias de celda que apunten a filaOrigen
 * por referencias a filaDestino.
 * Ejemplo: =MAX(J34:Y34) con filaOrigen=34, filaDestino=35 → =MAX(J35:Y35)
 *
 * @param {string} formula     - Fórmula original (ej: "=MAX(J34:Y34)")
 * @param {number} filaOrigen  - Número de fila de la fórmula original
 * @param {number} filaDestino - Número de fila de destino
 * @returns {string} Fórmula con referencias actualizadas
 */
function ajustarFormulaPorFila(formula, filaOrigen, filaDestino) {
    // Reemplaza patrones tipo "A34", "AB34", "$AB34", "AB$34"
    // por la referencia equivalente apuntando a filaDestino
    const regex = new RegExp('(\\$?[A-Z]+\\$?)(' + filaOrigen + ')(?=[^0-9]|$)', 'g');
    return formula.replace(regex, (match, colPart, rowPart) => {
        return colPart + filaDestino;
    });
}

// Limpia cola y elimina triggers
function limpiarPropiedadesEstado() {
    PropertiesService.getScriptProperties().deleteAllProperties();
    borrarTriggersExistentes('procesadorDeColaTrigger');
}

function borrarTriggersExistentes(nombreFuncion) {
    try {
        ScriptApp.getProjectTriggers().forEach(t => {
            if (t.getHandlerFunction() === nombreFuncion) ScriptApp.deleteTrigger(t);
        });
    } catch (e) { }
}

// Lista de reportes con estado (para panel HTML y opción 3)
function obtenerListaReportes() {
    const ss = SpreadsheetApp.openById(ID_SPREADSHEET);
    const sheet = ss.getSheetByName(NOMBRE_HOJA_ACTIVADORA);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(h => typeof h === 'string' ? h.trim() : h);
    const idxId = headers.indexOf(COLUMNA_PVID);
    const idxLink = headers.indexOf(COLUMNA_LINK_REPORTE);

    const reportes = [];
    for (let i = 1; i < data.length; i++) {
        const id = data[i][idxId];
        if (id) {
            const link = idxLink !== -1 ? data[i][idxLink] : '';
            const hasLink = typeof link === 'string' && link.startsWith('http');
            reportes.push({ id: id.toString().trim(), hasLink });
        }
    }
    return reportes;
}

function obtenerFilaPorId(ss, nombreHoja, colNombre, valorId) {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return null;
    const data = hoja.getDataRange().getValues();
    const headers = data[0].map(h => typeof h === 'string' ? h.trim() : h);
    const colIdx = headers.indexOf(colNombre);
    if (colIdx === -1) return null;
    const row = data.find(r => String(r[colIdx]).trim() === String(valorId).trim());
    if (!row) return null;
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
}

function obtenerFilasRelacionadas(ss, nombreHoja, colNombre, valorId) {
    const hoja = ss.getSheetByName(nombreHoja);
    if (!hoja) return [];
    const data = hoja.getDataRange().getValues();
    const headers = data[0].map(h => typeof h === 'string' ? h.trim() : h);
    const colIdx = headers.indexOf(colNombre);
    if (colIdx === -1) return [];
    return data
        .filter((r, i) => i > 0 && String(r[colIdx]).trim() === String(valorId).trim())
        .map(row => {
            const obj = {};
            headers.forEach((h, i) => obj[h] = row[i]);
            return obj;
        });
}

function crearCopiaPlantilla(ss, nombre) {
    const copy = DriveApp.getFileById(ss.getId()).makeCopy(nombre);
    return SpreadsheetApp.openById(copy.getId());
}

function ajustarReferenciaFila(ref, offset, filaCorte) {
    if (offset === 0) return ref;
    const match = ref.match(/([A-Z]+)(\d+)/);
    if (!match) return ref;
    const col = match[1];
    const row = parseInt(match[2]);
    return row >= filaCorte ? `${col}${row + offset}` : ref;
}

/**
 * ✅ IMÁGENES FLOTANTES
 * Inserta una imagen como objeto flotante escalado al área de la celda (o celda combinada).
 * Las imágenes flotantes conservan su tamaño real al exportar el archivo a Excel y abrirlo en PC,
 * a diferencia de newCellImage() que sale muy pequeña.
 */
function insertarImagenFlotante(url, rango) {
    if (!url || typeof url !== 'string' || url.trim() === '') return;
    let finalUrl = url.trim();

    // Convertir link de Drive a URL de descarga directa
    if (finalUrl.includes('drive.google.com')) {
        const idMatch = finalUrl.match(/id=([^&]+)/) || finalUrl.match(/\/d\/([^/]+)/);
        if (idMatch && idMatch[1]) {
            finalUrl = 'https://drive.google.com/uc?export=download&id=' + idMatch[1];
        }
    }
    if (!finalUrl.startsWith('http')) { rango.setValue('Sin URL'); return; }

    const hoja = rango.getSheet();
    try {
        const resp = UrlFetchApp.fetch(finalUrl, { muteHttpExceptions: true, followRedirects: true });
        if (resp.getResponseCode() !== 200) { rango.setValue('Error Img'); return; }
        const blob = resp.getBlob();

        // Soporte para celdas combinadas
        let destino = rango;
        if (rango.isPartOfMerge()) {
            const merges = rango.getMergedRanges();
            if (merges && merges.length > 0) destino = merges[0];
        }

        const fila = destino.getRow();
        const col = destino.getColumn();

        // Calcular dimensiones del área en píxeles
        let anchoArea = 0, altoArea = 0;
        for (let c = 0; c < destino.getNumColumns(); c++) anchoArea += hoja.getColumnWidth(col + c);
        for (let r = 0; r < destino.getNumRows(); r++) altoArea += hoja.getRowHeight(fila + r);

        const img = hoja.insertImage(blob, col, fila);

        // Escalar manteniendo proporción con pequeño margen interior
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
        Logger.log('Error insertando imagen flotante: ' + e.message);
        rango.setValue('Error Img');
    }
}

function chunkArray(arr, size) {
    const results = [];
    while (arr.length) results.push(arr.splice(0, size));
    return results;
}

function exportarAExcel(id, nombre) {
    const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
    const res = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        muteHttpExceptions: true
    });
    return res.getBlob().setName(nombre + '.xlsx');
}

function obtenerCarpeta(nombre) {
    const fileSS = DriveApp.getFileById(ID_SPREADSHEET);
    let parentFolder;
    try {
        parentFolder = fileSS.getParents().next();
    } catch (e) {
        parentFolder = DriveApp.getRootFolder();
    }
    const it = parentFolder.getFoldersByName(nombre);
    return it.hasNext() ? it.next() : parentFolder.createFolder(nombre);
}

// ── Wrappers menú estándar ──
function generarPorIdManual()      { mostrarPanelManual(); }
function limpiarColaDisparo()      { limpiarPropiedadesEstado(); }

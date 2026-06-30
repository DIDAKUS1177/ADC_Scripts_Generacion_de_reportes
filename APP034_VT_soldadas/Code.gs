/**
 * ===========================================================================
 * SCRIPT GENERADOR DE REPORTES DE UNIONES SOLDADAS (VT)
 * ===========================================================================
 * CAMBIOS APLICADOS:
 * - Panel selector masivo (HTML) igual al de MT.
 * - procesarUnReporteYGuardar() guarda el link en la BD.
 * - crearReporteUnicaHoja() elimina reportes anteriores del mismo ID.
 * - insertarImagenFlotante() reemplaza newCellImage():
 *     · Imágenes flotantes que conservan tamaño en Excel.
 *     · Centrado dentro del área de la celda (offsetX / offsetY).
 * - MAPEO_CELDAS_GENERAL actualizado:
 *     reporte_n → R8, firma → C51, nombre → C52, cargo → C53,
 *     certificado → C54, fehca → C55.
 * - Nuevos campos: marca_lux D28, modelo K28, serie P28, fehca_calibra V28,
 *   calidad_imagen (imagen flotante en A41), observaciones A43.
 * ===========================================================================
 */

// =================================================================
// --- CONFIGURACIÓN PRINCIPAL ---
// =================================================================

const ID_BD_DATOS               = "1rYzawJni4_zZwYRud6_WQqmsrMYpLKtQydKcavzydUw";
const HOJA_DB_GENERAL           = "2.general_visual_uniones_soldadas";
const HOJA_DB_INSPECCION        = "3.inspeccion_visual_soldaduras";
const HOJA_DB_FOTOS             = "4.fotos_visual_soldaduras";
const NOMBRE_HOJA_FORMATO       = "FORMATO";
const NOMBRE_CARPETA_REPORTES   = "REPORTES_UNIONES_SOLDADAS";

// =================================================================
// --- MAPEO DE CELDAS GENERALES ---
// =================================================================

const MAPEO_CELDAS_GENERAL = {
  'cliente'               : 'C8',
  'contrato'              : 'H8',
  'ot'                    : 'M8',
  'fecha'                 : 'Q8',
  'reporte_n'             : 'R8',
  'zona'                  : 'C10',
  'sistema'               : 'O10',
  'subsistema_linea'      : 'V10',
  'departamento'          : 'C12',
  'municipio'             : 'I12',
  'pk_sistema'            : 'O12',
  'distancia_registro_m'  : 'V12',
  'descripcion_elemento'  : 'F16',
  'acabado_superficial'   : 'R16',
  'material'              : 'D18',
  'espesor'               : 'I18',
  'diametro'              : 'M18',
  'longitud_inspeccionada': 'Q18',
  'plano_referencia'      : 'U18',
  'fluido'                : 'C22',
  'aislamiento_tipo'      : 'H22',
  'estado'                : 'L22',
  'recubrimiento_tipo'    : 'P22',
  'tipo_inspeccion'       : 'U22',
  'temperatura'           : 'C24',
  'presion'               : 'H24',
  'codigo_norma_ref'      : 'M24',
  // Equipo de medición
  'marca_lux'             : 'D28',
  'modelo'                : 'K28',
  'serie'                 : 'P28',
  'fehca_calibra'         : 'V28',
  // Observaciones generales
  'observaciones'         : 'A43',
  // Datos del inspector
  'nombre'                : 'C52',
  'cargo'                 : 'C53',
  'certificado'           : 'C54',
  'fehca'                 : 'C55',
};

// Celdas con imágenes flotantes (manejadas aparte del mapeo general)
const CELDA_CALIDAD_IMAGEN = 'A41';   // link_calidad_imagen → imagen flotante
const CELDA_FIRMA          = 'C51';   // firma_link          → imagen flotante

// =================================================================
// --- MAPEO TABLA DE INSPECCIÓN ---
// =================================================================

const FILA_INICIO_INSPECCION  = 32;
const ALTO_FILA_INSPECCION    = 2;    // cada registro ocupa 2 filas
const CELDA_BUSQUEDA_ID       = 'A7'; // celda de búsqueda en la hoja FORMATO

// Fila 1 de cada registro
const MAPEO_INSPECCION_F1 = {
  'item'                     : 'A',
  'distancia_registro'       : 'B',
  'coordenadas'              : 'D',
  'no_junta'                 : 'G',
  'defecto1_tipo'            : 'H',
  'defecto1_caracterizacion' : 'J',
  'defecto2_tipo'            : 'K',
  'defecto2_caracterizacion' : 'M',
  'defecto3_tipo'            : 'N',
  'defecto3_caracterizacion' : 'P',
  'defecto4_tipo'            : 'Q',
  'defecto4_caracterizacion' : 'S',
  'evaluacion'               : 'T',
  'observaciones'            : 'W',
};

// Fila 2 de cada registro
const MAPEO_INSPECCION_F2 = {
  'defecto1_caracterizacion_2': 'J',
  'defecto2_caracterizacion_2': 'M',
  'defecto3_caracterizacion_2': 'P',
  'defecto4_caracterizacion_2': 'S',
};

// =================================================================
// --- FOTOS ---
// =================================================================

const FILA_INICIO_FOTOS     = 45;   // Ajustar si el formato cambia
const FILA_INICIO_DESC_FOTOS = 46;

// =================================================================
// --- MENÚ ---
// =================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⚙️ Reporte VT Soldaduras')
    .addItem('1. 🚀 Generación masiva (selector)', 'mostrarPanelSelectorMasivo')
    .addItem('2. 📄 Generar por ID informe (manual)', 'generarReporteManual')
    .addSeparator()
    .addItem('3. Probar acceso a BD', 'probarAccesoBaseDeDatos')
    .addToUi();
}

// =================================================================
// --- PANEL HTML SELECTOR MASIVO ---
// =================================================================

function mostrarPanelSelectorMasivo() {
  const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <base target="_top">
      <style>
        body { font-family: 'Segoe UI', sans-serif; padding: 15px; color: #333; }
        h2 { text-align: center; color: #1b5e20; font-size: 18px; margin-top: 0; }
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
        .btn-primary { width: 100%; background: #2e7d32; color: white; border: none; padding: 12px; cursor: pointer; border-radius: 4px; font-size: 14px; font-weight: bold; transition: 0.3s; }
        .btn-primary:hover { background: #1b5e20; }
        .loading { text-align: center; padding: 20px; font-style: italic; color: #666; }
      </style>
    </head>
    <body>
      <h2>🚀 Selector de Reportes VT Soldaduras</h2>
      <div id="selection-area">
        <div class="controls">
          <button onclick="seleccionar(true)">✔ Todos</button>
          <button onclick="seleccionar(false)">✖ Ninguno</button>
          <button onclick="seleccionarPendientes()">⏳ Pendientes</button>
        </div>
        <div id="list-container">
          <div class="loading">Cargando identificadores...</div>
        </div>
        <button class="btn-primary" onclick="iniciarGeneracion()">Generar seleccionados</button>
      </div>
      <div id="status-box">
        <div id="progress-text">0 / 0</div>
        <div id="log"></div>
      </div>
      <button id="btn-close" class="btn-primary" style="display:none;" onclick="google.script.host.close()">Cerrar ventana</button>

      <script>
        let toProcess = [], currentIndex = 0;

        window.onload = function() {
          google.script.run
            .withSuccessHandler(renderList)
            .withFailureHandler(err => alert("Error: " + err.message))
            .obtenerIdsInfo();
        };

        function renderList(data) {
          const container = document.getElementById('list-container');
          if (!data.length) { container.innerHTML = "<div class='loading'>No se encontraron registros.</div>"; return; }
          container.innerHTML = data.map(item => {
            const badgeClass = item.status === 'Pendiente' ? 'bg-pending' : 'bg-done';
            const checked    = item.status === 'Pendiente' ? 'checked' : '';
            return \`<label class="item">
              <input type="checkbox" class="chk-id" value="\${item.id}" \${checked}>
              <span>\${item.id}</span>
              <span class="badge \${badgeClass}">\${item.status}</span>
            </label>\`;
          }).join('');
        }

        function seleccionar(estado) { document.querySelectorAll('.chk-id').forEach(c => c.checked = estado); }
        function seleccionarPendientes() {
          document.querySelectorAll('.chk-id').forEach(c => {
            c.checked = c.parentElement.querySelector('.badge').innerText === 'Pendiente';
          });
        }

        function iniciarGeneracion() {
          toProcess = Array.from(document.querySelectorAll('.chk-id:checked')).map(c => c.value);
          if (!toProcess.length) { alert("Selecciona al menos un ID."); return; }
          document.getElementById('selection-area').style.display = 'none';
          document.getElementById('status-box').style.display = 'block';
          currentIndex = 0;
          actualizarProgreso();
          logMessage("Iniciando " + toProcess.length + " reportes...");
          procesarSiguiente();
        }

        function procesarSiguiente() {
          if (currentIndex >= toProcess.length) {
            document.getElementById('progress-text').innerText = "¡Completado!";
            document.getElementById('btn-close').style.display = 'block';
            logMessage("🎉 Proceso finalizado.");
            google.script.run.mostrarAlertaFinal(toProcess.length);
            return;
          }
          const id = toProcess[currentIndex];
          logMessage("⏳ Procesando: <b>" + id + "</b>...");
          google.script.run
            .withSuccessHandler(url => {
              logMessage("<span style='color:green;'>✅ " + id + " generado.</span>");
              currentIndex++; actualizarProgreso(); procesarSiguiente();
            })
            .withFailureHandler(err => {
              logMessage("<span style='color:red;'>❌ Error en " + id + ": " + err.message + "</span>");
              currentIndex++; actualizarProgreso(); procesarSiguiente();
            })
            .procesarUnReporteYGuardar(id);
        }

        function actualizarProgreso() {
          document.getElementById('progress-text').innerText = currentIndex + " / " + toProcess.length;
        }
        function logMessage(msg) {
          const d = document.getElementById('log');
          d.innerHTML += "<div>" + msg + "</div>";
          d.scrollTop = d.scrollHeight;
        }
      </script>
    </body>
    </html>
  `;
  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(htmlTemplate).setWidth(440).setHeight(560),
    'Generador Masivo VT Soldaduras'
  );
}

function obtenerIdsInfo() {
  const bd    = SpreadsheetApp.openById(ID_BD_DATOS);
  const hoja  = bd.getSheetByName(HOJA_DB_GENERAL);
  const datos = hoja.getDataRange().getValues();
  const enc   = datos[0].map(h => String(h).trim().toLowerCase());
  const iId   = enc.indexOf('id_informe');
  const iLink = enc.indexOf('link_reporte');
  if (iId === -1) throw new Error("No se encontró 'id_informe' en la hoja general.");
  const resultado = [];
  for (let i = 1; i < datos.length; i++) {
    const id   = String(datos[i][iId]).trim();
    const link = iLink !== -1 ? String(datos[i][iLink]).trim() : '';
    if (id) resultado.push({ id, status: link ? 'Generado' : 'Pendiente' });
  }
  return resultado;
}

function mostrarAlertaFinal(cantidad) {
  SpreadsheetApp.getUi().alert('✅ Proceso terminado', `Se procesaron ${cantidad} reportes.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

// =================================================================
// --- EJECUCIÓN MANUAL ---
// =================================================================

function generarReporteManual() {
  const ui   = SpreadsheetApp.getUi();
  const resp = ui.prompt('Generar reporte', 'Ingresa el "id_informe":', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() == ui.Button.CANCEL || !resp.getResponseText().trim()) return;
  const id = resp.getResponseText().trim();
  try {
    SpreadsheetApp.getActiveSpreadsheet().toast(`Generando reporte para: ${id}...`, '⚙️ En progreso', 15);
    const url = procesarUnReporteYGuardar(id);
    ui.alert('✅ Éxito', `Reporte generado.\n🔗 ${url}`, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('❌ Error', e.message, ui.ButtonSet.OK);
  }
}

// =================================================================
// --- ORQUESTADOR PRINCIPAL (con guardado de link) ---
// =================================================================

function procesarUnReporteYGuardar(idBuscado) {
  const url = generarReportePorId(idBuscado);

  // Guardar URL en la columna link_reporte de la BD
  const bd    = SpreadsheetApp.openById(ID_BD_DATOS);
  const hoja  = bd.getSheetByName(HOJA_DB_GENERAL);
  const datos = hoja.getDataRange().getValues();
  const enc   = datos[0].map(h => String(h).trim().toLowerCase());
  const iId   = enc.indexOf('id_informe');
  const iLink = enc.indexOf('link_reporte');
  if (iId !== -1 && iLink !== -1) {
    for (let i = 1; i < datos.length; i++) {
      if (String(datos[i][iId]).trim() === String(idBuscado).trim()) {
        hoja.getRange(i + 1, iLink + 1).setValue(url);
        break;
      }
    }
  }
  return url;
}

// =================================================================
// --- GENERACIÓN DEL REPORTE ---
// =================================================================

function generarReportePorId(idBuscado) {
  const bd = SpreadsheetApp.openById(ID_BD_DATOS);

  // ── 1. Datos generales ──────────────────────────────────────────
  const datGen = obtenerFilaPorId(bd, HOJA_DB_GENERAL, 'id_informe', idBuscado);
  if (!datGen.fila) throw new Error(`No existe el informe "${idBuscado}".`);

  // ── 2. Registros de inspección ──────────────────────────────────
  const hojaInsp = bd.getSheetByName(HOJA_DB_INSPECCION);
  if (!hojaInsp) throw new Error(`No se encontró la hoja "${HOJA_DB_INSPECCION}".`);
  const datosInsp   = hojaInsp.getDataRange().getValues();
  const encInsp     = datosInsp.shift().map(h => String(h).trim());
  const iIdInsp     = encInsp.indexOf('id_informe');
  const iIdRegistro = encInsp.indexOf('id_registro');
  const registros   = datosInsp.filter(r => String(r[iIdInsp]).trim() === String(idBuscado).trim());

  // ── 3. Fotos ────────────────────────────────────────────────────
  const hojaFotos = bd.getSheetByName(HOJA_DB_FOTOS);
  let todasLasFotos = [];
  if (hojaFotos) {
    const datosFotos = hojaFotos.getDataRange().getValues();
    const encFotos   = datosFotos.shift().map(h => String(h).trim());
    const iFotoRegId = encFotos.indexOf('id_registro');
    const iFotoLink  = encFotos.indexOf('link');
    const iFotoDesc  = encFotos.indexOf('descripcion');
    registros.forEach(reg => {
      const idReg = reg[iIdRegistro];
      if (!idReg) return;
      datosFotos
        .filter(f => String(f[iFotoRegId]).trim() == String(idReg).trim())
        .forEach(f => todasLasFotos.push({
          link: f[iFotoLink],
          desc: f[iFotoDesc]
        }));
    });
  }

  // ── 4. Crear archivo (solo hoja FORMATO) ────────────────────────
  const cliente    = datGen.fila[datGen.encabezados.indexOf('cliente')]    || 'SIN_CLIENTE';
  const reporteNum = datGen.fila[datGen.encabezados.indexOf('reporte_n')] || 'SN';
  const nombreReporte = `Reporte VT Soldaduras_${reporteNum}_${idBuscado}`;

  const nuevoSs   = crearReporteUnicaHoja(bd, NOMBRE_HOJA_FORMATO, nombreReporte, idBuscado);
  const hojaDest  = nuevoSs.getSheetByName(NOMBRE_HOJA_FORMATO);

  // ── 5. Llenar tabla de inspección ───────────────────────────────
  registros.forEach((registro, index) => {
    const fila1 = FILA_INICIO_INSPECCION + (index * ALTO_FILA_INSPECCION);
    const fila2 = fila1 + 1;

    // Si no es la primera fila, copiar formato de la fila base
    if (index > 0) {
      const filaBase1 = FILA_INICIO_INSPECCION;
      const filaBase2 = filaBase1 + 1;
      hojaDest.getRange(`${filaBase1}:${filaBase1}`)
              .copyTo(hojaDest.getRange(`${fila1}:${fila1}`), { formatOnly: true });
      hojaDest.getRange(`${filaBase2}:${filaBase2}`)
              .copyTo(hojaDest.getRange(`${fila2}:${fila2}`), { formatOnly: true });
    }

    // Fila 1
    for (const col in MAPEO_INSPECCION_F1) {
      const idx = encInsp.indexOf(col);
      if (idx !== -1) hojaDest.getRange(`${MAPEO_INSPECCION_F1[col]}${fila1}`).setValue(registro[idx]);
    }
    // Fila 2
    for (const col in MAPEO_INSPECCION_F2) {
      const idx = encInsp.indexOf(col);
      if (idx !== -1) hojaDest.getRange(`${MAPEO_INSPECCION_F2[col]}${fila2}`).setValue(registro[idx]);
    }
  });

  const filasInspExtra = Math.max(0, registros.length - 1) * ALTO_FILA_INSPECCION;

  // ── 6. Insertar filas extra de inspección si hace falta ─────────
  if (filasInspExtra > 0) {
    hojaDest.insertRowsAfter(FILA_INICIO_INSPECCION + ALTO_FILA_INSPECCION - 1, filasInspExtra);
  }
  // Re-llenar después de insertar (las filas se mueven)
  if (filasInspExtra > 0) {
    registros.forEach((registro, index) => {
      const fila1 = FILA_INICIO_INSPECCION + (index * ALTO_FILA_INSPECCION);
      const fila2 = fila1 + 1;
      for (const col in MAPEO_INSPECCION_F1) {
        const idx = encInsp.indexOf(col);
        if (idx !== -1) hojaDest.getRange(`${MAPEO_INSPECCION_F1[col]}${fila1}`).setValue(registro[idx]);
      }
      for (const col in MAPEO_INSPECCION_F2) {
        const idx = encInsp.indexOf(col);
        if (idx !== -1) hojaDest.getRange(`${MAPEO_INSPECCION_F2[col]}${fila2}`).setValue(registro[idx]);
      }
    });
  }

  // ── 7. Fotos ────────────────────────────────────────────────────
  const filaFotosReal = FILA_INICIO_FOTOS     + filasInspExtra;
  const filaDescReal  = FILA_INICIO_DESC_FOTOS + filasInspExtra;
  const filasAgregas  = procesarFotos(hojaDest, todasLasFotos, filaFotosReal, filaDescReal);

  // ── 8. Datos generales (ajustando si se agregaron filas) ────────
  const desplazamiento = filasInspExtra + filasAgregas;

  for (const col in MAPEO_CELDAS_GENERAL) {
    const celdaRef = MAPEO_CELDAS_GENERAL[col];
    const idx      = datGen.encabezados.indexOf(col);
    if (idx === -1) continue;
    const celda = ajustarFila(celdaRef, desplazamiento, filaFotosReal);
    hojaDest.getRange(celda).setValue(datGen.fila[idx]);
  }

  // ── 9. Imagen de calidad (A41 → ajustada) ───────────────────────
  const iCalidad = datGen.encabezados.indexOf('link_calidad_imagen');
  if (iCalidad !== -1) {
    const celdaCalidad = ajustarFila(CELDA_CALIDAD_IMAGEN, desplazamiento, filaFotosReal);
    hojaDest.getRange(celdaCalidad).clearContent();
    insertarImagenFlotante(datGen.fila[iCalidad], hojaDest.getRange(celdaCalidad));
  }

  // ── 10. Firma (C51 → ajustada) ──────────────────────────────────
  const iFirma = datGen.encabezados.indexOf('firma_link');
  if (iFirma !== -1) {
    const celdaFirma = ajustarFila(CELDA_FIRMA, desplazamiento, filaFotosReal);
    hojaDest.getRange(celdaFirma).clearContent();
    insertarImagenFlotante(datGen.fila[iFirma], hojaDest.getRange(celdaFirma));
  }

  SpreadsheetApp.flush();
  return nuevoSs.getUrl();
}

// =================================================================
// --- FOTOS (IMÁGENES FLOTANTES, 3 POR FILA) ---
// =================================================================

/**
 * Inserta todas las fotos del informe en grupos de 3 por fila.
 * Crea filas nuevas si hay más de 3 fotos.
 * @returns {number} Número de filas insertadas.
 */
function procesarFotos(hojaDest, fotos, filaInicioFotos, filaInicioDesc) {
  if (!fotos.length) return 0;

  let filasInsertadas    = 0;
  let ultimaFilaDesc     = filaInicioDesc;
  const colsFotos = ['A', 'J', 'R'];   // columnas para las 3 fotos por fila
  const colsDesc  = ['B', 'K', 'S'];   // columnas para las 3 descripciones

  fotos.forEach((foto, index) => {
    const pos = index % 3;   // 0, 1 ó 2

    let filaFoto, filaDesc;

    if (index >= 3 && pos === 0) {
      // Nuevo grupo: insertar 2 filas copiando el formato del primer grupo
      hojaDest.insertRowsAfter(ultimaFilaDesc, 2);
      filasInsertadas += 2;
      filaFoto = ultimaFilaDesc + 1;
      filaDesc = ultimaFilaDesc + 2;

      hojaDest.setRowHeight(filaFoto, hojaDest.getRowHeight(filaInicioFotos));
      hojaDest.setRowHeight(filaDesc, hojaDest.getRowHeight(filaInicioDesc));

      // Copiar solo formato
      hojaDest.getRange(`${filaInicioFotos}:${filaInicioDesc}`)
              .copyTo(hojaDest.getRange(`${filaFoto}:${filaDesc}`), { formatOnly: true });

      // Re-combinar celdas de fotos
      hojaDest.getRange(`A${filaFoto}:I${filaFoto}`).merge();
      hojaDest.getRange(`J${filaFoto}:Q${filaFoto}`).merge();
      hojaDest.getRange(`R${filaFoto}:AB${filaFoto}`).merge();
      hojaDest.getRange(`B${filaDesc}:I${filaDesc}`).merge();
      hojaDest.getRange(`K${filaDesc}:Q${filaDesc}`).merge();
      hojaDest.getRange(`S${filaDesc}:AB${filaDesc}`).merge();

      ultimaFilaDesc = filaDesc;
    } else if (index < 3) {
      filaFoto = filaInicioFotos;
      filaDesc = filaInicioDesc;
    } else {
      filaFoto = ultimaFilaDesc - 1;
      filaDesc = ultimaFilaDesc;
    }

    insertarImagenFlotante(foto.link, hojaDest.getRange(`${colsFotos[pos]}${filaFoto}`));
    hojaDest.getRange(`${colsDesc[pos]}${filaDesc}`).setValue(foto.desc);
  });

  return filasInsertadas;
}

// =================================================================
// --- IMAGEN FLOTANTE CENTRADA ---
// =================================================================

/**
 * Inserta una imagen FLOTANTE anclada en el rango dado y la CENTRA dentro
 * del área de la celda (o celdas combinadas).
 *
 * El centrado se logra dividiendo el espacio sobrante entre 2 y aplicándolo
 * como offset desde la esquina superior izquierda (setAnchorCellXOffset /
 * setAnchorCellYOffset).
 */
function insertarImagenFlotante(url, rango) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    rango.setValue('Sin foto');
    return;
  }

  let finalUrl = url.trim();

  // Convertir URLs de Drive a enlace de descarga directa
  if (finalUrl.includes('drive.google.com')) {
    const idMatch = finalUrl.match(/id=([^&]+)/) || finalUrl.match(/\/d\/([^/]+)/);
    if (idMatch?.[1]) finalUrl = 'https://drive.google.com/uc?export=download&id=' + idMatch[1];
  }

  if (!finalUrl.startsWith('http')) { rango.setValue('No URL'); return; }

  const hoja = rango.getSheet();
  try {
    const resp = UrlFetchApp.fetch(finalUrl, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) { rango.setValue('Error Img'); return; }
    const blob = resp.getBlob();

    // Resolver área real (soporte para celdas combinadas)
    let destino = rango;
    if (rango.isPartOfMerge()) {
      const merges = rango.getMergedRanges();
      if (merges?.length) destino = merges[0];
    }
    const filaInicio = destino.getRow();
    const colInicio  = destino.getColumn();

    // Área total en píxeles
    let anchoArea = 0, altoArea = 0;
    for (let c = 0; c < destino.getNumColumns(); c++) anchoArea += hoja.getColumnWidth(colInicio + c);
    for (let r = 0; r < destino.getNumRows();   r++) altoArea  += hoja.getRowHeight(filaInicio + r);

    // Insertar imagen flotante
    const img = hoja.insertImage(blob, colInicio, filaInicio);

    // Escalar manteniendo proporción (margen de 4 px)
    const margen = 4;
    const escala = Math.min(
      Math.max(anchoArea - margen, 20) / img.getWidth(),
      Math.max(altoArea  - margen, 20) / img.getHeight()
    );
    const anchoFinal = Math.round(img.getWidth()  * escala);
    const altoFinal  = Math.round(img.getHeight() * escala);
    img.setWidth(anchoFinal);
    img.setHeight(altoFinal);

    // ── CENTRADO: repartir el espacio sobrante en partes iguales ──
    const offsetX = Math.max(0, Math.round((anchoArea - anchoFinal) / 2));
    const offsetY = Math.max(0, Math.round((altoArea  - altoFinal)  / 2));
    img.setAnchorCellXOffset(offsetX);
    img.setAnchorCellYOffset(offsetY);

  } catch(e) {
    Logger.log('Error insertando imagen flotante: ' + e.message);
    rango.setValue('Error Img');
  }
}

// =================================================================
// --- UTILIDADES ---
// =================================================================

/**
 * Ajusta el número de fila de una referencia de celda (ej. "C51") si la fila
 * está por debajo de cierto umbral y se han insertado filas extra.
 */
function ajustarFila(ref, filasExtra, umbralFila) {
  if (!filasExtra) return ref;
  const match = ref.match(/([A-Z]+)(\d+)/);
  if (!match) return ref;
  const fila = parseInt(match[2], 10);
  return fila >= umbralFila
    ? `${match[1]}${fila + filasExtra}`
    : ref;
}

/**
 * Obtiene una fila específica de una hoja buscando por valor en una columna.
 */
function obtenerFilaPorId(spreadsheet, nombreHoja, colId, valorId) {
  const hoja = spreadsheet.getSheetByName(nombreHoja);
  if (!hoja) return { fila: null, encabezados: [] };
  const datos = hoja.getDataRange().getValues();
  const enc   = datos.shift().map(h => String(h).trim());
  const idx   = enc.indexOf(colId);
  if (idx === -1) return { fila: null, encabezados: enc };
  const fila  = datos.find(r => String(r[idx]).trim() === String(valorId).trim());
  return { fila: fila || null, encabezados: enc };
}

/**
 * Crea un nuevo Spreadsheet copiando SOLO la hoja de formato.
 * Elimina reportes anteriores del mismo ID en la carpeta de destino.
 */
function crearReporteUnicaHoja(plantillaSs, nombreHojaOrigen, nombreReporte, idBuscado) {
  const hojaOrigen = plantillaSs.getSheetByName(nombreHojaOrigen);
  if (!hojaOrigen) throw new Error(`No se encontró la hoja "${nombreHojaOrigen}".`);

  // Carpeta padre del Spreadsheet de la BD
  let carpetaRaiz;
  try {
    const parents = DriveApp.getFileById(plantillaSs.getId()).getParents();
    carpetaRaiz = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  } catch(e) {
    carpetaRaiz = DriveApp.getRootFolder();
  }

  // Buscar o crear carpeta de destino
  const it = carpetaRaiz.getFoldersByName(NOMBRE_CARPETA_REPORTES);
  const carpetaDest = it.hasNext() ? it.next() : carpetaRaiz.createFolder(NOMBRE_CARPETA_REPORTES);

  // Eliminar reportes anteriores del mismo ID
  const archivos = carpetaDest.getFiles();
  while (archivos.hasNext()) {
    const arch = archivos.next();
    if (arch.getName().includes(idBuscado)) arch.setTrashed(true);
  }

  // Crear nuevo Spreadsheet con solo la hoja formato
  const nuevoSs     = SpreadsheetApp.create(nombreReporte);
  const hojaCopiada = hojaOrigen.copyTo(nuevoSs);
  hojaCopiada.setName(nombreHojaOrigen);
  const hojas = nuevoSs.getSheets();
  if (hojas[0].getName() !== nombreHojaOrigen) nuevoSs.deleteSheet(hojas[0]);

  DriveApp.getFileById(nuevoSs.getId()).moveTo(carpetaDest);
  return nuevoSs;
}

/**
 * Prueba de acceso a la base de datos.
 */
function probarAccesoBaseDeDatos() {
  const ui = SpreadsheetApp.getUi();
  try {
    const bd = SpreadsheetApp.openById(ID_BD_DATOS);
    const hojas = bd.getSheets().map(h => h.getName()).join(', ');
    ui.alert('✅ Acceso exitoso', `Libro: "${bd.getName()}"\nHojas: ${hojas}`, ui.ButtonSet.OK);
  } catch(e) {
    ui.alert('❌ Error de acceso', e.message, ui.ButtonSet.OK);
  }
}

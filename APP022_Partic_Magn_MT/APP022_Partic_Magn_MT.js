/**
 * ===========================================================================
 * SCRIPT GENERADOR DE REPORTES MT (PARTÍCULAS MAGNÉTICAS)
 * ===========================================================================
 * CORRECCIÓN APLICADA:
 * - insertarImagenFlotante() reemplaza newCellImage() / =IMAGE()
 *   → imágenes flotantes (insertImage) que conservan tamaño real al
 *     descargar el Excel y abrirlo en el PC. Se escalan al área de la celda,
 *     con soporte para celdas combinadas.
 * ===========================================================================
 */

// =================================================================
// --- CONFIGURACIÓN PRINCIPAL ---
// =================================================================

const ID_BD_DATOS_MT = "1J3FcVxay3dNQMG9SnOwfTccezzuBlaL-PPSiEq7Icy8";

const HOJA_DB_GENERAL_MT = "2.general_particulas_magneticas";
const HOJA_DB_RESULTADOS_MT = "3.resultados_inspeccion";
const HOJA_DB_INDICACIONES_MT = "5.indicaciones";
const HOJA_DB_FOTOS_MT = "4.reg_fotografico";
const HOJA_DB_CALIDAD_MT = "4.2.reg_calidad";
const NOMBRE_HOJA_FORMATO_MT = "FORMATO_MT";
const NOMBRE_CARPETA_MT = "REPORTES_PARTICULAS_MAGNETICAS_GENERADOS";

// =================================================================
// --- MAPEO DE CELDAS ---
// =================================================================

const MAPEO_CELDAS_GENERAL_MT = {
    'cliente': 'C7',
    'contrato': 'H7',
    'ot': 'K7',
    'fecha_actividad': 'N7',
    'reporte_n': 'R7',
    'zona': 'C9',
    'sistema': 'I9',
    'subsistema_linea': 'O9',
    'departamento': 'C11',
    'municipio': 'I11',
    'pk_sistema': 'O11',
    'distancia_registro': 'S11',
    'descripcion_elemento': 'F15',
    'acabado_superficial': 'R15',
    'material': 'D17',
    'espesor': 'J17',
    'diametro': 'N17',
    'cantidad_inspeccionada': 'S17',
    'plano_referencia': 'D19',
    'procedimiento_n': 'E23',
    'revision': 'K23',
    'norma_codigo_ref': 'Q23',
    'tecnica_magnetizacion': 'E25',
    'fuerza_campo': 'L25',
    'direccion_campo': 'S25',
    'tecnica_desmagnetizacion': 'F27',
    'tipo_particulas': 'D31',
    'metodo_aplicacion': 'K31',
    'color_particulas': 'O31',
    'tipo_luz_negra': 'T31',
    'marca_equipo': 'E33',
    'codigo_equipo': 'P33',
    'marca_particulas': 'E35',
    'codigo_particulas': 'R35',
    'intensidad_luz_blanca': 'E37',
    'intensidad_luz_negra': 'R37',
    'tipo_corriente': 'E39',
    'equipo_medicion_luz': 'K39',
    'equipo_luz_sn': 'R39',
    'observaciones': 'D52',
    'nombre': 'D54',
    'certificado': 'D55',
    'fecha': 'D57'
};

const MAPEO_FIRMA_MT = 'D56';
const FILA_INICIO_INSPECCION_MT = 44;
const FILA_BASE_FOTOS_MT = 49;
const FILA_BASE_DESC_FOTOS_MT = 50;

// =================================================================
// --- MENÚ ---
// =================================================================

function onOpen() {
    SpreadsheetApp.getUi()
        .createMenu('⚙️ Reportes MT')
        .addItem('1. 🚀 Generación masiva (selector)', 'mostrarPanelSelectorMasivo_MT')
        .addItem('2. 📄 Generar por ID informe (manual)', 'generarReporteManual_MT')
        .addToUi();
}

// =================================================================
// --- PANEL HTML SELECTOR MASIVO ---
// =================================================================

function mostrarPanelSelectorMasivo_MT() {
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
      <h2>🚀 Selector de Reportes MT</h2>
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
            .obtenerIdsInfo_MT();
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
            google.script.run.mostrarAlertaFinal_MT(toProcess.length);
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
            .procesarUnReporteYGuardar_MT(id);
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
        HtmlService.createHtmlOutput(htmlTemplate).setWidth(420).setHeight(550),
        'Generador de Reportes MT'
    );
}

function obtenerIdsInfo_MT() {
    const hoja = SpreadsheetApp.openById(ID_BD_DATOS_MT).getSheetByName(HOJA_DB_GENERAL_MT);
    const datos = hoja.getDataRange().getValues();
    const enc = datos[0].map(h => String(h).trim().toLowerCase());
    const iId = enc.indexOf('id_informe');
    const iLink = enc.indexOf('link_reporte');
    if (iId === -1) throw new Error("No se encontró 'id_informe' en la hoja general.");
    const resultado = [];
    for (let i = 1; i < datos.length; i++) {
        const id = String(datos[i][iId]).trim();
        const link = iLink !== -1 ? String(datos[i][iLink]).trim() : "";
        if (id) resultado.push({ id, status: link ? "Generado" : "Pendiente" });
    }
    return resultado;
}

function mostrarAlertaFinal_MT(cantidad) {
    SpreadsheetApp.getUi().alert("✅ Proceso terminado", `Se procesaron ${cantidad} reportes.`, SpreadsheetApp.getUi().ButtonSet.OK);
}

// =================================================================
// --- LÓGICA DE EJECUCIÓN ---
// =================================================================

function generarReporteManual_MT() {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.prompt('Generar reporte', 'Ingresa el "id_informe":', ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() == ui.Button.CANCEL || !resp.getResponseText().trim()) return;
    const id = resp.getResponseText().trim();
    try {
        SpreadsheetApp.getActiveSpreadsheet().toast(`Generando reporte para ID: ${id}...`, "⚙️ En progreso", 10);
        const url = procesarUnReporteYGuardar_MT(id);
        ui.alert('✅ Éxito', `Reporte generado.\n🔗 Enlace: ${url}`, ui.ButtonSet.OK);
    } catch (e) {
        ui.alert('❌ Error', e.message, ui.ButtonSet.OK);
    }
}

function procesarUnReporteYGuardar_MT(idBuscado) {
    const url = generarReportePorId_MT(idBuscado);

    // Guardar el link en la BD
    const hoja = SpreadsheetApp.openById(ID_BD_DATOS_MT).getSheetByName(HOJA_DB_GENERAL_MT);
    const datos = hoja.getDataRange().getValues();
    const enc = datos[0].map(h => String(h).trim().toLowerCase());
    const iId = enc.indexOf('id_informe');
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

function generarReportePorId_MT(idBuscado) {
    const bd = SpreadsheetApp.openById(ID_BD_DATOS_MT);

    // ── 1. Datos generales ──────────────────────────────────────────
    const datGen = obtenerFilaPorId_MT(bd, HOJA_DB_GENERAL_MT, 'id_informe', idBuscado);
    if (!datGen.fila) throw new Error(`No existe el informe "${idBuscado}".`);

    // ── 2. Resultados de inspección (ordenados por item) ────────────
    const datRes = obtenerFilasRelacionadas_MT(bd, HOJA_DB_RESULTADOS_MT, 'id_informe_fk', idBuscado);
    const headRes = datRes.encabezados;
    const iResItem = headRes.indexOf('item');
    const iResId = headRes.indexOf('id_resultado');

    const resultadosFiltrados = datRes.filas.slice().sort((a, b) => {
        return (parseFloat(a[iResItem]) || 0) - (parseFloat(b[iResItem]) || 0);
    });

    // ── 3. Indicaciones ─────────────────────────────────────────────
    const datInd = obtenerFilasRelacionadas_MT(bd, HOJA_DB_INDICACIONES_MT, 'id_informe', idBuscado);
    const todasInd = datInd.filas.map(ind => ({
        id_resultado: ind[datInd.encabezados.indexOf('id_resultado')],
        tipo: ind[datInd.encabezados.indexOf('tipo')],
        long: ind[datInd.encabezados.indexOf('long')]
    }));

    // Construir filas combinadas resultado + indicaciones
    const filasAImprimir = [];
    resultadosFiltrados.forEach(res => {
        const idRes = res[iResId];
        const indsDelItem = todasInd.filter(i => i.id_resultado == idRes);
        const bloques = chunkArray_MT(indsDelItem, 3);
        if (!bloques.length) bloques.push([]);

        bloques.forEach((bloque, idx) => {
            const fila = { esPrincipal: idx === 0 };
            if (fila.esPrincipal) {
                fila.item = res[iResItem];
                fila.identificacion = res[headRes.indexOf('identificacion')];
                fila.zona = res[headRes.indexOf('zona_insp_distancia')];
                fila.diam = res[headRes.indexOf('diam_long')];
                fila.evaluacion = res[headRes.indexOf('evaluacion')];
                fila.observaciones = res[headRes.indexOf('observaciones')];
            } else {
                fila.item = "";
            }
            fila.ind1_tipo = bloque[0]?.tipo || ""; fila.ind1_long = bloque[0]?.long || "";
            fila.ind2_tipo = bloque[1]?.tipo || ""; fila.ind2_long = bloque[1]?.long || "";
            fila.ind3_tipo = bloque[2]?.tipo || ""; fila.ind3_long = bloque[2]?.long || "";
            filasAImprimir.push(fila);
        });
    });

    // ── 4. Fotos ────────────────────────────────────────────────────
    // A) Fotos de calidad
    const datCal = obtenerFilasRelacionadas_MT(bd, HOJA_DB_CALIDAD_MT, 'id_general', idBuscado);
    const fotosCal = datCal.filas.map(f => ({
        link: f[datCal.encabezados.indexOf('link')],
        imagen: f[datCal.encabezados.indexOf('imagen')],
        desc: f[datCal.encabezados.indexOf('descripcion')]
    })).sort((a, b) => {
        const numA = parseInt(String(a.desc).match(/^\d+/)?.[0] || "999", 10);
        const numB = parseInt(String(b.desc).match(/^\d+/)?.[0] || "999", 10);
        return numA - numB;
    });

    const fotosCombinadas = [...fotosCal];

    // B) Fotos de resultados (4.reg_fotografico)
    const hojaFotos = bd.getSheetByName(HOJA_DB_FOTOS_MT);
    if (hojaFotos) {
        const dFotos = hojaFotos.getDataRange().getValues();
        const headF = dFotos.shift();
        const iFResFk = headF.indexOf('id_resultado_fk');
        const iFLink = headF.indexOf('link');
        const iFImg = headF.indexOf('imagen');
        const iFDesc = headF.indexOf('descripcion');
        resultadosFiltrados.forEach(res => {
            dFotos
                .filter(row => row[iFResFk] == res[iResId])
                .forEach(f => fotosCombinadas.push({
                    link: f[iFLink],
                    imagen: f[iFImg],
                    desc: f[iFDesc]
                }));
        });
    }

    // ── 5. Crear archivo ────────────────────────────────────────────
    const reporteNum = datGen.fila[datGen.encabezados.indexOf('reporte_n')] || 'SN';
    const nombreReporte = `Reporte MT_${reporteNum}_${idBuscado}`;

    const plantillaSs = SpreadsheetApp.openById(ID_BD_DATOS_MT);
    const nuevoSs = crearReporteUnicaHoja_MT(plantillaSs, NOMBRE_HOJA_FORMATO_MT, nombreReporte, idBuscado);
    const hojaDest = nuevoSs.getSheetByName(NOMBRE_HOJA_FORMATO_MT);

    // Insertar filas extra en la tabla de resultados
    const filasExtra = Math.max(0, filasAImprimir.length - 1);
    if (filasExtra > 0) hojaDest.insertRowsAfter(FILA_INICIO_INSPECCION_MT, filasExtra);

    // Llenar datos generales
    for (const col in MAPEO_CELDAS_GENERAL_MT) {
        const celda = calcularNuevaPosicion_MT(MAPEO_CELDAS_GENERAL_MT[col], filasExtra);
        const indice = datGen.encabezados.indexOf(col);
        if (indice !== -1) hojaDest.getRange(celda).setValue(datGen.fila[indice]);
    }

    // Insertar firma (imagen flotante)
    const iFirma = datGen.encabezados.indexOf('firma_link');
    if (iFirma !== -1) {
        const rangoFirma = hojaDest.getRange(calcularNuevaPosicion_MT(MAPEO_FIRMA_MT, filasExtra));
        rangoFirma.clearContent();
        insertarImagenFlotante_MT(datGen.fila[iFirma], rangoFirma);
    }

    // Llenar tabla de resultados
    filasAImprimir.forEach((d, index) => {
        const filaActual = FILA_INICIO_INSPECCION_MT + index;
        if (index > 0) {
            hojaDest.getRange(`${FILA_INICIO_INSPECCION_MT}:${FILA_INICIO_INSPECCION_MT}`)
                .copyTo(hojaDest.getRange(`${filaActual}:${filaActual}`), { formatOnly: true });
        }
        if (d.esPrincipal) {
            hojaDest.getRange(`A${filaActual}`).setValue(d.item);
            hojaDest.getRange(`B${filaActual}`).setValue(d.identificacion);
            hojaDest.getRange(`E${filaActual}`).setValue(d.zona);
            hojaDest.getRange(`G${filaActual}`).setValue(d.diam);
            hojaDest.getRange(`O${filaActual}`).setValue(d.evaluacion);
            hojaDest.getRange(`Q${filaActual}`).setValue(d.observaciones);
        }
        hojaDest.getRange(`I${filaActual}`).setValue(d.ind1_tipo); hojaDest.getRange(`J${filaActual}`).setValue(d.ind1_long);
        hojaDest.getRange(`K${filaActual}`).setValue(d.ind2_tipo); hojaDest.getRange(`L${filaActual}`).setValue(d.ind2_long);
        hojaDest.getRange(`M${filaActual}`).setValue(d.ind3_tipo); hojaDest.getRange(`N${filaActual}`).setValue(d.ind3_long);
    });

    // Insertar fotos (imágenes flotantes)
    const filaInicioFotos = FILA_BASE_FOTOS_MT + filasExtra;
    const filaInicioDesc = FILA_BASE_DESC_FOTOS_MT + filasExtra;
    procesarFotosCombinadas_MT(hojaDest, fotosCombinadas, filaInicioFotos, filaInicioDesc);

    SpreadsheetApp.flush();
    return nuevoSs.getUrl();
}

// =================================================================
// --- FOTOS (IMÁGENES FLOTANTES) ---
// =================================================================

function procesarFotosCombinadas_MT(hojaDest, fotos, filaInicioFotos, filaInicioDesc) {
    if (!fotos.length) return;

    let ultimaFilaDesc = filaInicioDesc;
    const filaBaseFotos = filaInicioFotos;
    const filaBaseDesc = filaInicioDesc;

    fotos.forEach((fotoData, index) => {
        // Resolver URL (link tiene prioridad sobre imagen)
        let url = fotoData.link ? String(fotoData.link).trim() : '';
        if (!url && fotoData.imagen) url = String(fotoData.imagen).trim();

        const desc = fotoData.desc;
        const esPar = index % 2 === 0;  // columna izquierda
        let filaFoto, filaDesc;

        if (index > 1 && esPar) {
            // Nuevo par de filas: insertar y copiar formato
            hojaDest.insertRowsAfter(ultimaFilaDesc, 2);
            filaFoto = ultimaFilaDesc + 1;
            filaDesc = ultimaFilaDesc + 2;

            hojaDest.getRange(`${filaBaseFotos}:${filaBaseDesc}`)
                .copyTo(hojaDest.getRange(`${filaFoto}:${filaDesc}`));

            // Limpieza quirúrgica: solo las celdas que vamos a rellenar
            hojaDest.getRange(`A${filaFoto}`).clearContent();
            hojaDest.getRange(`B${filaDesc}`).clearContent();
            hojaDest.getRange(`L${filaFoto}`).clearContent();
            hojaDest.getRange(`M${filaDesc}`).clearContent();

            hojaDest.setRowHeight(filaFoto, hojaDest.getRowHeight(filaBaseFotos));
            hojaDest.setRowHeight(filaDesc, hojaDest.getRowHeight(filaBaseDesc));

            ultimaFilaDesc = filaDesc;
        } else if (index <= 1) {
            filaFoto = filaBaseFotos;
            filaDesc = filaBaseDesc;
        } else {
            filaFoto = ultimaFilaDesc - 1;
            filaDesc = ultimaFilaDesc;
        }

        // Insertar imagen flotante y descripción
        if (esPar) {
            insertarImagenFlotante_MT(url, hojaDest.getRange(`A${filaFoto}`));
            hojaDest.getRange(`B${filaDesc}`).setValue(desc);
        } else {
            insertarImagenFlotante_MT(url, hojaDest.getRange(`L${filaFoto}`));
            hojaDest.getRange(`M${filaDesc}`).setValue(desc);
        }
    });
}

// =================================================================
// --- CORRECCIÓN IMÁGENES: FLOTANTES EN VEZ DE CELDA INCRUSTADA ---
// =================================================================

/**
 * Inserta una imagen FLOTANTE anclada en la celda dada.
 * A diferencia de newCellImage(), las imágenes flotantes conservan
 * su tamaño real al descargar el archivo como .xlsx y abrirlo en Excel.
 * Se escalan para llenar el área del rango (soporte para celdas combinadas).
 */
function insertarImagenFlotante_MT(url, rango) {
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
        // Descargar imagen como blob
        const resp = UrlFetchApp.fetch(finalUrl, { muteHttpExceptions: true, followRedirects: true });
        if (resp.getResponseCode() !== 200) { rango.setValue('Error Img'); return; }
        const blob = resp.getBlob();

        // Resolver rango real (soporta celdas combinadas)
        let destino = rango;
        if (rango.isPartOfMerge()) {
            const merges = rango.getMergedRanges();
            if (merges?.length) destino = merges[0];
        }
        const filaInicio = destino.getRow();
        const colInicio = destino.getColumn();

        // Calcular área total del rango en píxeles
        let anchoArea = 0, altoArea = 0;
        for (let c = 0; c < destino.getNumColumns(); c++) anchoArea += hoja.getColumnWidth(colInicio + c);
        for (let r = 0; r < destino.getNumRows(); r++) altoArea += hoja.getRowHeight(filaInicio + r);

        // Insertar imagen flotante anclada en la celda
        const img = hoja.insertImage(blob, colInicio, filaInicio);

        // Escalar manteniendo proporción para llenar el área (margen de 4px)
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

// =================================================================
// --- UTILIDADES ---
// =================================================================

function chunkArray_MT(array, size) {
    const result = [];
    for (let i = 0; i < array.length; i += size) result.push(array.slice(i, i + size));
    return result;
}

function calcularNuevaPosicion_MT(ref, filasExtra) {
    if (!filasExtra) return ref;
    const match = ref.match(/([A-Z]+)(\d+)/);
    if (!match) return ref;
    const fila = parseInt(match[2], 10);
    return fila > FILA_INICIO_INSPECCION_MT ? `${match[1]}${fila + filasExtra}` : ref;
}

function obtenerFilaPorId_MT(spreadsheet, nombreHoja, colId, valorId) {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) return { fila: null, encabezados: [] };
    const datos = hoja.getDataRange().getValues();
    const enc = datos.shift();
    const idx = enc.indexOf(colId);
    if (idx === -1) return { fila: null, encabezados: enc };
    const fila = datos.find(r => String(r[idx]).trim() === String(valorId).trim());
    return { fila: fila || null, encabezados: enc };
}

function obtenerFilasRelacionadas_MT(spreadsheet, nombreHoja, colId, valorId) {
    const hoja = spreadsheet.getSheetByName(nombreHoja);
    if (!hoja) return { filas: [], encabezados: [] };
    const datos = hoja.getDataRange().getValues();
    const enc = datos.shift();
    const idx = enc.indexOf(colId);
    if (idx === -1) return { filas: [], encabezados: enc };
    const filas = datos.filter(r => String(r[idx]).trim() === String(valorId).trim());
    return { filas, encabezados: enc };
}

function crearReporteUnicaHoja_MT(plantillaSs, nombreHojaOrigen, nombreReporte, idBuscado) {
    const hojaOrigen = plantillaSs.getSheetByName(nombreHojaOrigen);
    if (!hojaOrigen) return null;

    // Obtener carpeta padre del Spreadsheet
    let carpetaRaiz;
    try {
        const parents = DriveApp.getFileById(plantillaSs.getId()).getParents();
        carpetaRaiz = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
    } catch (e) {
        carpetaRaiz = DriveApp.getRootFolder();
    }

    // Buscar o crear carpeta de destino
    const it = carpetaRaiz.getFoldersByName(NOMBRE_CARPETA_MT);
    const carpetaDest = it.hasNext() ? it.next() : carpetaRaiz.createFolder(NOMBRE_CARPETA_MT);

    // Borrar reportes anteriores del mismo ID
    const archivos = carpetaDest.getFiles();
    while (archivos.hasNext()) {
        const arch = archivos.next();
        if (arch.getName().includes(idBuscado)) arch.setTrashed(true);
    }

    // Crear nuevo Spreadsheet desde la plantilla
    const nuevoSs = SpreadsheetApp.create(nombreReporte);
    const hojaCopiada = hojaOrigen.copyTo(nuevoSs);
    hojaCopiada.setName(nombreHojaOrigen);

    // Eliminar hoja vacía inicial si existe
    const hojas = nuevoSs.getSheets();
    if (hojas[0].getName() !== nombreHojaOrigen) nuevoSs.deleteSheet(hojas[0]);

    // Mover a la carpeta correcta
    DriveApp.getFileById(nuevoSs.getId()).moveTo(carpetaDest);
    return nuevoSs;
}

// =================================================================
// --- ALIAS COMPATIBILIDAD (nombres anteriores) ---
// =================================================================
// Si hay triggers o referencias antiguas apuntando a nombres sin sufijo _MT,
// estas funciones los redirigen sin romper nada.
function generarReporteManual() { generarReporteManual_MT(); }
function mostrarPanelSelectorMasivo() { mostrarPanelSelectorMasivo_MT(); }
function procesarUnReporteYGuardar(id) { return procesarUnReporteYGuardar_MT(id); }
function obtenerTodosLosIdsInfo() { return obtenerIdsInfo_MT(); }
function mostrarAlertaFinal(cantidad) { mostrarAlertaFinal_MT(cantidad); }
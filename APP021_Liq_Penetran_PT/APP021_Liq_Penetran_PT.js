/**
 * =================================================================
 * GESTOR WEB DE TINTES PENETRANTES (BACKEND - VERSIÓN FINAL)
 * =================================================================
 */

// --- CONFIGURACIÓN PRINCIPAL ---
const ID_SPREADSHEET = "16Q72oPqz5o8S_IvgvYIPUB5ZNqJC8l5uM0BBmwvhJuw"; // ID de tu Hoja
const NOMBRE_CARPETA_REPORTES = "REPORTES_TINTES_PENETRANTES";

const HOJA_GENERAL = "1_general";
const HOJA_RESULTADOS = "2_resultados";
const HOJA_IMAGENES = "3_imagenes";
const HOJA_FORMATO = "FORMATO_TINTES_PENETRANTES";

// --- MAPEO DE DATOS ---
const MAPEO_GENERAL = {
    'cliente': 'C7', 'contrato': 'O7', 'fecha_reporte': 'W7', 'ot_os_oc': 'AC7',
    'reporte_n': 'C9', 'troncal': 'O9', 'estacion': 'Y9', 'sistema': 'C11',
    'tag_pk_dr': 'O11', 'capacidad': 'Y11', 'descripcion_equipo': 'E15',
    'zona_inspeccionada': 'E17', 'dimensiones': 'Y17', 'n_parte': 'E19',
    'proceso_fabricacion': 'O19', 'plano_referencias': 'Y19', 'acabado_superficial': 'E21',
    'material': 'O21', 'n_de_serie_equipo': 'Y21', 'tipo_liquido_penetrante': 'E25',
    'metodo_remocion_exceso': 'O25', 'metodo_app_liq_penetrante': 'AA25',
    'tipo_revelador': 'G27', 'metodo_app_revelador': 'W27', 'norma_codigo_aceptacion': 'G29',
    'norma_codigo_referencia': 'W29', 'procedimiento_inspeccion': 'I31', 'revision': 'W31',
    'tiempo_penetracion': 'G35', 'tiempo_revelado': 'W35', 'intensidad_luz_visible': 'G37',
    'temperatura_superficial': 'U37',

    // Equipos e Insumos
    'lampara_uv_marca': 'G41', 'lampara_uv_serie': 'Q41', 'lampara_uv_calibracion': 'AA41',
    'luxometro_marca': 'G43', 'luxometro_serie': 'Q43', 'luxometro_calibracion': 'AA43',
    'termometro_marca': 'G45', 'termometro_serie': 'Q45', 'termometro_calibracion': 'AA45',
    'penetrante_marca': 'G47', 'penetrante_lote': 'Q47', 'penetrante_vencimiento': 'AA47',
    'emulsificante_marca': 'G49', 'emulsificante_lote': 'Q49', 'emulsificante_vencimiento': 'AA49',
    'limpiador_marca': 'G51', 'limpiador_lote': 'Q51', 'limpiador_vencimiento': 'AA51',
    'revelador_marca': 'G53', 'revelador_lote': 'Q53', 'revelador_vencimiento': 'AA53',

    // Firma
    'nombre': 'C71', 'cargo': 'C72', 'fecha': 'C74'
};

const FILA_INICIO_RESULTADOS = 59;
const COLUMNAS_RESULTADOS = { 'identificacion': 'A', 'tipo_indicacion': 'C', 'inicio_indicacion_mm': 'I', 'fin_indicacion_mm': 'M', 'longitud_mm': 'Q', 'longitud_pulg': 'S', 'evaluacion': 'U', 'observaciones': 'X' };
const FILA_INICIO_IMAGENES = 67;
const COLUMNAS_FOTOS = ['A', 'M', 'W'];

// =================================================================
// --- SERVIDOR WEB ---
// =================================================================

function doGet() {
    return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('Gestor Reportes PT')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// =================================================================
// --- API PARA EL FRONTEND ---
// =================================================================

function obtenerDatosFront() {
    const ss = SpreadsheetApp.openById(ID_SPREADSHEET);
    const sheet = ss.getSheetByName(HOJA_GENERAL);
    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Quitar encabezados

    // Mapear indices de columnas requeridas
    const idxId = headers.indexOf('id_general');
    const idxCliente = headers.indexOf('cliente');
    const idxContrato = headers.indexOf('contrato');
    const idxFecha = headers.indexOf('fecha_reporte');
    const idxSistema = headers.indexOf('sistema');
    const idxReporte = headers.indexOf('reporte_n');

    // Listar archivos ya generados para mostrar estado
    const reportesGenerados = listarReportesExistentes();

    // Construir objeto para la tabla HTML
    return data.map(row => {
        const id = row[idxId];
        if (!id) return null;

        const numReporte = idxReporte !== -1 ? row[idxReporte] : 'S/N';
        // Buscamos si existe un archivo asociado al ID
        const archivoExistente = reportesGenerados[id];

        return {
            id_general: id,
            cliente: idxCliente !== -1 ? row[idxCliente] : '',
            contrato: idxContrato !== -1 ? row[idxContrato] : '',
            fecha: idxFecha !== -1 ? Utilities.formatDate(new Date(row[idxFecha]), Session.getScriptTimeZone(), "dd/MM/yyyy") : '',
            sistema: idxSistema !== -1 ? row[idxSistema] : '',
            reporte_n: numReporte,
            urlReporte: archivoExistente ? archivoExistente.url : null,
            nombreArchivo: archivoExistente ? archivoExistente.nombre : null
        };
    }).filter(item => item !== null);
}

function generarReporteWeb(idBuscado) {
    try {
        const ss = SpreadsheetApp.openById(ID_SPREADSHEET);

        // 1. Obtener Datos
        const datosGeneral = obtenerFilaPorId(ss, HOJA_GENERAL, 'id_general', idBuscado);
        if (!datosGeneral) throw new Error(`ID "${idBuscado}" no encontrado.`);

        const datosResultados = obtenerFilasRelacionadas(ss, HOJA_RESULTADOS, 'id_general', idBuscado);
        const datosImagenes = obtenerFilasRelacionadas(ss, HOJA_IMAGENES, 'id_general', idBuscado);

        // 2. Definir Nombre del Archivo
        // Formato solicitado: Reportes PT_(CLIENTE)_CONTRATO_(id_general)_FECHA
        const cliente = datosGeneral['cliente'] || 'SIN_CLIENTE';
        const contrato = datosGeneral['contrato'] || 'SIN_CONTRATO';
        const fechaGen = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");

        // Limpiamos caracteres ilegales para nombre de archivo
        const cleanStr = (s) => String(s).replace(/[^a-zA-Z0-9-_ ]/g, '');
        const nombreArchivo = `Reportes PT_${cleanStr(cliente)}_${cleanStr(contrato)}_${idBuscado}_${fechaGen}`;

        // 3. Crear Copia
        const copiaSS = crearCopiaPlantilla(ss, nombreArchivo);
        const hojaDestino = copiaSS.getSheetByName(HOJA_FORMATO);
        if (!hojaDestino) throw new Error(`Hoja "${HOJA_FORMATO}" no encontrada.`);

        // 4. Llenado
        let filasAgregadas = 0;

        // Resultados
        const nResultados = datosResultados.length;
        if (nResultados > 1) {
            hojaDestino.insertRowsAfter(FILA_INICIO_RESULTADOS, nResultados - 1);
            hojaDestino.getRange(FILA_INICIO_RESULTADOS, 1, 1, hojaDestino.getMaxColumns())
                .copyTo(hojaDestino.getRange(FILA_INICIO_RESULTADOS + 1, 1, nResultados - 1, hojaDestino.getMaxColumns()), { formatOnly: true });
            filasAgregadas += (nResultados - 1);
        }

        datosResultados.forEach((d, i) => {
            const fila = FILA_INICIO_RESULTADOS + i;
            for (const k in COLUMNAS_RESULTADOS) {
                if (d[k]) hojaDestino.getRange(`${COLUMNAS_RESULTADOS[k]}${fila}`).setValue(d[k]);
            }
        });

        // Datos Generales
        for (const campo in MAPEO_GENERAL) {
            const celda = ajustarCelda(MAPEO_GENERAL[campo], filasAgregadas, FILA_INICIO_RESULTADOS);
            if (datosGeneral[campo]) {
                let val = datosGeneral[campo];
                if (val instanceof Date) val = Utilities.formatDate(val, Session.getScriptTimeZone(), "dd/MM/yyyy");
                hojaDestino.getRange(celda).setValue(val);
            }
        }

        // Esquema
        if (datosGeneral['link_esquema']) {
            insertarImagenEnCelda(datosGeneral['link_esquema'], hojaDestino.getRange(ajustarCelda('A64', filasAgregadas, FILA_INICIO_RESULTADOS)));
        }

        // Imágenes
        const filaFotos = FILA_INICIO_IMAGENES + filasAgregadas;
        const bloques = chunkArray(datosImagenes, 3);

        if (bloques.length > 1) {
            const filasExtra = (bloques.length - 1) * 2;
            hojaDestino.insertRowsAfter(filaFotos + 1, filasExtra);
            const rBase = hojaDestino.getRange(filaFotos, 1, 2, hojaDestino.getMaxColumns());
            for (let i = 1; i < bloques.length; i++) {
                const fDest = filaFotos + (i * 2);
                rBase.copyTo(hojaDestino.getRange(fDest, 1), { formatOnly: true });
                hojaDestino.setRowHeight(fDest, hojaDestino.getRowHeight(filaFotos));
                hojaDestino.setRowHeight(fDest + 1, hojaDestino.getRowHeight(filaFotos + 1));
            }
        }

        bloques.forEach((bloque, ib) => {
            const f = filaFotos + (ib * 2);
            bloque.forEach((img, ii) => {
                const col = COLUMNAS_FOTOS[ii];
                if (img['link_imagen']) insertarImagenEnCelda(img['link_imagen'], hojaDestino.getRange(`${col}${f}`));
                if (img['descripccion']) hojaDestino.getRange(`${col}${f + 1}`).setValue(img['descripccion']);
            });
        });

        // Firma
        if (datosGeneral['link_firma']) {
            insertarImagenEnCelda(datosGeneral['link_firma'], hojaDestino.getRange(ajustarCelda('C70', filasAgregadas, FILA_INICIO_RESULTADOS)));
        }

        // 5. Finalizar
        SpreadsheetApp.flush();
        const hojas = copiaSS.getSheets();
        hojas.forEach(h => { if (h.getName() !== HOJA_FORMATO) copiaSS.deleteSheet(h); });

        const urlExport = `https://docs.google.com/spreadsheets/d/${copiaSS.getId()}/export?format=xlsx`;
        const blob = UrlFetchApp.fetch(urlExport, {
            headers: { "Authorization": "Bearer " + ScriptApp.getOAuthToken() },
            muteHttpExceptions: true
        }).getBlob().setName(nombreArchivo + ".xlsx");

        const carpeta = obtenerOCrearCarpeta(NOMBRE_CARPETA_REPORTES);
        const archivoFinal = carpeta.createFile(blob);
        DriveApp.getFileById(copiaSS.getId()).setTrashed(true);

        return { success: true, url: archivoFinal.getUrl(), nombre: nombreArchivo };

    } catch (e) {
        return { success: false, error: e.message };
    }
}

// --- UTILIDADES ---

function listarReportesExistentes() {
    const map = {};
    const folders = DriveApp.getFoldersByName(NOMBRE_CARPETA_REPORTES);
    if (folders.hasNext()) {
        const files = folders.next().getFiles();
        while (files.hasNext()) {
            const f = files.next();
            const name = f.getName();
            // Buscamos el ID en el nombre del archivo usando Regex.
            // Asumimos que el ID está rodeado por guiones bajos, ejemplo: ..._1234_...
            // O que es un número de varios dígitos
            const matches = name.match(/_(\d+)_/);

            if (matches && matches[1]) {
                map[matches[1]] = { url: f.getUrl(), nombre: name };
            } else {
                // Si no hace match, guardamos por nombre completo por seguridad
                map[name] = { url: f.getUrl(), nombre: name };
            }
        }
    }
    return map;
}

function obtenerFilaPorId(ss, sheet, col, val) {
    const sh = ss.getSheetByName(sheet);
    const data = sh.getDataRange().getValues();
    const h = data.shift();
    const idx = h.indexOf(col);
    if (idx === -1) return null;
    const row = data.find(r => String(r[idx]) == String(val));
    if (!row) return null;
    let obj = {}; h.forEach((k, i) => obj[k] = row[i]); return obj;
}

function obtenerFilasRelacionadas(ss, sheet, col, val) {
    const sh = ss.getSheetByName(sheet);
    const data = sh.getDataRange().getValues();
    const h = data.shift();
    const idx = h.indexOf(col);
    if (idx === -1) return [];
    return data.filter(r => String(r[idx]) == String(val)).map(r => {
        let obj = {}; h.forEach((k, i) => obj[k] = r[i]); return obj;
    });
}

function crearCopiaPlantilla(ss, nombre) {
    const file = DriveApp.getFileById(ss.getId());
    return SpreadsheetApp.openById(file.makeCopy(nombre).getId());
}

function obtenerOCrearCarpeta(nombre) {
    const parents = DriveApp.getRootFolder().getFoldersByName(nombre);
    return parents.hasNext() ? parents.next() : DriveApp.getRootFolder().createFolder(nombre);
}

function ajustarCelda(ref, add, cut) {
    if (add === 0) return ref;
    const m = ref.match(/([A-Z]+)(\d+)/);
    if (!m) return ref;
    const r = parseInt(m[2]);
    return r > cut ? `${m[1]}${r + add}` : ref;
}

function insertarImagenEnCelda(url, rango) {
    insertarImagenFlotante(url, rango);
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

function chunkArray(arr, size) {
    let res = [];
    while (arr.length) res.push(arr.splice(0, size));
    return res;
}
/**
 * =================================================================
 * --- ADEMINCOL: GESTOR DE REPORTES PIERNAS MUERTAS ---
 * =================================================================
 * Este archivo debe ir en "Code.gs" dentro de Google Apps Script.
 */

const ID_BD_GENERAL = '1M0Kv_rdvNNVREI3cjDrvW08cBgir4TR_h7lR1rUP0gE';
const NOMBRE_HOJA_SISTEMAS = '0_sistema';
const NOMBRE_HOJA_GENERAL = '1_general';
const NOMBRE_HOJA_FORMATO = 'formato';
const NOMBRE_CARPETA_RAIZ = 'REPORTES_PIERNAS_MUERTAS';

const MAPEO_DE_CELDAS = {
  'cliente': 'I8', 'troncal': 'V8', 'estacion': 'AI8', 'sistema': 'AV8',
  'nombre_pp': 'V14', 'fecha': 'I10', 'componente': 'V10', 'segmento': 'AI10',
  'descripcion': 'AI14', 'inicio': 'I12', 'fin': 'V12', 'diametro': 'AV12',
  'longitud': 'AV10', 'ref_linea asociada': 'AI12', 'orientacion': 'I14'
};

const SECTIONS_CONFIG = {
  'inspeccion': {
    sheetName: '1_2_inspe_visual',
    dataStartRow: 19,
    mapping: {
      'recub_estado': 'C19', 'recub_deterioro': 'F19', 'valv_tipo': 'I19', 'valv_rating_class': 'K19',
      'valv_humed': 'N19', 'valv_corr': 'Q19', 'valv_volante': 'T19', 'brid_cumple_llen_tuer': 'W19',
      'brid_fugas': 'AC19', 'rosca_fugas': 'AF19', 'dano_mecanico': 'AL19', 'prof_dano_mec': 'AI19', 'prof_corr_ext': 'AU19', 'corrosion_ext': 'AP19'
    },
    photosConfig: {
      photoSheetName: '1_2_1_photos_vt',
      idColumnName: 'id_pm',
      photoLinkColumnName: 'link_ph',
      photoCells: ['C23', 'P23', 'AC23', 'AP23'],
      descCells: ['C24', 'P24', 'AC24', 'AP24']
    }
  },
  'radiografia': {
    sheetName: '1_3radiografia',
    dataStartRow: 39,
    mapping: {
      'CML': 'C39', 'componente': 'F39', 'tiempo_exp_seg': 'I39', 'iqi_obser': 'L39', 'iqi_req': 'O39',
      'nps': 'R39', 'thk_nom_mm': 'U39', 'thk_min_mm': 'X39', 'thk_prom_mm': 'AA39', 'thk_corr_int_mm': 'AD39',
      'corr_interna': 'AG39', 'thk_socavado_mm': 'AJ39', 'thk_rosca_libre_mm': 'AP39', 'indicaciones_soldaduras': 'AM39', 'fluido': 'AV39', 'valv_posicion': 'AY39', 'objeto_interno': 'BA39', 'sedimentos': 'AS39'
    },
    photosConfig: {
      photoSheetName: '1_3_1_photos_rt',
      idColumnName: 'id_pm',
      photoLinkColumnName: 'link_ph',
      photoCells: ['C43', 'P43', 'AC43', 'AP43'],
      descCells: ['C44', 'P44', 'AC44', 'AP44']
    }
  },
  'espesores': {
    sheetName: '1_1_med_espesores',
    dataStartRow: 49,
    mapping: {
      'componente': 'H49', 'nps': 'G49', 'CML': 'E49', 'med1': 'K49', 'med2': 'L49', 'med3': 'M49', 'med4': 'N49',
      'med5': 'O49', 'med6': 'P49', 'med7': 'Q49', 'med8': 'R49', 'med9': 'S49', 'med10': 'T49', 'med11': 'U49',
      'med12': 'V49', 'med13': 'W49', 'med14': 'X49', 'med15': 'Y49', 'med16': 'Z49', 'med17': 'AA49', 'med18': 'AB49',
      'med19': 'AC49', 'med20': 'AD49', 'utc_min_1': 'AG49', 'utc_prom_1': 'AK49', 'utc_min_2': 'AO49',
      'utc_prom_2': 'AS49', 'utc_min_3': 'AW49', 'utc_prom_3': 'AZ49', 't_nominal': 'AE49'
    }
  }
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Gestor Piernas Muertas - ADEMINCOL')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function getSistemas() {
  const ss = SpreadsheetApp.openById(ID_BD_GENERAL);
  const hoja = ss.getSheetByName(NOMBRE_HOJA_SISTEMAS);
  const data = hoja.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase());
  const idxId = headers.indexOf('id_sistema');
  const idxNom = headers.indexOf('sistema');

  return data.slice(1).map(r => ({
    id: r[idxId],
    nombre: r[idxNom],
    dbUrl: `https://docs.google.com/spreadsheets/d/${ID_BD_GENERAL}/edit`
  })).filter(x => x.id);
}

function getPMBySistema(idSistema, nombreSistema) {
  const ss = SpreadsheetApp.openById(ID_BD_GENERAL);
  const hoja = ss.getSheetByName(NOMBRE_HOJA_GENERAL);
  const data = hoja.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().toLowerCase());

  const idxIdPm = headers.indexOf('id_pm');
  const idxIdSist = headers.indexOf('id_sistema');
  const idxTag = headers.indexOf('tag');
  const idxNombre = headers.indexOf('nombre_pp');

  const reportes = listarReportesExistentes(idSistema, nombreSistema);

  return data.slice(1)
    .filter(r => r[idxIdSist]?.toString() == idSistema?.toString())
    .map(r => {
      const id = r[idxIdPm]?.toString();
      const rep = reportes[id];
      return {
        id: id,
        tag: r[idxTag] || 'N/A',
        nombre: r[idxNombre] || 'Sin Nombre',
        reporteUrl: rep ? rep.url : null,
        fechaGenerado: rep ? rep.fecha : null
      };
    });
}

function listarReportesExistentes(idSist, nombreSist) {
  const map = {};
  try {
    const carpeta = obtenerCarpetaSistema(idSist, nombreSist);
    const archivos = carpeta.getFiles();
    while (archivos.hasNext()) {
      const f = archivos.next();
      const nombre = f.getName();
      const partes = nombre.split('_');
      if (partes.length >= 3) {
        const id = partes[2];
        map[id] = {
          url: f.getUrl(),
          fecha: Utilities.formatDate(f.getDateCreated(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm")
        };
      }
    }
  } catch (e) { }
  return map;
}

function iniciarGeneracion(listaIds, idSistema, nombreSistema) {
  const props = PropertiesService.getScriptProperties();
  const job = {
    idSistema: idSistema,
    nombreSistema: nombreSistema,
    pendientes: listaIds,
    procesados: [],
    errores: [],
    total: listaIds.length,
    timestamp: new Date().getTime()
  };
  props.setProperty('JOB_PM', JSON.stringify(job));
  limpiarTriggers();
  ScriptApp.newTrigger('procesarLote').timeBased().after(1000).create();
  return { success: true, total: listaIds.length };
}

function procesarLote() {
  const props = PropertiesService.getScriptProperties();
  const jobStr = props.getProperty('JOB_PM');
  if (!jobStr) return;

  let job = JSON.parse(jobStr);
  const lote = job.pendientes.splice(0, 5);
  const ssDatos = SpreadsheetApp.openById(ID_BD_GENERAL);
  const carpetaSist = obtenerCarpetaSistema(job.idSistema, job.nombreSistema);

  lote.forEach(idPm => {
    try {
      const url = generarReporteUnico(idPm, ssDatos, carpetaSist);
      job.procesados.push({ id: idPm, url: url });
    } catch (e) {
      job.errores.push({ id: idPm, error: e.message });
    }
  });

  props.setProperty('JOB_PM', JSON.stringify(job));
  if (job.pendientes.length > 0) {
    limpiarTriggers();
    ScriptApp.newTrigger('procesarLote').timeBased().after(5000).create();
  } else {
    limpiarTriggers();
  }
}

function getProgreso() {
  const props = PropertiesService.getScriptProperties();
  const job = props.getProperty('JOB_PM');
  return job ? JSON.parse(job) : null;
}

function generarReporteUnico(idPm, ssDatos, carpeta) {
  const hojaG = ssDatos.getSheetByName(NOMBRE_HOJA_GENERAL);
  const data = hojaG.getDataRange().getValues();
  const headers = data[0].map(h => h.toString().trim().toLowerCase());
  const idxId = headers.indexOf('id_pm');

  const filaData = data.find(r => r[idxId]?.toString() === idPm.toString());
  if (!filaData) throw new Error("ID no encontrado");

  const nombrePP = filaData[headers.indexOf('nombre_pp')] || 'NombrePP';
  const nombreFinal = `Reporte_PM_${idPm}_${nombrePP}`.substring(0, 100);

  const existentes = carpeta.getFilesByName(nombreFinal);
  while (existentes.hasNext()) existentes.next().setTrashed(true);

  const nuevoReporte = SpreadsheetApp.create(nombreFinal);
  DriveApp.getFileById(nuevoReporte.getId()).moveTo(carpeta);

  const plantilla = ssDatos.getSheetByName(NOMBRE_HOJA_FORMATO);
  const hojaDestino = plantilla.copyTo(nuevoReporte);
  hojaDestino.setName(NOMBRE_HOJA_FORMATO);
  if (nuevoReporte.getSheetByName('Hoja 1')) nuevoReporte.deleteSheet(nuevoReporte.getSheetByName('Hoja 1'));

  const headersRaw = data[0].map(h => h.toString().trim());
  for (const col in MAPEO_DE_CELDAS) {
    const idx = headersRaw.indexOf(col);
    if (idx !== -1) hojaDestino.getRange(MAPEO_DE_CELDAS[col]).setValue(filaData[idx]);
  }

  let filasAcumuladas = 0;
  for (let key in SECTIONS_CONFIG) {
    filasAcumuladas += processSectionCore(idPm, ssDatos, hojaDestino, SECTIONS_CONFIG[key], filasAcumuladas);
  }

  return nuevoReporte.getUrl();
}

function processSectionCore(pvId, ssD, hojaD, config, filasPrev) {
  try {
    const hojaS = ssD.getSheetByName(config.sheetName);
    if (!hojaS) return 0;

    const data = hojaS.getDataRange().getValues();
    const headers = data[0].map(h => h.toString().trim().toLowerCase());
    const idxId = headers.indexOf('id_pm');

    if (idxId === -1) return 0;
    const registros = data.slice(1).filter(f => f[idxId]?.toString().trim() == pvId.toString());
    if (registros.length === 0) return 0;

    const filaInicio = config.dataStartRow + filasPrev;
    let nuevasData = registros.length - 1;

    if (nuevasData > 0) {
      hojaD.insertRowsAfter(filaInicio, nuevasData);
      hojaD.getRange(filaInicio, 1, 1, hojaD.getMaxColumns()).copyTo(hojaD.getRange(filaInicio + 1, 1, nuevasData, hojaD.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      hojaD.setRowHeight(filaInicio + 1, hojaD.getRowHeight(filaInicio));
    }

    registros.forEach((reg, i) => {
      const f = filaInicio + i;
      for (const c in config.mapping) {
        const letra = config.mapping[c].match(/[A-Z]+/)[0];
        const hIdx = headers.indexOf(c.toLowerCase());
        if (hIdx !== -1) hojaD.getRange(`${letra}${f}`).setValue(reg[hIdx]);
      }
    });

    let totalFInsertadas = nuevasData;

    if (config.photosConfig) {
      const pC = config.photosConfig;
      const hFotos = ssD.getSheetByName(pC.photoSheetName);
      if (hFotos) {
        const dF = hFotos.getDataRange().getValues();
        const headF = dF[0].map(h => h.toString().trim().toLowerCase());
        const iIdF = headF.indexOf('id_pm');
        const iLinkF = headF.indexOf(pC.photoLinkColumnName.toLowerCase());
        const iDesc = headF.indexOf('descripcion');

        const fotos = dF.slice(1).filter(f => f[iIdF]?.toString().trim() == pvId.toString() && f[iLinkF]?.toString().startsWith('http'));

        if (fotos.length > 0) {
          const offset = parseInt(pC.photoCells[0].match(/\d+/)[0]) - config.dataStartRow;
          const baseRow = filaInicio + nuevasData + offset;

          fotos.forEach((foto, j) => {
            const chunk = Math.floor(j / 4);
            const pos = j % 4;
            const pR = baseRow + (chunk * 2);
            const dR = pR + 1;

            if (chunk > 0 && pos === 0) {
              hojaD.insertRowsAfter(pR - 1, 2);
              totalFInsertadas += 2;
              const srcR = pR - 2;
              hojaD.getRange(srcR, 1, 2, hojaD.getMaxColumns()).copyTo(hojaD.getRange(pR, 1, 2, hojaD.getMaxColumns()), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
              hojaD.setRowHeight(pR, hojaD.getRowHeight(srcR));
              hojaD.setRowHeight(dR, hojaD.getRowHeight(srcR + 1));
            }

            const colP = pC.photoCells[pos].match(/[A-Z]+/)[0];
            const colD = pC.descCells[pos].match(/[A-Z]+/)[0];

            insertarImagen(foto[iLinkF], hojaD.getRange(`${colP}${pR}`));

            if (iDesc !== -1 && foto[iDesc]) {
              hojaD.getRange(`${colD}${dR}`).setValue(foto[iDesc]);
            }
          });
        }
      }
    }
    return totalFInsertadas;
  } catch (e) { return 0; }
}

function insertarImagen(url, celda) {
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

function obtenerCarpetaSistema(idSist, nombreSist) {
  const nombreCarpeta = `${idSist}_${nombreSist}`;
  const raizFolders = DriveApp.getFoldersByName(NOMBRE_CARPETA_RAIZ);
  const raiz = raizFolders.hasNext() ? raizFolders.next() : DriveApp.createFolder(NOMBRE_CARPETA_RAIZ);
  const sistFolders = raiz.getFoldersByName(nombreCarpeta);
  return sistFolders.hasNext() ? sistFolders.next() : raiz.createFolder(nombreCarpeta);
}

function limpiarTriggers() {
  const all = ScriptApp.getProjectTriggers();
  for (let t of all) {
    if (t.getHandlerFunction() === 'procesarLote') ScriptApp.deleteTrigger(t);
  }
}

function getCarpetaUrl(idSist, nombreSist) {
  try {
    const carpeta = obtenerCarpetaSistema(idSist, nombreSist);
    return carpeta.getUrl();
  } catch (e) { return "#"; }
}
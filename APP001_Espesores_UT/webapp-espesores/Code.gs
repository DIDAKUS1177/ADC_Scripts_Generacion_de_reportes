/**
 * =============================================================
 * WEBAPP ESPESORES · Code.gs  (v2)
 * ADEMINCOL — Lecturas CML de Medición de Espesores UT
 * @author Diego Alejandro Hernandez Blanco
 * =============================================================
 *
 * CÓMO DESPLEGAR:
 *  1. script.google.com → Nuevo proyecto
 *  2. Renombrar "Código" a "Code" y pegar este contenido
 *  3. Crear archivo HTML (+→HTML) llamarlo "Index" y pegar Index.html
 *  4. Guardar → Implementar → Nueva implementación
 *     Tipo: Aplicación web | Ejecutar como: Yo | Acceso: Organización
 *  5. Copiar URL y compartir con inspectores
 *
 * ALCANCE:
 *  - Solo lecturas CML (2_lecturas_tomadas)
 *  - Los datos generales y fotos los maneja AppSheet (offline/cámara)
 *  - La generación de reportes lee todo el Sheet (general + lecturas + fotos)
 *
 * IMÁGENES (respuesta Q5):
 *  AppSheet almacena las fotos como nombres de archivo en su storage propio.
 *  La fórmula en la columna del Sheet construye la URL pública:
 *    "https://www.appsheet.com/template/gettablefileurl?appName=...&fileName="&C2
 *  En SQL: guardarías esa URL completa como VARCHAR(500) directamente.
 *  En GAS: UrlFetchApp.fetch() puede leer esas URLs (son públicas, sin auth).
 *  No almacenar base64 en BD → lento y pesado; siempre almacenar la URL.
 * =============================================================
 */

// ══════════════════════════════════════════════════════════════
//  CONSTANTES
// ══════════════════════════════════════════════════════════════
const WA_ID_BD             = '18pN681sIIu3rT6gO_MDfDFr9OZkOaFpAOPfQxooJpXk';
const WA_NOMBRE_CARPETA    = 'REPORTES_MEDICION_ESPESORES';

const WA_HOJA_GENERAL      = '1_general';
const WA_HOJA_LECTURAS     = '2_lecturas_tomadas';
const WA_HOJA_FOTOGRAFIAS  = '3_fotografias';
const WA_HOJA_COMPLEMENTOS = '4_complementos';
const WA_HOJA_B36          = 'B36';
const WA_HOJA_FORMATO      = 'FORMATOS_SCAN_C';

const WA_COL_ID            = 'id_general';
const WA_COL_LINK          = 'LinkReporte';

// Mapeo campos → celdas del formato Excel
const WA_MAPEO_GENERAL = {
  'cliente':'D7','contrato':'K7','fecha_reporte':'U7','ot':'AD7','num_reporte':'AK7',
  'zona':'D9','estacion':'K9','sistema':'U8','alcance':'AD9',
  'norma_referencia':'F11','criterio_aceptacion':'AB11',
  'material':'E15','temperatura_servicio':'R15',
  'tipo_recubrimiento':'AB15','condicion_recubrimiento':'AJ15',
  'rating_sistema':'E17','presion_diseno':'S17','mop':'Z17','codigo_diseno':'AG17',
  'marca_equipo':'G21','modelo_equipo':'X21','serie_equipo':'AF21','fecha_calibracion':'AL21',
  'tipo_palpador':'E23','frecuencia':'R23','tamano_diametro':'AB23','bloque_calibracion':'AE23',
  'material_bloque':'E25','procedimiento':'P25','tecnica':'AC25','velocidad_calibracion':'AL25',
  'nombre':'C41','cargo':'C42','certificado':'C43','fecha':'C44'
};
const WA_MAPEO_IMAGENES = {
  'link_foto_equipo': 'D21',
  'link_firma':       'C40'
};

const WA_FILA_INICIO_LECTURAS = 34;
const WA_COLUMNAS_LECTURAS = {
  'item':'A', 'CML':'F', 'componente':'B', 'diametro':'H', 't_nominal':'I',
  'med1':'J',  'med2':'K',  'med3':'L',  'med4':'M',
  'med5':'N',  'med6':'O',  'med7':'P',  'med8':'Q',
  'med9':'R',  'med10':'S', 'med11':'T', 'med12':'U',
  'med13':'V', 'med14':'W', 'med15':'X', 'med16':'Y',
  'observaciones':'AJ'
};
const WA_COLUMNAS_FORMULA   = ['Z','AB','AD','AF','AH'];
const WA_FILA_INICIO_FOTOS  = 37;
const WA_COLUMNAS_FOTOS     = ['A','N','AA'];

// Usuarios fallback (si 5_login no está disponible)
const WA_USUARIOS = {
  'diego': '123'
};

// Componentes por defecto para tipos de activo (se usan si 4_complementos
// no tiene columna tipo_activo)
const WA_COMP_TANQUES = [
  'VIROLA / SHELL','FONDO','TECHO FIJO','TECHO FLOTANTE',
  'ANULAR (ANILLO DE FONDO)','BOQUILLA / NOZZLE','PASO DE HOMBRE / MANWAY',
  'TUBERÍA DE SUCCIÓN','TUBERÍA DE DESCARGA','DUCTO DE VENTEO',
  'ESCALERA','PLATAFORMA'
];
const WA_COMP_RECIPIENTES = [
  'CUERPO / SHELL','CABEZA ELÍPTICA 2:1','CABEZA HEMISFÉRICA',
  'CABEZA TORISFÉRICA','CABEZA PLANA','BOQUILLA / NOZZLE',
  'PASO DE HOMBRE / MANWAY','SKIRT / FALDA DE SOPORTE',
  'SILLA / SADDLE','CARCASA INTERCAMBIADOR','CABEZA INTERCAMBIADOR'
];
const WA_DIAM_TANQUES      = ['10 ft','20 ft','30 ft','40 ft','50 ft','60 ft',
                               '3 m','6 m','9 m','12 m','15 m','18 m'];
const WA_DIAM_RECIPIENTES  = ['12"','18"','24"','30"','36"','42"','48"','54"',
                               '60"','72"','84"','96"'];


// ══════════════════════════════════════════════════════════════
//  ENTRY POINT
// ══════════════════════════════════════════════════════════════
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('UT Espesores · ADEMINCOL')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}


// ══════════════════════════════════════════════════════════════
//  AUTENTICACIÓN
// ══════════════════════════════════════════════════════════════
function validarUsuario(username, password) {
  // Leer primero desde 5_login (gestión desde AppSheet)
  try {
    const ss = SpreadsheetApp.openById(WA_ID_BD);
    const sh = ss.getSheetByName('5_login');
    if (sh) {
      const data = sh.getDataRange().getValues();
      const hdrs = data[0].map(h => String(h).trim().toLowerCase());
      const iU   = hdrs.findIndex(h => h === 'usuario' || h === 'user' || h === 'username');
      const iP   = hdrs.findIndex(h => h.includes('contra') || h === 'password' || h === 'pass');
      if (iU >= 0 && iP >= 0) {
        const match = data.slice(1).some(r =>
          r[iU] && String(r[iU]).trim().toLowerCase() === username.trim().toLowerCase() &&
          String(r[iP]).trim() === password
        );
        if (match) return { ok: true, username: username };
        return { ok: false };
      }
    }
  } catch(e) { Logger.log('validarUsuario (sheet): ' + e.message); }

  // Fallback: hardcoded
  const u = username.trim().toLowerCase();
  if (WA_USUARIOS[u] && WA_USUARIOS[u] === password) return { ok: true, username: u };
  return { ok: false };
}


// ══════════════════════════════════════════════════════════════
//  PANEL — LISTAR TODOS LOS REGISTROS
// ══════════════════════════════════════════════════════════════
/**
 * Retorna todos los registros de 1_general con estado de lecturas y reporte.
 * Hace una sola lectura de 2_lecturas_tomadas para saber qué IDs tienen datos.
 */
function getReportesExistentes() {
  try {
    const ss  = SpreadsheetApp.openById(WA_ID_BD);

    // IDs que ya tienen lecturas guardadas
    const idsConLecturas = new Set();
    try {
      const shL = ss.getSheetByName(WA_HOJA_LECTURAS);
      if (shL) {
        const lData = shL.getDataRange().getValues();
        const lHdrs = lData[0].map(h => String(h).trim().toLowerCase());
        const liId  = lHdrs.indexOf(WA_COL_ID.toLowerCase());
        if (liId >= 0) lData.slice(1).forEach(r => {
          const v = String(r[liId]).trim();
          if (v) idsConLecturas.add(v);
        });
      }
    } catch(e) { Logger.log('lecturas check: ' + e.message); }

    // Registros generales
    const sh   = ss.getSheetByName(WA_HOJA_GENERAL);
    if (!sh) return [];
    const all  = sh.getDataRange().getValues();
    const hdrs = all[0].map(h => String(h).trim().toLowerCase());

    const idx = (keys) => {
      for (const k of keys) { const i = hdrs.findIndex(h => h.includes(k)); if (i>=0) return i; }
      return -1;
    };

    const iId  = hdrs.indexOf(WA_COL_ID.toLowerCase());
    const iLk  = hdrs.indexOf(WA_COL_LINK.toLowerCase());
    const iCl  = idx(['client']);
    const iCt  = idx(['contrat']);
    const iFe  = idx(['fecha_rep','fecha rep']);
    const iNr  = idx(['num_rep','numero_rep','n_rep','nro_rep']);
    const iEs  = idx(['estacion','estación']);
    const iSi  = idx(['sistema']);

    return all.slice(1).filter(r => r[iId]).map(r => ({
      id_general:   String(r[iId]  ?? ''),
      cliente:      iCl >= 0 ? String(r[iCl]  ?? '') : '',
      contrato:     iCt >= 0 ? String(r[iCt]  ?? '') : '',
      estacion:     iEs >= 0 ? String(r[iEs]  ?? '') : '',
      sistema:      iSi >= 0 ? String(r[iSi]  ?? '') : '',
      fecha:        iFe >= 0
                      ? (r[iFe] instanceof Date
                          ? Utilities.formatDate(r[iFe], 'GMT-5', 'dd/MM/yyyy')
                          : String(r[iFe] ?? ''))
                      : '',
      num_reporte:  iNr >= 0 ? String(r[iNr]  ?? '') : '',
      urlReporte:   iLk >= 0 ? String(r[iLk]  ?? '') : '',
      has_lecturas: idsConLecturas.has(String(r[iId]).trim())
    }));
  } catch (e) {
    Logger.log('Error getReportesExistentes: ' + e.message);
    return [];
  }
}


// ══════════════════════════════════════════════════════════════
//  CATÁLOGOS (complementos, diámetros, B36)
// ══════════════════════════════════════════════════════════════
/**
 * Retorna catálogos agrupados por tipo de activo.
 * Si 4_complementos tiene columna tipo_activo, la usa para clasificar.
 * Si no, todo va a TUBERIAS y se añaden los catálogos internos de
 * TANQUES y RECIPIENTES_A_PRESION.
 */
function getDatosFormulario() {
  const ss = SpreadsheetApp.openById(WA_ID_BD);

  const catalogos = {
    TUBERIAS:             { complementos: [], diametros: [] },
    TANQUES:              { complementos: WA_COMP_TANQUES.slice(),    diametros: WA_DIAM_TANQUES.slice() },
    RECIPIENTES_A_PRESION:{ complementos: WA_COMP_RECIPIENTES.slice(), diametros: WA_DIAM_RECIPIENTES.slice() }
  };

  try {
    const sh = ss.getSheetByName(WA_HOJA_COMPLEMENTOS);
    if (sh) {
      const data  = sh.getDataRange().getValues();
      const hdrs  = data[0].map(h => String(h).trim().toLowerCase());
      // Columna componentes: puede llamarse 'complementos', 'componente', 'component', 'comp'
      const iC    = hdrs.findIndex(h => h === 'complementos' || h.includes('componente') || h.includes('component') || h === 'comp');
      // Columna NPS: puede llamarse 'nps_in', 'nps', 'diametro', 'diam'
      const iD    = hdrs.findIndex(h => h === 'nps_in' || h === 'nps' || h.startsWith('nps') || h.includes('diametr') || h.includes('diam'));
      const iTipo = hdrs.findIndex(h => h === 'tipo_activo' || h === 'tipo' || h === 'categoria');

      data.slice(1).forEach(row => {
        const comp  = String(row[iC]    ?? '').trim();
        const diam  = String(row[iD]    ?? '').trim();
        const tipo  = iTipo >= 0 ? String(row[iTipo] ?? '').trim().toUpperCase() : 'TUBERIAS';

        // Normalizar tipo
        let cat = 'TUBERIAS';
        if (tipo.includes('TANQUE'))      cat = 'TANQUES';
        if (tipo.includes('RECIPIENTE') || tipo.includes('VESSEL') || tipo.includes('PRESION')) cat = 'RECIPIENTES_A_PRESION';

        if (comp && !catalogos[cat].complementos.includes(comp)) catalogos[cat].complementos.push(comp);
        if (diam && !catalogos[cat].diametros.includes(diam))    catalogos[cat].diametros.push(diam);
      });
    }
  } catch (e) { Logger.log('Error 4_complementos: ' + e.message); }

  // Leer B36
  let b36 = [];
  try {
    const sh = ss.getSheetByName(WA_HOJA_B36);
    if (sh) b36 = sh.getDataRange().getValues();
  } catch (e) { Logger.log('Error B36: ' + e.message); }

  return { catalogos, b36 };
}


// ══════════════════════════════════════════════════════════════
//  LECTURAS — LEER POR ID
// ══════════════════════════════════════════════════════════════
function getLecturasPorId(idGeneral) {
  try {
    return _waFilasRelacionadas(SpreadsheetApp.openById(WA_ID_BD),
                                WA_HOJA_LECTURAS, WA_COL_ID, idGeneral);
  } catch (e) {
    Logger.log('Error getLecturasPorId: ' + e.message);
    return [];
  }
}


// ══════════════════════════════════════════════════════════════
//  LECTURAS — GUARDAR (upsert: borra las del ID y reinserta)
// ══════════════════════════════════════════════════════════════
/**
 * Guarda ÚNICAMENTE en 2_lecturas_tomadas.
 * Los datos generales y fotos los maneja AppSheet.
 *
 * @param {string} idGeneral  - ID del reporte (debe existir en 1_general)
 * @param {Array}  filas      - Array de objetos {item,CML,componente,diametro,
 *                              t_nominal,med1..med16,observaciones}
 */
function guardarLecturas(idGeneral, filas) {
  try {
    if (!idGeneral) throw new Error('id_general es requerido.');
    if (!filas || !filas.length) throw new Error('No hay filas que guardar.');

    const ss   = SpreadsheetApp.openById(WA_ID_BD);
    const sh   = ss.getSheetByName(WA_HOJA_LECTURAS);
    if (!sh) throw new Error(`Hoja "${WA_HOJA_LECTURAS}" no encontrada.`);

    const hdrs = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const hdrsL= hdrs.map(h => h.toLowerCase());
    const iId  = hdrsL.indexOf(WA_COL_ID.toLowerCase());
    if (iId < 0) throw new Error(`Columna "${WA_COL_ID}" no encontrada en ${WA_HOJA_LECTURAS}.`);

    // Borrar existentes (de abajo hacia arriba)
    _waDeleteById(ss, WA_HOJA_LECTURAS, WA_COL_ID, idGeneral);

    // Insertar nuevas
    filas.forEach(fila => {
      const row = hdrs.map(h => {
        const hl = h.toLowerCase();
        if (hl === 'id_general')    return String(idGeneral);
        if (hl === 'item')          return fila.item          ?? '';
        if (hl === 'cml')           return fila.CML           ?? fila.cml ?? '';
        if (hl === 'componente')    return fila.componente    ?? '';
        if (hl === 'diametro')      return fila.diametro      ?? '';
        if (hl === 't_nominal')     return fila.t_nominal     ?? '';
        if (hl === 'observaciones') return fila.observaciones ?? '';
        const m = hl.match(/^m(?:ed)?0?(\d{1,2})$/);
        if (m) return fila['med' + parseInt(m[1])] ?? '';
        return '';
      });
      sh.appendRow(row);
    });

    SpreadsheetApp.flush();
    return { success: true, filas: filas.length, id: idGeneral };
  } catch (e) {
    Logger.log('Error guardarLecturas: ' + e.stack);
    return { success: false, error: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  LECTURAS — ELIMINAR UN PUNTO CML ESPECÍFICO
// ══════════════════════════════════════════════════════════════
/**
 * Elimina de 2_lecturas_tomadas la(s) fila(s) donde
 * id_general = idGeneral Y CML = cmlNombre.
 * Permite borrado individual de un punto sin afectar los demás.
 */
function eliminarLecturaCML(idGeneral, cmlNombre) {
  try {
    if (!idGeneral || !cmlNombre) throw new Error('ID y nombre CML requeridos.');
    const ss = SpreadsheetApp.openById(WA_ID_BD);
    const sh = ss.getSheetByName(WA_HOJA_LECTURAS);
    if (!sh) return { success: true, eliminadas: 0 };

    const data = sh.getDataRange().getValues();
    const hdrs = data[0].map(h => String(h).trim().toLowerCase());
    const iId  = hdrs.indexOf(WA_COL_ID.toLowerCase());
    const iCML = hdrs.findIndex(h => h === 'cml');
    if (iId < 0 || iCML < 0) throw new Error('Columnas id_general o CML no encontradas.');

    let eliminadas = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][iId]).trim()  === String(idGeneral).trim() &&
          String(data[i][iCML]).trim() === String(cmlNombre).trim()) {
        sh.deleteRow(i + 1);
        eliminadas++;
      }
    }
    SpreadsheetApp.flush();
    return { success: true, eliminadas };
  } catch (e) {
    Logger.log('Error eliminarLecturaCML: ' + e.message);
    return { success: false, error: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  GENERAR REPORTE
// ══════════════════════════════════════════════════════════════
function generarReporte(idGeneral) {
  try {
    const ss  = SpreadsheetApp.openById(WA_ID_BD);
    const res = _waEjecutarGeneracion(idGeneral, ss);
    if (res.success) _waGuardarLink(idGeneral, res.url);
    return res;
  } catch (e) {
    Logger.log('Error generarReporte: ' + e.stack);
    return { success: false, error: e.message };
  }
}


// ══════════════════════════════════════════════════════════════
//  MOTOR DE GENERACIÓN DEL REPORTE
// ══════════════════════════════════════════════════════════════
function _waEjecutarGeneracion(idBuscado, ss) {
  try {
    const datosGral  = _waFilaPorId(ss, WA_HOJA_GENERAL, WA_COL_ID, idBuscado);
    if (!datosGral)  throw new Error(`ID "${idBuscado}" no encontrado en "${WA_HOJA_GENERAL}".`);
    const datosLec   = _waFilasRelacionadas(ss, WA_HOJA_LECTURAS,    WA_COL_ID, idBuscado);
    const datosFotos = _waFilasRelacionadas(ss, WA_HOJA_FOTOGRAFIAS, WA_COL_ID, idBuscado);

    // Limpiar reportes anteriores del mismo ID
    const carpeta = _waObtenerCarpeta();
    const busq    = carpeta.searchFiles(`title contains 'Reporte_Espesores_${idBuscado}'`);
    while (busq.hasNext()) busq.next().setTrashed(true);

    // Copiar plantilla
    const nombre  = `Reporte_Espesores_${idBuscado}_${Utilities.formatDate(new Date(),'GMT-5','yyyyMMdd')}`;
    const copiaId = DriveApp.getFileById(ss.getId()).makeCopy(nombre).getId();
    const copiaSS = SpreadsheetApp.openById(copiaId);
    const hojaD   = copiaSS.getSheetByName(WA_HOJA_FORMATO);
    if (!hojaD) throw new Error(`Hoja "${WA_HOJA_FORMATO}" no encontrada en la plantilla.`);

    // Insertar filas extra para lecturas
    const nLec = datosLec.length;
    let filasIns = 0;
    if (nLec > 1) {
      hojaD.insertRowsAfter(WA_FILA_INICIO_LECTURAS, nLec - 1);
      hojaD.getRange(WA_FILA_INICIO_LECTURAS, 1, 1, hojaD.getMaxColumns())
           .copyTo(hojaD.getRange(WA_FILA_INICIO_LECTURAS + 1, 1, nLec - 1, hojaD.getMaxColumns()),
                   SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      _waCopiarFormulas(hojaD, WA_FILA_INICIO_LECTURAS, nLec);
      filasIns = nLec - 1;
    }

    // Escribir lecturas
    datosLec.forEach((lec, i) => {
      const fila = WA_FILA_INICIO_LECTURAS + i;
      for (const key in WA_COLUMNAS_LECTURAS) {
        const val = lec[key];
        if (val !== undefined && val !== '') {
          hojaD.getRange(`${WA_COLUMNAS_LECTURAS[key]}${fila}`).setValue(val);
        }
      }
    });

    // Escribir datos generales (ajustando filas desplazadas)
    for (const campo in WA_MAPEO_GENERAL) {
      const celda = _waAjustarFila(WA_MAPEO_GENERAL[campo], filasIns, WA_FILA_INICIO_LECTURAS);
      let val = datosGral[campo];
      if (val === undefined || val === '') continue;
      if (val instanceof Date) val = Utilities.formatDate(val, 'GMT-5', 'dd/MM/yyyy');
      try { hojaD.getRange(celda).setValue(val); } catch(e) {}
    }

    // Imágenes de equipos / firma
    for (const campo in WA_MAPEO_IMAGENES) {
      const url = datosGral[campo];
      if (!url) continue;
      const celda = _waAjustarFila(WA_MAPEO_IMAGENES[campo], filasIns, WA_FILA_INICIO_LECTURAS);
      _waInsertarImagen(url, hojaD.getRange(celda));
    }

    // Fotos de inspección (en bloques de 3)
    const filaFotosBase = WA_FILA_INICIO_FOTOS + filasIns;
    const bloques = _waChunk([...datosFotos], 3);
    if (bloques.length > 1) {
      const filasA = (bloques.length - 1) * 2;
      hojaD.insertRowsAfter(filaFotosBase + 1, filasA);
      const tpl = hojaD.getRange(filaFotosBase, 1, 2, hojaD.getMaxColumns());
      for (let i = 1; i < bloques.length; i++) {
        const fD = filaFotosBase + (i * 2);
        tpl.copyTo(hojaD.getRange(fD, 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        hojaD.setRowHeight(fD,     hojaD.getRowHeight(filaFotosBase));
        hojaD.setRowHeight(fD + 1, hojaD.getRowHeight(filaFotosBase + 1));
      }
    }
    bloques.forEach((bloque, iB) => {
      const fFoto = filaFotosBase + (iB * 2);
      bloque.forEach((foto, iI) => {
        const col = WA_COLUMNAS_FOTOS[iI];
        const urlFoto = foto['link_imagen'] || foto['url_foto'] || foto['foto'] || '';
        if (urlFoto) _waInsertarImagen(urlFoto, hojaD.getRange(`${col}${fFoto}`));
        const desc = foto['descripccion'] || foto['descripcion'] || foto['desc'] || '';
        if (desc) hojaD.getRange(`${col}${fFoto + 1}`).setValue(desc);
      });
    });

    // Exportar a XLSX
    SpreadsheetApp.flush();
    copiaSS.getSheets().forEach(h => { if (h.getName() !== WA_HOJA_FORMATO) copiaSS.deleteSheet(h); });

    const exportUrl = `https://docs.google.com/spreadsheets/d/${copiaId}/export?format=xlsx`;
    const blobXlsx  = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }).getBlob().setName(nombre + '.xlsx');

    const archivoFin = carpeta.createFile(blobXlsx);
    DriveApp.getFileById(copiaId).setTrashed(true);

    return { success: true, url: archivoFin.getUrl(), nombre };

  } catch (e) {
    Logger.log('Error _waEjecutarGeneracion: ' + e.stack);
    return { success: false, error: e.toString() };
  }
}


// ══════════════════════════════════════════════════════════════
//  UTILIDADES INTERNAS
// ══════════════════════════════════════════════════════════════

function _waCopiarFormulas(hoja, filaBase, totalFilas) {
  if (totalFilas <= 1) return;
  WA_COLUMNAS_FORMULA.forEach(col => {
    const formula = hoja.getRange(`${col}${filaBase}`).getFormula();
    if (!formula) return;
    for (let i = 1; i < totalFilas; i++) {
      const fD = filaBase + i;
      const re = new RegExp('(\\$?[A-Z]+\\$?)(' + filaBase + ')(?=[^0-9]|$)', 'g');
      hoja.getRange(`${col}${fD}`).setFormula(formula.replace(re, (_, c) => c + fD));
    }
  });
}

function _waAjustarFila(ref, offset, filaCorte) {
  if (offset === 0) return ref;
  const m = ref.match(/([A-Z]+)(\d+)/);
  if (!m) return ref;
  return parseInt(m[2]) >= filaCorte ? `${m[1]}${parseInt(m[2]) + offset}` : ref;
}

/**
 * Inserta imagen flotante desde URL.
 * Soporta:
 *   - Google Drive (convierte a URL de descarga directa)
 *   - AppSheet CDN (gettablefileurl — son públicas, no requieren auth)
 *   - Cualquier URL HTTP pública
 */
function _waInsertarImagen(url, rango) {
  if (!url || typeof url !== 'string' || !url.trim()) return;
  let finalUrl = url.trim();

  // Google Drive: convertir a URL de descarga directa
  if (finalUrl.includes('drive.google.com')) {
    const m = finalUrl.match(/id=([^&]+)/) || finalUrl.match(/\/d\/([^/]+)/);
    if (m && m[1]) finalUrl = `https://drive.google.com/uc?export=download&id=${m[1]}`;
  }

  // AppSheet: las URLs gettablefileurl son públicas, se usan directo
  // (no se necesita transformación adicional)

  if (!finalUrl.startsWith('http')) { rango.setValue('Sin URL'); return; }

  const hoja = rango.getSheet();
  try {
    const resp = UrlFetchApp.fetch(finalUrl, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) { rango.setValue(`Img Error ${resp.getResponseCode()}`); return; }
    const blob = resp.getBlob();
    let dest = rango;
    if (rango.isPartOfMerge()) {
      const merged = rango.getMergedRanges();
      if (merged && merged.length > 0) dest = merged[0];
    }
    const fila = dest.getRow(), col = dest.getColumn();
    let aw = 0, ah = 0;
    for (let c = 0; c < dest.getNumColumns(); c++) aw += hoja.getColumnWidth(col + c);
    for (let r = 0; r < dest.getNumRows();    r++) ah += hoja.getRowHeight(fila + r);
    const img    = hoja.insertImage(blob, col, fila);
    const margen = 4;
    const escala = Math.min(
      Math.max(aw - margen, 20) / img.getWidth(),
      Math.max(ah - margen, 20) / img.getHeight()
    );
    img.setWidth(Math.round(img.getWidth()  * escala));
    img.setHeight(Math.round(img.getHeight() * escala));
  } catch (e) {
    Logger.log(`Error imagen (${finalUrl.substring(0,80)}): ${e.message}`);
    rango.setValue('Error Img');
  }
}

function _waFilaPorId(ss, hoja, idCol, idVal) {
  const sh = ss.getSheetByName(hoja);
  if (!sh) return null;
  const data = sh.getDataRange().getValues();
  const hdrs = data[0].map(h => String(h).trim());
  const iId  = hdrs.map(h => h.toLowerCase()).indexOf(idCol.toLowerCase());
  if (iId < 0) return null;
  const row = data.find((r, i) => i > 0 && String(r[iId]).trim() === String(idVal).trim());
  if (!row) return null;
  const obj = {}; hdrs.forEach((h, i) => obj[h] = row[i]);
  return obj;
}

function _waFilasRelacionadas(ss, hoja, idCol, idVal) {
  const sh = ss.getSheetByName(hoja);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  const hdrs = data[0].map(h => String(h).trim());
  const iId  = hdrs.map(h => h.toLowerCase()).indexOf(idCol.toLowerCase());
  if (iId < 0) return [];
  return data
    .filter((r, i) => i > 0 && String(r[iId]).trim() === String(idVal).trim())
    .map(row => { const obj = {}; hdrs.forEach((h, i) => obj[h] = row[i]); return obj; });
}

function _waDeleteById(ss, sheetName, idCol, idVal) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh) return;
  const all  = sh.getDataRange().getValues();
  const hdrs = all[0].map(h => String(h).trim().toLowerCase());
  const iId  = hdrs.indexOf(idCol.toLowerCase());
  if (iId < 0) return;
  for (let i = all.length - 1; i >= 1; i--) {
    if (String(all[i][iId]).trim() === String(idVal).trim()) sh.deleteRow(i + 1);
  }
}

function _waObtenerCarpeta() {
  const file = DriveApp.getFileById(WA_ID_BD);
  let parent;
  try { parent = file.getParents().next(); }
  catch (e) { parent = DriveApp.getRootFolder(); }
  const it = parent.getFoldersByName(WA_NOMBRE_CARPETA);
  return it.hasNext() ? it.next() : parent.createFolder(WA_NOMBRE_CARPETA);
}

function _waGuardarLink(idBuscado, link) {
  try {
    const ss   = SpreadsheetApp.openById(WA_ID_BD);
    const sh   = ss.getSheetByName(WA_HOJA_GENERAL);
    const data = sh.getDataRange().getValues();
    const hdrs = data[0].map(h => String(h).trim().toLowerCase());
    const iId  = hdrs.indexOf(WA_COL_ID.toLowerCase());
    const iLk  = hdrs.indexOf(WA_COL_LINK.toLowerCase());
    if (iId < 0 || iLk < 0) return;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][iId]).trim() === String(idBuscado).trim()) {
        sh.getRange(i + 1, iLk + 1).setValue(link); break;
      }
    }
  } catch (e) { Logger.log('Error _waGuardarLink: ' + e.message); }
}

function _waChunk(arr, size) {
  const res = [];
  while (arr.length) res.push(arr.splice(0, size));
  return res;
}

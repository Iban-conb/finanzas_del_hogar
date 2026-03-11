// ============================================================
//  CONTROL FINANCIERO DEL HOGAR — Google Apps Script Backend
// ============================================================

// ⚠️ CAMBIA ESTE ID por el de TU Google Sheet
var SHEET_ID = "PON_AQUI_EL_ID_DE_TU_GOOGLE_SHEET";

// Fila donde empiezan los datos
var DATA_START_ROW = 5;

// ─────────────────────────────────────────────────────────────
//  ÍNDICES DE COLUMNAS (verificados contra la plantilla real)
//  Todas las hojas empiezan en columna B (índice 0 = col A vacía)
//
//  💰 INGRESOS:     [0]=A  [1]=# [2]=MES [3]=AÑO [4]=PERSONA [5]=CONCEPTO [6]=IMPORTE [7]=NOTAS
//  📅 RECURRENTES:  [0]=A  [1]=# [2]=NOMBRE [3]=CATEGORÍA [4]=IMPORTE [5]=DÍA [6]=FRECUENCIA [7]=ACTIVO [8]=NOTAS
//  🛒 DIARIOS:      [0]=A  [1]=# [2]=MES [3]=AÑO [4]=FECHA [5]=CATEGORÍA [6]=DESCRIPCIÓN [7]=IMPORTE [8]=QUIÉN [9]=PAGADO_CON [10]=NOTAS
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
//  BUSCA UNA PESTAÑA POR PALABRA CLAVE (ignora emojis y case)
// ─────────────────────────────────────────────────────────────
function getSheet(ss, keyword) {
  var kw = keyword.toUpperCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toUpperCase().indexOf(kw) !== -1) {
      return sheets[i];
    }
  }
  throw new Error("Pestaña no encontrada: '" + keyword + "'. Disponibles: " +
    sheets.map(function(s) { return s.getName(); }).join(" | "));
}

// ─────────────────────────────────────────────────────────────
//  PUNTO DE ENTRADA
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var action = e.parameter.action || "";
    var result;
    switch (action) {
      case "ping":         result = { ok: true, msg: "Conexión correcta" }; break;
      case "getUsuarios":  result = getUsuarios(); break;
      case "getCategorias": result = getCategorias(); break;
      case "addCategoria": result = addCategoria(e.parameter); break;
      case "deleteCategoria": result = deleteCategoria(parseInt(e.parameter.fila)); break;
      case "getSummary":   result = getSummary(e.parameter.mes, parseInt(e.parameter.anio)); break;
      case "getDiarios":   result = getDiarios(e.parameter.mes, parseInt(e.parameter.anio)); break;
      case "getIngresos":  result = getIngresos(e.parameter.mes, parseInt(e.parameter.anio)); break;
      case "getRecurrentes": result = getRecurrentes(); break;
      case "addDiario":    result = addDiario(e.parameter); break;
      case "addIngreso":   result = addIngreso(e.parameter); break;
      case "addRecurrente": result = addRecurrente(e.parameter); break;
      case "toggleRecurrente": result = toggleRecurrente(parseInt(e.parameter.fila), e.parameter.estado); break;
      case "deleteRow":    result = deleteRow(e.parameter.sheet, parseInt(e.parameter.fila)); break;
      default: result = { error: "Acción desconocida: " + action };
    }
    return jsonResponse(result, e.parameter.callback);
  } catch (err) {
    return jsonResponse({ error: err.toString() }, e.parameter.callback);
  }
}

// ─────────────────────────────────────────────────────────────
//  RESUMEN DEL MES
// ─────────────────────────────────────────────────────────────
function getSummary(mes, anio) {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // — INGRESOS —
  // [2]=MES  [3]=AÑO  [4]=PERSONA  [6]=IMPORTE
  var dataIng = getSheet(ss, "INGRESOS").getDataRange().getValues();
  var totalIngresos = 0, ingP1 = 0, ingP2 = 0;
  for (var i = DATA_START_ROW - 1; i < dataIng.length; i++) {
    var r = dataIng[i];
    if (r[2] == mes && parseInt(r[3]) == anio) {
      var imp = parseFloat(r[6]) || 0;
      totalIngresos += imp;
      var persona = String(r[4] || "").trim();
      if (persona == "Persona 1") ingP1 += imp;
      else if (persona == "Persona 2") ingP2 += imp;
    }
  }

  // — RECURRENTES ACTIVOS —
  // [3]=CATEGORÍA  [4]=IMPORTE  [7]=ACTIVO
  var dataRec = getSheet(ss, "RECURRENTES").getDataRange().getValues();
  var totalRec = 0, recPorCat = {};
  for (var i = DATA_START_ROW - 1; i < dataRec.length; i++) {
    var r = dataRec[i];
    if (String(r[7]).trim() == "✅" && parseFloat(r[4]) > 0) {
      var imp = parseFloat(r[4]);
      var cat = String(r[3] || "Otros").trim();
      totalRec += imp;
      recPorCat[cat] = (recPorCat[cat] || 0) + imp;
    }
  }

  // — GASTOS DIARIOS —
  // [2]=MES  [3]=AÑO  [5]=CATEGORÍA  [7]=IMPORTE
  var dataDia = getSheet(ss, "DIARIOS").getDataRange().getValues();
  var totalDiarios = 0, diasPorCat = {};
  for (var i = DATA_START_ROW - 1; i < dataDia.length; i++) {
    var r = dataDia[i];
    if (r[2] == mes && parseInt(r[3]) == anio && parseFloat(r[7]) > 0) {
      var imp = parseFloat(r[7]);
      var cat = String(r[5] || "Otros").trim();
      totalDiarios += imp;
      diasPorCat[cat] = (diasPorCat[cat] || 0) + imp;
    }
  }

  // — COMBINAR CATEGORÍAS — (union de todas las categorías encontradas)
  var allCats = {};
  Object.keys(recPorCat).forEach(function(c){ allCats[c]=1; });
  Object.keys(diasPorCat).forEach(function(c){ allCats[c]=1; });
  // Asegurar categorías base aunque estén vacías
  ["Hogar","Suministros","Alimentación","Transporte","Ocio","Salud","Ropa","Tecnología","Otros"].forEach(function(c){ allCats[c]=1; });
  var porCat = {};
  Object.keys(allCats).forEach(function(c) {
    porCat[c] = {
      recurrente: recPorCat[c] || 0,
      diario:     diasPorCat[c] || 0,
      total:      (recPorCat[c] || 0) + (diasPorCat[c] || 0)
    };
  });

  var totalGastos = totalRec + totalDiarios;
  return {
    mes: mes, anio: anio,
    ingresos: { total: totalIngresos, persona1: ingP1, persona2: ingP2 },
    gastos:   { total: totalGastos, recurrentes: totalRec, diarios: totalDiarios },
    balance:  totalIngresos - totalGastos,
    ahorro_pct: totalIngresos > 0 ? (totalIngresos - totalGastos) / totalIngresos : 0,
    por_categoria: porCat
  };
}

// ─────────────────────────────────────────────────────────────
//  GASTOS DIARIOS
//  [1]=# [2]=MES [3]=AÑO [4]=FECHA [5]=CAT [6]=DESC [7]=IMPORTE [8]=QUIÉN [9]=PAGO [10]=NOTAS
// ─────────────────────────────────────────────────────────────
function getDiarios(mes, anio) {
  var data = getSheet(SpreadsheetApp.openById(SHEET_ID), "DIARIOS").getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2] && !r[7]) continue; // fila vacía
    if (mes  && r[2] != mes)           continue;
    if (anio && parseInt(r[3]) != anio) continue;
    result.push({
      fila:       i + 1,
      mes:        r[2],  anio:      r[3],
      fecha:      r[4],  categoria: r[5],
      descripcion:r[6],  importe:   parseFloat(r[7]) || 0,
      quien:      r[8],  pago:      r[9],
      notas:      r[10]
    });
  }
  return { ok: true, data: result.reverse() };
}

function addDiario(p) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "DIARIOS");
  var newRow = getLastDataRow(sh) + 1;
  // Escribe desde col B (columna 2): #  MES  AÑO  FECHA  CAT  DESC  IMP  QUIÉN  PAGO  NOTAS
  sh.getRange(newRow, 2, 1, 10).setValues([[
    "",
    p.mes   || "",
    parseInt(p.anio) || new Date().getFullYear(),
    p.fecha || Utilities.formatDate(new Date(), "Europe/Madrid", "dd/MM/yyyy"),
    p.categoria  || "Otros",
    p.descripcion || "",
    parseFloat(p.importe) || 0,
    p.quien || "Persona 1",
    p.pago  || "Tarjeta",
    p.notas || ""
  ]]);
  return { ok: true, msg: "Gasto añadido en fila " + newRow };
}

// ─────────────────────────────────────────────────────────────
//  INGRESOS
//  [1]=# [2]=MES [3]=AÑO [4]=PERSONA [5]=CONCEPTO [6]=IMPORTE [7]=NOTAS
// ─────────────────────────────────────────────────────────────
function getIngresos(mes, anio) {
  var data = getSheet(SpreadsheetApp.openById(SHEET_ID), "INGRESOS").getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2] && !r[6]) continue;
    if (mes  && r[2] != mes)           continue;
    if (anio && parseInt(r[3]) != anio) continue;
    result.push({
      fila: i + 1, mes: r[2], anio: r[3],
      persona: r[4], concepto: r[5],
      importe: parseFloat(r[6]) || 0, notas: r[7]
    });
  }
  return { ok: true, data: result };
}

function addIngreso(p) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "INGRESOS");
  var newRow = getLastDataRow(sh) + 1;
  // Escribe desde col B: #  MES  AÑO  PERSONA  CONCEPTO  IMPORTE  NOTAS
  sh.getRange(newRow, 2, 1, 7).setValues([[
    "",
    p.mes  || "",
    parseInt(p.anio) || new Date().getFullYear(),
    p.persona  || "Persona 1",
    p.concepto || "",
    parseFloat(p.importe) || 0,
    p.notas || ""
  ]]);
  return { ok: true, msg: "Ingreso añadido en fila " + newRow };
}

// ─────────────────────────────────────────────────────────────
//  RECURRENTES
//  [1]=# [2]=NOMBRE [3]=CATEGORÍA [4]=IMPORTE [5]=DÍA [6]=FRECUENCIA [7]=ACTIVO [8]=NOTAS
// ─────────────────────────────────────────────────────────────
function getRecurrentes() {
  var data = getSheet(SpreadsheetApp.openById(SHEET_ID), "RECURRENTES").getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2] && !r[4]) continue;
    result.push({
      fila:       i + 1,
      nombre:     r[2], categoria:  r[3],
      importe:    parseFloat(r[4]) || 0,
      dia_cobro:  r[5], frecuencia: r[6],
      activo:     r[7], notas:      r[8]
    });
  }
  return { ok: true, data: result };
}

function addRecurrente(p) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "RECURRENTES");
  var newRow = getLastDataRow(sh) + 1;
  // Escribe desde col B: #  NOMBRE  CAT  IMPORTE  DÍA  FREQ  ACTIVO  NOTAS
  sh.getRange(newRow, 2, 1, 8).setValues([[
    "",
    p.nombre     || "",
    p.categoria  || "Otros",
    parseFloat(p.importe) || 0,
    parseInt(p.dia_cobro) || 1,
    p.frecuencia || "Mensual",
    "✅",
    p.notas || ""
  ]]);
  return { ok: true, msg: "Recurrente añadido" };
}

function toggleRecurrente(fila, estado) {
  // ACTIVO está en col H = columna 8 (1-based)
  getSheet(SpreadsheetApp.openById(SHEET_ID), "RECURRENTES").getRange(fila, 8).setValue(estado);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
//  BORRAR FILA
// ─────────────────────────────────────────────────────────────
function deleteRow(sheetKey, fila) {
  var validKeys = ["diarios", "ingresos", "recurrentes"];
  if (validKeys.indexOf(sheetKey) === -1) return { error: "Clave no válida: " + sheetKey };
  getSheet(SpreadsheetApp.openById(SHEET_ID), sheetKey.toUpperCase()).deleteRow(fila);
  return { ok: true, msg: "Fila " + fila + " eliminada" };
}

// ─────────────────────────────────────────────────────────────
//  USUARIOS
//  Pestaña: 👥 USUARIOS → [1]=# [2]=NOMBRE [3]=ACTIVO
// ─────────────────────────────────────────────────────────────
function getUsuarios() {
  try {
    var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "USUARIOS");
    var data = sh.getDataRange().getValues();
    var result = [];
    for (var i = DATA_START_ROW - 1; i < data.length; i++) {
      var r = data[i];
      if (!r[2]) continue;
      if (String(r[3]).trim() !== "✅") continue;
      result.push({ fila: i+1, nombre: String(r[2]).trim() });
    }
    return { ok: true, data: result };
  } catch(e) {
    // Si no existe la pestaña, devolver fallback
    return { ok: true, data: [
      { fila: 5, nombre: "Persona 1" },
      { fila: 6, nombre: "Persona 2" }
    ], fallback: true };
  }
}

// ─────────────────────────────────────────────────────────────
//  CATEGORÍAS
//  Pestaña: 🏷️ CATEGORIAS → [1]=# [2]=NOMBRE [3]=ICONO [4]=ACTIVO
// ─────────────────────────────────────────────────────────────
function getCategorias() {
  try {
    var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "CATEGORIAS");
    var data = sh.getDataRange().getValues();
    var result = [];
    for (var i = DATA_START_ROW - 1; i < data.length; i++) {
      var r = data[i];
      if (!r[2]) continue;
      if (String(r[4]).trim() !== "✅") continue;
      result.push({
        fila: i+1,
        nombre: String(r[2]).trim(),
        icono:  String(r[3] || "inventory_2").trim()
      });
    }
    return { ok: true, data: result };
  } catch(e) {
    return { ok: true, data: [
      {fila:5,nombre:"Alimentación",icono:"restaurant"},
      {fila:6,nombre:"Transporte",icono:"directions_car"},
      {fila:7,nombre:"Ocio",icono:"movie"},
      {fila:8,nombre:"Salud",icono:"local_hospital"},
      {fila:9,nombre:"Ropa",icono:"checkroom"},
      {fila:10,nombre:"Tecnología",icono:"laptop"},
      {fila:11,nombre:"Hogar",icono:"home"},
      {fila:12,nombre:"Suministros",icono:"bolt"},
      {fila:13,nombre:"Otros",icono:"inventory_2"}
    ], fallback: true };
  }
}

function addCategoria(p) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "CATEGORIAS");
  var newRow = getLastDataRow(sh) + 1;
  sh.getRange(newRow, 2, 1, 4).setValues([[
    "", p.nombre || "Nueva", p.icono || "inventory_2", "✅"
  ]]);
  return { ok: true, msg: "Categoría añadida" };
}

function deleteCategoria(fila) {
  getSheet(SpreadsheetApp.openById(SHEET_ID), "CATEGORIAS").deleteRow(fila);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────
function getLastDataRow(sheet) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= DATA_START_ROW - 1; i--) {
    if (data[i].some(function(c) { return c !== ""; })) return i + 1;
  }
  return DATA_START_ROW;
}

// Soporta tanto JSON normal como JSONP (para evitar CORS desde GitHub Pages)
function jsonResponse(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback) {
    // JSONP: envuelve la respuesta en la función callback
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
//  CONTROL FINANCIERO DEL HOGAR — Google Apps Script Backend
//  Pega este código en: script.google.com → nuevo proyecto
//  ⚠️ IMPORTANTE: Haz "Nueva implementación" cada vez que lo cambies
// ============================================================

// ⚠️ CAMBIA ESTE ID por el de TU Google Sheet
var SHEET_ID = "PON_AQUI_EL_ID_DE_TU_GOOGLE_SHEET";

// Fila donde empiezan los datos (fila 5 en tu plantilla)
var DATA_START_ROW = 5;

// ─────────────────────────────────────────────────────────────
//  PUNTO DE ENTRADA
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var action   = e.parameter.action   || "";
    var callback = e.parameter.callback || "";
    var result;

    switch (action) {
      case "ping":
        result = { ok: true, msg: "Conexión correcta ✅" };
        break;
      case "getSummary":
        result = getSummary(e.parameter.mes, parseInt(e.parameter.anio));
        break;
      case "getDiarios":
        result = getDiarios(e.parameter.mes, parseInt(e.parameter.anio));
        break;
      case "getIngresos":
        result = getIngresos(e.parameter.mes, parseInt(e.parameter.anio));
        break;
      case "getRecurrentes":
        result = getRecurrentes();
        break;
      case "getUsuarios":
        result = getUsuarios();
        break;
      case "getCategorias":
        result = getCategorias();
        break;
      case "addDiario":
        result = addDiario(e.parameter);
        break;
      case "addIngreso":
        result = addIngreso(e.parameter);
        break;
      case "addRecurrente":
        result = addRecurrente(e.parameter);
        break;
      case "toggleRecurrente":
        result = toggleRecurrente(parseInt(e.parameter.fila), e.parameter.estado);
        break;
      case "deleteRow":
        result = deleteRow(e.parameter.sheet, parseInt(e.parameter.fila));
        break;
      case "addCategoria":
        result = addCategoria(e.parameter.nombre, e.parameter.icono);
        break;
      case "deleteCategoria":
        result = deleteCategoriaRow(parseInt(e.parameter.fila));
        break;
      default:
        result = { ok: false, error: "Acción desconocida: " + action };
    }

    return jsonResponse(result, callback);

  } catch (err) {
    var cb = (e && e.parameter && e.parameter.callback) || "";
    return jsonResponse({ ok: false, error: err.toString() }, cb);
  }
}

// ─────────────────────────────────────────────────────────────
//  USUARIOS — pestaña 👥 USUARIOS
//  Columnas: B=# C=NOMBRE D=ACTIVO(✅/❌)
// ─────────────────────────────────────────────────────────────
function getUsuarios() {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "usuarios");
  if (!sh) return { ok: false, msg: "Pestaña USUARIOS no encontrada" };
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    var nombre = String(r[2] || "").trim();
    if (!nombre) continue;
    if (String(r[3] || "").trim() === "❌") continue;
    result.push({ fila: i + 1, nombre: nombre });
  }
  return { ok: true, data: result };
}

// ─────────────────────────────────────────────────────────────
//  CATEGORÍAS — pestaña 🏷️ CATEGORIAS
//  Columnas: B=# C=NOMBRE D=ICONO E=ACTIVO
// ─────────────────────────────────────────────────────────────
function getCategorias() {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "categorias");
  if (!sh) return { ok: false, msg: "Pestaña CATEGORIAS no encontrada" };
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    var nombre = String(r[2] || "").trim();
    if (!nombre) continue;
    if (String(r[4] || "").trim() === "❌") continue;
    result.push({ fila: i + 1, nombre: nombre, icono: String(r[3] || "inventory_2").trim() });
  }
  return { ok: true, data: result };
}

function addCategoria(nombre, icono) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "categorias");
  if (!sh) return { ok: false, msg: "Pestaña CATEGORIAS no encontrada" };
  // Buscar la primera fila vacía dentro del rango de datos (desde DATA_START_ROW)
  var data = sh.getDataRange().getValues();
  var insertRow = -1;
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var nombre_celda = String(data[i][2] || "").trim();
    if (!nombre_celda) { insertRow = i + 1; break; }
  }
  // Si no hay hueco, añadir al final
  if (insertRow === -1) insertRow = getLastDataRow(sh) + 1;
  // Calcular el número # (posición en la lista)
  var num = insertRow - DATA_START_ROW + 1;
  sh.getRange(insertRow, 2, 1, 4).setValues([[num, nombre || "", icono || "inventory_2", "✅"]]);
  return { ok: true, msg: "Categoría añadida en fila " + insertRow };
}

function deleteCategoriaRow(fila) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "categorias");
  if (!sh) return { ok: false, msg: "Hoja no encontrada" };
  sh.deleteRow(fila);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
//  RESUMEN DEL MES
// ─────────────────────────────────────────────────────────────
function getSummary(mes, anio) {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Leer nombres reales de usuarios
  var usrs = getUsuarios();
  var n1 = (usrs.ok && usrs.data[0]) ? usrs.data[0].nombre : "";
  var n2 = (usrs.ok && usrs.data[1]) ? usrs.data[1].nombre : "";

  var shIngresos   = getSheet(ss, "ingresos");
  var dataIngresos = shIngresos.getDataRange().getValues();
  var totalIngresos = 0, ingP1 = 0, ingP2 = 0;
  for (var i = DATA_START_ROW - 1; i < dataIngresos.length; i++) {
    var row = dataIngresos[i];
    if (row[2] == mes && parseInt(row[3]) == anio) {
      var imp = parseFloat(row[6]) || 0;
      totalIngresos += imp;
      if (n1 && row[4] == n1) ingP1 += imp;
      if (n2 && row[4] == n2) ingP2 += imp;
    }
  }

  var shRec   = getSheet(ss, "recurrentes");
  var dataRec = shRec.getDataRange().getValues();
  var MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var totalRec = 0, recPorCat = {};
  for (var i = DATA_START_ROW - 1; i < dataRec.length; i++) {
    var row = dataRec[i];
    if (row[7] !== "✅" || !(parseFloat(row[4]) > 0)) continue;
    var frec      = String(row[6] || "Mensual").trim();
    var mesInicio = String(row[8] || "").trim();
    // Comprobar si toca cobrar este mes
    var toca = true;
    if (frec !== "Mensual" && frec !== "Quincenal" && mesInicio) {
      var idxActual = MESES_ES.indexOf(mes);
      var idxInicio = MESES_ES.indexOf(mesInicio);
      if (idxActual !== -1 && idxInicio !== -1) {
        var diff = ((idxActual - idxInicio) % 12 + 12) % 12;
        if (frec === "Trimestral") toca = diff % 3 === 0;
        else if (frec === "Semestral")  toca = diff % 6 === 0;
        else if (frec === "Anual")      toca = diff === 0;
      }
    }
    if (!toca) continue;
    var imp = parseFloat(row[4]) || 0;
    totalRec += imp;
    var cat = row[3] || "Otros";
    recPorCat[cat] = (recPorCat[cat] || 0) + imp;
  }

  var shDiarios   = getSheet(ss, "diarios");
  var dataDiarios = shDiarios.getDataRange().getValues();
  var totalDiarios = 0, diasPorCat = {};
  for (var i = DATA_START_ROW - 1; i < dataDiarios.length; i++) {
    var row = dataDiarios[i];
    if (row[2] == mes && parseInt(row[3]) == anio && parseFloat(row[7]) > 0) {
      var imp = parseFloat(row[7]) || 0;
      var cat = row[5] || "Otros";
      totalDiarios += imp;
      diasPorCat[cat] = (diasPorCat[cat] || 0) + imp;
    }
  }

  var allCats = {};
  Object.keys(recPorCat).forEach(function(c)  { allCats[c] = true; });
  Object.keys(diasPorCat).forEach(function(c) { allCats[c] = true; });
  var porCat = {};
  Object.keys(allCats).forEach(function(c) {
    porCat[c] = {
      recurrente: recPorCat[c]  || 0,
      diario:     diasPorCat[c] || 0,
      total:      (recPorCat[c] || 0) + (diasPorCat[c] || 0)
    };
  });

  var totalGastos = totalRec + totalDiarios;
  return {
    ok: true, mes: mes, anio: anio,
    ingresos: { total: totalIngresos, persona1: ingP1, persona2: ingP2 },
    gastos:   { total: totalGastos, recurrentes: totalRec, diarios: totalDiarios },
    balance:  totalIngresos - totalGastos,
    ahorro_pct: totalIngresos > 0 ? (totalIngresos - totalGastos) / totalIngresos : 0,
    por_categoria: porCat
  };
}

// ─────────────────────────────────────────────────────────────
//  GASTOS DIARIOS
// ─────────────────────────────────────────────────────────────
function getDiarios(mes, anio) {
  var sh   = getSheet(SpreadsheetApp.openById(SHEET_ID), "diarios");
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2] && !r[7]) continue;
    if (mes  && r[2] != mes)           continue;
    if (anio && parseInt(r[3]) != anio) continue;
    result.push({
      fila: i + 1,
      mes: r[2], anio: r[3], fecha: r[4],
      categoria: r[5], descripcion: r[6],
      importe: parseFloat(r[7]) || 0,
      quien: r[8], pago: r[9], notas: r[10]
    });
  }
  return { ok: true, data: result.reverse() };
}

function addDiario(p) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "diarios");
  var newRow = getLastDataRow(sh) + 1;
  sh.getRange(newRow, 2, 1, 10).setValues([[
    "", p.mes || "", parseInt(p.anio) || new Date().getFullYear(),
    p.fecha || Utilities.formatDate(new Date(), "Europe/Madrid", "dd/MM/yyyy"),
    p.categoria || "Otros", p.descripcion || "",
    parseFloat(p.importe) || 0,
    p.quien || "", p.pago || "Tarjeta", p.notas || ""
  ]]);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
//  INGRESOS
// ─────────────────────────────────────────────────────────────
function getIngresos(mes, anio) {
  var sh   = getSheet(SpreadsheetApp.openById(SHEET_ID), "ingresos");
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2] && !r[6]) continue;
    if (mes  && r[2] != mes)           continue;
    if (anio && parseInt(r[3]) != anio) continue;
    result.push({
      fila: i + 1,
      mes: r[2], anio: r[3],
      persona: r[4], concepto: r[5],
      importe: parseFloat(r[6]) || 0, notas: r[7]
    });
  }
  return { ok: true, data: result };
}

function addIngreso(p) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "ingresos");
  var newRow = getLastDataRow(sh) + 1;
  sh.getRange(newRow, 2, 1, 7).setValues([[
    "", p.mes || "", parseInt(p.anio) || new Date().getFullYear(),
    p.persona || "", p.concepto || "Sueldo neto",
    parseFloat(p.importe) || 0, p.notas || ""
  ]]);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
//  RECURRENTES
// ─────────────────────────────────────────────────────────────
function getRecurrentes() {
  var sh   = getSheet(SpreadsheetApp.openById(SHEET_ID), "recurrentes");
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2] && !r[4]) continue;
    result.push({
      fila: i + 1,
      nombre: r[2], categoria: r[3],
      importe: parseFloat(r[4]) || 0,
      dia_cobro: r[5], frecuencia: r[6],
      activo: r[7], mes_inicio: String(r[8]||'').trim(), notas: String(r[9]||'').trim()
    });
  }
  return { ok: true, data: result };
}

function addRecurrente(p) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "recurrentes");
  var newRow = getLastDataRow(sh) + 1;
  sh.getRange(newRow, 2, 1, 9).setValues([[
    "", p.nombre || "", p.categoria || "Otros",
    parseFloat(p.importe) || 0, parseInt(p.dia_cobro) || 1,
    p.frecuencia || "Mensual", p.activo || "✅",
    p.mes_inicio || "", p.notas || ""
  ]]);
  return { ok: true };
}

function toggleRecurrente(fila, estado) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), "recurrentes");
  sh.getRange(fila, 8).setValue(estado);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
//  BORRAR FILA
// ─────────────────────────────────────────────────────────────
function deleteRow(sheetKey, fila) {
  var sh = getSheet(SpreadsheetApp.openById(SHEET_ID), sheetKey);
  if (!sh) return { ok: false, error: "Hoja no encontrada: " + sheetKey };
  sh.deleteRow(fila);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
//  UTILIDADES
// ─────────────────────────────────────────────────────────────
function getSheet(ss, keyword) {
  var kw = keyword.toLowerCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().indexOf(kw) !== -1) {
      return sheets[i];
    }
  }
  return null;
}

function getLastDataRow(sheet) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= DATA_START_ROW - 1; i--) {
    if (data[i].some(function(c) { return c !== ""; })) return i + 1;
  }
  return DATA_START_ROW;
}

// Responde JSON o JSONP según parámetro callback
function jsonResponse(obj, callback) {
  var json = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

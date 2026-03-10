// ============================================================
//  CONTROL FINANCIERO DEL HOGAR — Google Apps Script Backend
//  Pega este código en: script.google.com → nuevo proyecto
// ============================================================

// ⚠️ CAMBIA ESTE ID por el de TU Google Sheet
// Lo encuentras en la URL: docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
var SHEET_ID = "PON_AQUI_EL_ID_DE_TU_GOOGLE_SHEET";

// Nombres de las pestañas (deben coincidir exactamente con tu hoja)
var SHEETS = {
  ingresos:     "💰 INGRESOS",
  recurrentes:  "📅 RECURRENTES",
  diarios:      "🛒 DIARIOS"
};

// Fila donde empiezan los datos (fila 5 en tu plantilla)
var DATA_START_ROW = 5;

// ─────────────────────────────────────────────────────────────
//  PUNTO DE ENTRADA — todas las peticiones pasan por aquí
// ─────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var action = e.parameter.action || "";
    var result;

    switch (action) {
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
      case "ping":
        result = { ok: true, msg: "Conexión correcta ✅" };
        break;
      default:
        result = { error: "Acción desconocida: " + action };
    }

    return jsonResponse(result);

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

// ─────────────────────────────────────────────────────────────
//  RESUMEN DEL MES
// ─────────────────────────────────────────────────────────────
function getSummary(mes, anio) {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  // Ingresos del mes
  var shIngresos = ss.getSheetByName(SHEETS.ingresos);
  var dataIngresos = shIngresos.getDataRange().getValues();
  var totalIngresos = 0, ingP1 = 0, ingP2 = 0;
  for (var i = DATA_START_ROW - 1; i < dataIngresos.length; i++) {
    var row = dataIngresos[i];
    if (row[2] == mes && parseInt(row[3]) == anio) { // C=MES D=AÑO (índices 2,3)
      var imp = parseFloat(row[6]) || 0; // G=IMPORTE (índice 6)
      totalIngresos += imp;
      if (row[4] == "Persona 1") ingP1 += imp; // E=PERSONA (índice 4)
      if (row[4] == "Persona 2") ingP2 += imp;
    }
  }

  // Recurrentes activos
  var shRec = ss.getSheetByName(SHEETS.recurrentes);
  var dataRec = shRec.getDataRange().getValues();
  var totalRec = 0;
  var recPorCat = {};
  for (var i = DATA_START_ROW - 1; i < dataRec.length; i++) {
    var row = dataRec[i];
    if (row[6] == "✅" && parseFloat(row[4]) > 0) { // H=ACTIVO(índice 6), E=IMPORTE(índice 4) -- B=# C=NOMBRE D=CAT E=IMP F=DIA G=FREC H=ACTIVO
      var imp = parseFloat(row[4]) || 0;
      var cat = row[3] || "Otros"; // D=CATEGORÍA (índice 3) -- wait, B=# is index 1, C=NOMBRE index 2, D=CAT index 3, E=IMP index 4
      totalRec += imp;
      recPorCat[cat] = (recPorCat[cat] || 0) + imp;
    }
  }

  // Gastos diarios del mes
  var shDiarios = ss.getSheetByName(SHEETS.diarios);
  var dataDiarios = shDiarios.getDataRange().getValues();
  var totalDiarios = 0;
  var diasPorCat = {};
  for (var i = DATA_START_ROW - 1; i < dataDiarios.length; i++) {
    var row = dataDiarios[i];
    // B=# C=MES D=AÑO E=FECHA F=CAT G=DESC H=IMP I=QUIEN J=PAGO K=NOTAS
    // índices: 1=# 2=MES 3=AÑO 4=FECHA 5=CAT 6=DESC 7=IMP 8=QUIEN 9=PAGO 10=NOTAS
    if (row[2] == mes && parseInt(row[3]) == anio && parseFloat(row[7]) > 0) {
      var imp = parseFloat(row[7]) || 0;
      var cat = row[5] || "Otros";
      totalDiarios += imp;
      diasPorCat[cat] = (diasPorCat[cat] || 0) + imp;
    }
  }

  // Combinar categorías
  var cats = ["Hogar","Suministros","Alimentación","Transporte","Ocio","Salud","Ropa","Tecnología","Otros"];
  var porCat = {};
  cats.forEach(function(c) {
    porCat[c] = {
      recurrente: recPorCat[c] || 0,
      diario: diasPorCat[c] || 0,
      total: (recPorCat[c] || 0) + (diasPorCat[c] || 0)
    };
  });

  var totalGastos = totalRec + totalDiarios;
  return {
    mes: mes, anio: anio,
    ingresos: { total: totalIngresos, persona1: ingP1, persona2: ingP2 },
    gastos: { total: totalGastos, recurrentes: totalRec, diarios: totalDiarios },
    balance: totalIngresos - totalGastos,
    ahorro_pct: totalIngresos > 0 ? ((totalIngresos - totalGastos) / totalIngresos) : 0,
    por_categoria: porCat
  };
}

// ─────────────────────────────────────────────────────────────
//  GASTOS DIARIOS
// ─────────────────────────────────────────────────────────────
function getDiarios(mes, anio) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.diarios);
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2] && !r[7]) continue; // fila vacía
    if (mes && r[2] != mes) continue;
    if (anio && parseInt(r[3]) != anio) continue;
    result.push({
      fila: i + 1,
      mes: r[2], anio: r[3], fecha: r[4],
      categoria: r[5], descripcion: r[6],
      importe: parseFloat(r[7]) || 0,
      quien: r[8], pago: r[9], notas: r[10]
    });
  }
  return { ok: true, data: result.reverse() }; // más recientes primero
}

function addDiario(p) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.diarios);
  var lastRow = getLastDataRow(sh);
  var newRow = lastRow + 1;
  sh.getRange(newRow, 2, 1, 10).setValues([[
    "", // # auto
    p.mes || "", parseInt(p.anio) || new Date().getFullYear(),
    p.fecha || Utilities.formatDate(new Date(), "Europe/Madrid", "dd/MM/yyyy"),
    p.categoria || "Otros",
    p.descripcion || "",
    parseFloat(p.importe) || 0,
    p.quien || "Persona 1",
    p.pago || "Tarjeta",
    p.notas || ""
  ]]);
  return { ok: true, msg: "Gasto añadido en fila " + newRow };
}

// ─────────────────────────────────────────────────────────────
//  INGRESOS
// ─────────────────────────────────────────────────────────────
function getIngresos(mes, anio) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ingresos);
  var data = sh.getDataRange().getValues();
  var result = [];
  for (var i = DATA_START_ROW - 1; i < data.length; i++) {
    var r = data[i];
    if (!r[2] && !r[6]) continue;
    if (mes && r[2] != mes) continue;
    if (anio && parseInt(r[3]) != anio) continue;
    result.push({
      fila: i + 1,
      mes: r[2], anio: r[3],
      persona: r[4], concepto: r[5],
      importe: parseFloat(r[6]) || 0,
      notas: r[7]
    });
  }
  return { ok: true, data: result };
}

function addIngreso(p) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.ingresos);
  var lastRow = getLastDataRow(sh);
  var newRow = lastRow + 1;
  sh.getRange(newRow, 2, 1, 7).setValues([[
    "", // # auto
    p.mes || "", parseInt(p.anio) || new Date().getFullYear(),
    p.persona || "Persona 1",
    p.concepto || "Sueldo neto",
    parseFloat(p.importe) || 0,
    p.notas || ""
  ]]);
  return { ok: true, msg: "Ingreso añadido en fila " + newRow };
}

// ─────────────────────────────────────────────────────────────
//  RECURRENTES
// ─────────────────────────────────────────────────────────────
function getRecurrentes() {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.recurrentes);
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
      activo: r[7], notas: r[8]
    });
  }
  return { ok: true, data: result };
}

function addRecurrente(p) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.recurrentes);
  var lastRow = getLastDataRow(sh);
  var newRow = lastRow + 1;
  sh.getRange(newRow, 2, 1, 8).setValues([[
    "", p.nombre || "", p.categoria || "Otros",
    parseFloat(p.importe) || 0,
    parseInt(p.dia_cobro) || 1,
    p.frecuencia || "Mensual",
    p.activo || "✅",
    p.notas || ""
  ]]);
  return { ok: true, msg: "Recurrente añadido" };
}

function toggleRecurrente(fila, estado) {
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEETS.recurrentes);
  sh.getRange(fila, 8).setValue(estado); // columna H = activo
  return { ok: true, msg: "Estado actualizado a " + estado };
}

// ─────────────────────────────────────────────────────────────
//  BORRAR FILA
// ─────────────────────────────────────────────────────────────
function deleteRow(sheetName, fila) {
  var sheetMap = {
    "diarios": SHEETS.diarios,
    "ingresos": SHEETS.ingresos,
    "recurrentes": SHEETS.recurrentes
  };
  var sh = SpreadsheetApp.openById(SHEET_ID).getSheetByName(sheetMap[sheetName]);
  if (!sh) return { error: "Hoja no encontrada: " + sheetName };
  sh.deleteRow(fila);
  return { ok: true, msg: "Fila " + fila + " eliminada" };
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

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

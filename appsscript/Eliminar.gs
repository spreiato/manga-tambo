function eliminarRegistrosPorFechaVenta() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), ui=SpreadsheetApp.getUi();
  var filtro=ss.getSheetByName('Eliminar por Venta'), base=ss.getSheetByName('Base_Rodeo');
  if(!filtro || !base){ui.alert('No se encontró Eliminar por Venta o Base_Rodeo. No se eliminó nada.');return;}
  var fecha=filtro.getRange('B1').getDisplayValue().trim();
  var rows=base.getLastRow()>1?base.getRange(2,1,base.getLastRow()-1,15).getValues():[];
  var selected;
  try {selected=tamboFilasVenta_(rows,fecha);} catch(e){ui.alert('Fecha inválida. No se eliminó nada.');return;}
  if(!selected.length){ui.alert('No hay animales con Fecha Venta '+fecha+'.');return;}
  var ids=selected.map(function(r){return String(rows[r-2][0]);});
  if(ui.alert('Confirmación de eliminación','Se eliminarán '+selected.length+' animales cuya Fecha Venta (columna H) es '+fecha+'.\nPrimeras identificaciones: '+ids.slice(0,5).join(', '),ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(15000)){ui.alert('Servidor ocupado. No se eliminó nada.');return;}
  try {
    var current=base.getLastRow()>1?base.getRange(2,1,base.getLastRow()-1,15).getValues():[];
    var recheck=tamboFilasVenta_(current,fecha);
    if(JSON.stringify(recheck)!==JSON.stringify(selected) || JSON.stringify(recheck.map(function(r){return String(current[r-2][0]);}))!==JSON.stringify(ids)){ui.alert('La base cambió durante la confirmación. Revise y vuelva a intentar. No se eliminó nada.');return;}
    selected.forEach(function(r){base.deleteRow(r);});
    SpreadsheetApp.flush();ui.alert('Se eliminaron '+selected.length+' registros por Fecha Venta.');
  } finally {lock.releaseLock();}
}

/* Mantenimiento acotado de consultas: no modifica filas de Base_Rodeo. */
function ampliarConsultasMangaTambo() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(), base=ss.getSheetByName('Base_Rodeo');
  if(!base)throw new Error('No existe Base_Rodeo.');
  var targets=[['Categoria','A4'],['Categoria','B4'],['Fecha_Venta','A4'],['Fecha_Venta','B4']];
  var changes=[];
  targets.forEach(function(t){
    var sheet=ss.getSheetByName(t[0]);if(!sheet)throw new Error('Falta '+t[0]);
    var cell=sheet.getRange(t[1]),before=cell.getFormula();
    if(!before)throw new Error('No hay formula en '+t.join('!'));
    var after=before.replace(/(Base_Rodeo!\$?[A-Z]+\$?2:\$?[A-Z]+)\$?1000\b/g,'$1');
    if(before!==after)changes.push({sheet:t[0],cell:t[1],before:before,after:after});
  });
  var category=ss.getSheetByName('Categoria').getRange('B1'), rule=category.getDataValidation();
  var validation=rule && rule.getCriteriaType()===SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE;
  var props=PropertiesService.getScriptProperties();
  if(!props.getProperty('respaldo_consultas_20261024'))props.setProperty('respaldo_consultas_20261024',JSON.stringify({changes:changes,validationRange:validation?rule.getCriteriaValues()[0].getA1Notation():null,createdAt:new Date().toISOString()}));
  changes.forEach(function(c){ss.getSheetByName(c.sheet).getRange(c.cell).setFormula(c.after);});
  if(validation){var values=rule.getCriteriaValues();category.setDataValidation(rule.copy().withCriteria(SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE,[base.getRange('E2:E'),values[1]]).build());}
  SpreadsheetApp.flush();
  console.log(JSON.stringify({formulasActualizadas:changes.length,validacionAmpliada:!!validation,filasBase:base.getLastRow(),sinCambiosEnDatos:true}));
}

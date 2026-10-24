/* Manga Tambo — protocolo confirmado v1. Mantiene Base_Rodeo y las columnas existentes. */
function doGet(e) {
  return tamboJson_({status:'success', protocol:1, release:'2026-10-24.3', service:'Manga Tambo'});
}
function doPost(e) {
  var lock = LockService.getScriptLock(), locked = false;
  try {
    var p = JSON.parse(e && e.postData && e.postData.contents || '{}');
    if (p.action === 'salud') return doGet(e);
    if (!lock.tryLock(15000)) throw new Error('Servidor ocupado. Las lecturas deben seguir pendientes.');
    locked = true;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss && ss.getSheetByName('Base_Rodeo');
    if (!sheet) throw new Error('No existe Base_Rodeo; no se utilizara otra hoja.');
    var config = ss.getSheetByName('Manga_Dinamica');
    var defaults = config ? config.getRange('C10:C14').getDisplayValues().map(function(r){return r[0];}) : [];
    var rows = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,15).getValues() : [];
    var plan = tamboPlan_(p,rows,defaults);
    if (p.dryRun === true) return tamboJson_({status:'success', protocol:1, dryRun:true, module:plan.module, results:plan.results, writes:plan.writes.length, additions:plan.additions.length});
    plan.writes.forEach(function(w){
      var cell = sheet.getRange(w.row,w.column);
      if (w.column === 6) cell.setNumberFormat('@').setValue(w.value);
      else cell.setValue(tamboDate_(w.value)).setNumberFormat('dd/MM/yyyy');
    });
    if (plan.additions.length) {
      var start = Math.max(2,sheet.getLastRow()+1);
      sheet.getRange(start,1,plan.additions.length,1).setNumberFormat('@');
      sheet.getRange(start,6,plan.additions.length,1).setNumberFormat('@');
      sheet.getRange(start,1,plan.additions.length,15).setValues(plan.additions);
    }
    SpreadsheetApp.flush();
    return tamboJson_({status:'success', protocol:1, module:plan.module, results:plan.results});
  } catch(err) {
    return tamboJson_({status:'error', protocol:1, message:String(err.message || err), results:[]});
  } finally { if (locked) lock.releaseLock(); }
}
function tamboJson_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function tamboId_(value) {
  if (typeof value !== 'string') throw new Error('La identificacion debe enviarse como texto.');
  var id = value.trim().replace(/^'+/, '');
  if (!id || id.length > 128 || !/^[a-zA-Z0-9 .\/_-]+$/.test(id)) throw new Error('Identificacion invalida.');
  return id;
}
function tamboKey_(value) { return String(value).trim().replace(/[^a-zA-Z0-9]/g,''); }
function tamboDate_(value) {
  var match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value));
  if (!match) throw new Error('Fecha invalida; se requiere dd/mm/aaaa.');
  var d = new Date(Number(match[3]),Number(match[2])-1,Number(match[1]),0,0,0);
  if (d.getFullYear()!==Number(match[3]) || d.getMonth()!==Number(match[2])-1 || d.getDate()!==Number(match[1])) throw new Error('Fecha inexistente.');
  return d;
}
/* Plan puro: permite simular operaciones sin acceso a la planilla ni escrituras. */
function tamboPlan_(p,rows,defaults) {
  var module = p.module || 'inseminacion'; // Compatibilidad con la URL anterior de Inseminacion.
  var columns = {ventas:8,brucelosis:9,fc_vacias:11,fc_llenas:12,inseminacion:13,vacunacion:14,traslado:6};
  if (module!=='manga' && !Object.prototype.hasOwnProperty.call(columns,module)) throw new Error('Modulo desconocido.');
  var action = p.action || 'sincronizar';
  if (action!=='sincronizar' && !(module!=='manga' && action==='validar')) throw new Error('Accion desconocida.');
  if (!Array.isArray(p.lecturas) || (p.protocol===1 && p.lecturas.length>200)) throw new Error('Lote invalido.');
  var index = Object.create(null), ambiguous = Object.create(null);
  rows.forEach(function(row,i){
    if (row[0] === '' || row[0] == null) return;
    var key=tamboKey_(row[0]);
    if (Object.prototype.hasOwnProperty.call(index,key)) ambiguous[key]=true;
    else index[key]=i+2;
  });
  var result={module:module,results:[],writes:[],additions:[]};
  p.lecturas.forEach(function(item){
    var token = item && item.token;
    try {
      if (!item || (token!=null && (typeof token!=='string' || token.length>512))) throw new Error('Registro invalido.');
      var id=tamboId_(item.id), key=tamboKey_(id), row=index[key];
      if (ambiguous[key]) throw new Error('Identificacion ambigua en Base_Rodeo.');
      var canCreate=module==='manga' || action==='validar';
      if (!row && !canCreate) {
        result.results.push({id:id,token:token,status:'not_found',message:'Caravana inexistente en Base_Rodeo'});
        return;
      }
      if (!row) {
        var newRow;
        if (module==='manga') {
          if (defaults.length!==5 || defaults.some(function(v){return !String(v).trim();})) throw new Error('Complete los valores por defecto en Manga_Dinamica C10:C14.');
          newRow=["'"+id,defaults[1],defaults[0],defaults[2],defaults[3],defaults[4],'','','','','','','','',''];
        } else {
          tamboDate_(item.fecha);
          // Conserva los valores de alta ya definidos en la funcion Validar original.
          newRow=["'"+id,'Hembra','28/08/2026','Aberdinangus','Vacas','01028000324/02',450,'','','','','',module==='inseminacion'?tamboDate_(item.fecha):'','','registros no leidos'];
        }
        result.additions.push(newRow);
        index[key]=rows.length+1+result.additions.length;
      } else if (module!=='manga' && action!=='validar') {
        var value=item.fecha;
        if (module==='traslado') {
          value=String(item.renspa||'').trim();
          if (!/^[0-9/.-]{4,40}$/.test(value)) throw new Error('RENSPA invalido.');
        } else tamboDate_(value);
        result.writes.push({row:row,column:columns[module],value:value});
      }
      result.results.push({id:id,token:token,status:'confirmed'});
    } catch(err) {
      result.results.push({id:item && item.id,token:token,status:'error',message:String(err.message || err)});
    }
  });
  return result;
}
/* Solo compara Fecha Venta (H). No elimina por coincidencias en otras columnas. */
function tamboFilasVenta_(rows,fecha) {
  var target=tamboDate_(fecha), time=target.getTime();
  return rows.map(function(row,i){
    var value=row[7];
    if (value instanceof Date && !isNaN(value)) value=new Date(value.getFullYear(),value.getMonth(),value.getDate(),0,0,0).getTime();
    else { try {value=tamboDate_(value).getTime();} catch(e){value=null;} }
    return value===time ? i+2 : null;
  }).filter(function(row){return row!==null;}).reverse();
}

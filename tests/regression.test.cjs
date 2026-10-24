const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(path.join(root,'appsscript/Tambo.gs'),'utf8');
const ctx=vm.createContext({Date,JSON});vm.runInContext(code,ctx);
const plain=v=>JSON.parse(JSON.stringify(v));
const row=(id)=>{const r=Array(15).fill('');r[0]=id;return r;};
const item={id:'032010012894925',fecha:'24/10/2026',token:'token-1'};
const defaults=['24/10/2026','Hembra','Raza','Vacas','01028000324/02'];
for(const [module,column] of Object.entries({ventas:8,brucelosis:9,fc_vacias:11,fc_llenas:12,inseminacion:13,vacunacion:14,traslado:6})){
 test(module+' modifica solo la columna prevista',()=>{
  const rows=[row(item.id)],before=JSON.stringify(rows);
  const p=plain(ctx.tamboPlan_({module,lecturas:[{...item,renspa:'01028000324/02'}]},rows,defaults));
  assert.equal(p.writes.length,1);assert.equal(p.writes[0].column,column);assert.equal(p.results[0].status,'confirmed');assert.equal(p.additions.length,0);assert.equal(JSON.stringify(rows),before);
 });
 test(module+' conserva faltantes sin crear filas incompletas',()=>{
  const p=plain(ctx.tamboPlan_({module,lecturas:[item]},[],defaults));assert.equal(p.results[0].status,'not_found');assert.equal(p.writes.length,0);assert.equal(p.additions.length,0);
 });
}
test('Manga crea alta completa y evita duplicados en el lote',()=>{const p=plain(ctx.tamboPlan_({module:'manga',lecturas:[item,item]},[],defaults));assert.equal(p.additions.length,1);assert.equal(p.additions[0].length,15);assert.equal(p.additions[0][0],item.id);assert.equal(p.additions[0][5],defaults[4]);});
test('Manga exige configuracion antes de dar altas',()=>{const p=plain(ctx.tamboPlan_({module:'manga',lecturas:[item]},[],[]));assert.equal(p.additions.length,0);assert.equal(p.results[0].status,'error');});
test('Validar admite faltantes y mantiene los valores originales',()=>{const p=plain(ctx.tamboPlan_({module:'inseminacion',action:'validar',lecturas:[item]},[],defaults));assert.equal(p.additions.length,1);assert.equal(p.additions[0][1],'Hembra');assert.equal(p.additions[0][14],'registros no leidos');});
test('Validar existente no pisa fechas ni atributos',()=>{const p=plain(ctx.tamboPlan_({module:'inseminacion',action:'validar',lecturas:[item]},[row(item.id)],defaults));assert.equal(p.writes.length,0);assert.equal(p.additions.length,0);});
test('Cliente anterior de Inseminacion sigue reconocido',()=>{const p=plain(ctx.tamboPlan_({lecturas:[item]},[row(item.id)],defaults));assert.equal(p.module,'inseminacion');assert.equal(p.writes[0].column,13);});
test('Identificaciones numericas no pierden ceros mediante conversion',()=>{const p=plain(ctx.tamboPlan_({module:'vacunacion',lecturas:[{...item,id:32010012894925}]},[],defaults));assert.equal(p.results[0].status,'error');assert.equal(p.additions.length,0);});
test('Duplicados ambiguos no actualizan un animal al azar',()=>{const p=plain(ctx.tamboPlan_({module:'vacunacion',lecturas:[item]},[row(item.id),row(item.id)],defaults));assert.equal(p.results[0].status,'error');assert.equal(p.writes.length,0);});
test('Fechas invalidas no actualizan celdas',()=>{const p=plain(ctx.tamboPlan_({module:'ventas',lecturas:[{...item,fecha:'31/02/2026'}]},[row(item.id)],defaults));assert.equal(p.results[0].status,'error');assert.equal(p.writes.length,0);});
test('Solo una venta en H selecciona filas para eliminar',()=>{const a=row('A'),b=row('B'),c=row('C');a[2]='24/10/2026';b[7]='24/10/2026';c[13]='24/10/2026';assert.deepEqual(plain(ctx.tamboFilasVenta_([a,b,c],'24/10/2026')),[3]);});
test('Ningun modulo no autorizado escribe',()=>{for(const module of ['__proto__','constructor','desconocido'])assert.throws(()=>ctx.tamboPlan_({module,lecturas:[item]},[],defaults));});
const pages=['index.html','ventas/ventas.html','fc_vacias/index_fc_vacias.html','fc_llenas/index_fc_llenas.html','inseminacion/index_inseminacion.html','vacunacion/index_vacunacion.html','traslado/traslado.html','brucelosis/brucelosis.html'];
for(const page of pages){
 test(page+' conserva configuracion y todos los recursos offline existen',async()=>{
  const html=fs.readFileSync(path.join(root,page),'utf8');
  const cfg=JSON.parse(html.match(/window.TAMBO_CONFIG = (.*?);<\/script>/)[1]);
  const manifest=html.match(/rel="manifest" href="([^"]+)"/)[1];assert.ok(fs.existsSync(path.resolve(root,path.dirname(page),manifest)));
  const worker=fs.readFileSync(path.resolve(root,path.dirname(page),cfg.worker),'utf8');const handlers={};let deleted=[];let work;
  const self={location:{origin:'https://spreiato.github.io'},addEventListener:(n,f)=>handlers[n]=f,skipWaiting(){},clients:{claim(){}}};
  const caches={keys:async()=>['other-app-v1','mt-safe-unrelated-1','vacunacion-v2','manga-tambo-v3'],delete:async key=>deleted.push(key)};
  const sw=vm.createContext({self,caches});vm.runInContext(worker,sw);
  const assets=plain(vm.runInContext('ASSETS',sw));for(const asset of assets){if(asset==='./')continue;assert.ok(fs.existsSync(path.resolve(root,path.dirname(page),asset.split('?')[0])),asset);}
  handlers.activate({waitUntil:p=>work=p});await work;assert.ok(!deleted.includes('other-app-v1'));assert.ok(!deleted.includes('mt-safe-unrelated-1'));
  if(cfg.module!=='vacunacion')assert.ok(!deleted.includes('vacunacion-v2'));
  if(cfg.module!=='manga')assert.ok(!deleted.includes('manga-tambo-v3'));
  assert.ok(!worker.includes('indexedDB'));assert.ok(!worker.includes('localStorage'));
 });
}
test('El cliente no elimina bases ni almacenes existentes',()=>{const js=fs.readFileSync(path.join(root,'tambo.js'),'utf8');new vm.Script(js);assert.ok(!/deleteDatabase|deleteObjectStore|\.clear\(/.test(js));assert.ok(js.includes("keyPath"));});
function backendHarness(fail=false){
 const writes=[],rows=[row(item.id)];let released=0;
 const sheet={getLastRow:()=>2,getRange:(r,c,n,m)=>({getValues:()=>rows,getDisplayValues:()=>defaults.map(v=>[v]),setNumberFormat(){return this;},setValue(value){if(fail)throw Error('Fallo simulado');writes.push({r,c,value});return this;},setValues(values){if(fail)throw Error('Fallo simulado');writes.push({r,c,values});return this;}})};
 const scope=vm.createContext({Date,JSON,LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})},SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:name=>name==='Base_Rodeo'?sheet:name==='Manga_Dinamica'?sheet:null}),flush(){}},ContentService:{MimeType:{JSON:'json'},createTextOutput:content=>({content,setMimeType(){return this;}})}});
 vm.runInContext(code,scope);return {scope,writes,released:()=>released,run:p=>JSON.parse(scope.doPost({postData:{contents:JSON.stringify(p)}}).content)};
}
test('dryRun de los ocho modulos no escribe',()=>{for(const module of ['manga','ventas','fc_vacias','fc_llenas','inseminacion','vacunacion','traslado','brucelosis']){const h=backendHarness();const r=h.run({module,dryRun:true,lecturas:[{...item,renspa:'01028000324/02'}]});assert.equal(r.status,'success');assert.equal(r.dryRun,true);assert.equal(h.writes.length,0);assert.equal(h.released(),1);}});
test('doPost confirma solo tras completar escrituras',()=>{const h=backendHarness();const r=h.run({module:'vacunacion',lecturas:[item]});assert.equal(r.results[0].status,'confirmed');assert.equal(h.writes[0].c,14);assert.equal(h.released(),1);});
test('Fallo de escritura no devuelve confirmaciones falsas',()=>{const h=backendHarness(true);const r=h.run({module:'vacunacion',lecturas:[item]});assert.equal(r.status,'error');assert.deepEqual(r.results,[]);assert.equal(h.released(),1);});
test('Las fechas conservan hora cero para filtros de Sheets',()=>{const date=ctx.tamboDate_('24/10/2026');assert.equal(date.getHours(),0);});
test('Lotes offline anteriores de mas de 200 lecturas siguen admitidos',()=>{const rows=[row(item.id)];const p=plain(ctx.tamboPlan_({lecturas:Array.from({length:201},()=>item)},rows,defaults));assert.equal(p.results.length,201);});
test('Cliente nuevo usa lotes limitados y rechaza lotes excesivos',()=>{assert.throws(()=>ctx.tamboPlan_({protocol:1,lecturas:Array.from({length:201},()=>item)},[row(item.id)],defaults));});

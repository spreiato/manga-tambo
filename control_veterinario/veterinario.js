(function () {
  'use strict';
  const cfg = window.TAMBO_CONFIG;
  const core = window.TamboCore;
  const STATES = Object.freeze({llena:'fc_llenas',vacia:'fc_vacias'});
  function normalizeId(value) {
    const id=String(value).trim().replace(/^'+/,'');
    if(!id || id.length>128 || !/^[a-zA-Z0-9 .\/_-]+$/.test(id)) throw new Error('Caravana inválida. Repita la lectura.');
    return id;
  }
  function makeRecord(id,choice,now=new Date()) {
    if(!Object.prototype.hasOwnProperty.call(STATES,choice)) throw new Error('Elija LLENA o VACÍA.');
    return {id:normalizeId(id),estado:STATES[choice],fecha:`${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`,hora:now.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),operationId:crypto.randomUUID(),synced:0};
  }
  function checkRecords(records) {
    if(records.some(r=>!Object.values(STATES).includes(r.estado))) throw new Error('Hay registros con resultado desconocido. Se conservaron para revisión.');
    return records;
  }
  window.TamboVet={normalizeId,makeRecord,checkRecords,STATES};
  if(window.TAMBO_TEST)return;
  const $=id=>document.getElementById(id);
  let adapter,draftDB,draft=null,ready=false,saving=false,running=null,resync=false;
  let scanQueue=Promise.resolve(),installPrompt=null;
  const message=(text,error=false)=>{ $('status').textContent=text;$('status').className=error?'message error':'message'; };
  const field=core.fieldSupport($('caravana')),retry=core.retryState();let retryTimer=null,retryGeneration=0;
  const focus=()=>{if(ready&&!saving)field.focus();};
  async function scheduleRetry(){const generation=++retryGeneration;clearTimeout(retryTimer);if(!ready||!navigator.onLine)return;const records=await adapter.all();if(generation!==retryGeneration)return;if(records.some(r=>!core.sent(r)))retryTimer=setTimeout(()=>sync(),Math.max(30000,retry.wait()));}
  function buttons(selected='') {
    for(const choice of Object.keys(STATES)){
      const b=$(choice);b.disabled=!ready||!draft||saving;b.setAttribute('aria-pressed',String(choice===selected));
    }
    $('cancelarLectura').disabled=!draft||saving;
  }
  async function loadDraft(){const list=await core.transaction(draftDB,'borrador','readonly',(s,done)=>{const q=s.getAll();q.onsuccess=()=>done(q.result);});return list.find(r=>r.id==='active')||null;}
  const storeDraft=value=>core.transaction(draftDB,'borrador','readwrite',s=>value?s.put({id:'active',caravana:value}):s.delete('active'));
  async function render(){
    if(!adapter)return;
    const all=checkRecords(await adapter.all()),pending=all.filter(r=>!core.sent(r));
    $('pendientesCount').textContent=pending.length;$('totalLecturas').textContent=all.length;
    $('netText').textContent=navigator.onLine?'Red disponible':'Sin conexión';
    $('countLlenas').textContent=all.filter(r=>r.estado===STATES.llena).length;
    $('countVacias').textContent=all.filter(r=>r.estado===STATES.vacia).length;
    const list=$('lecturasList');list.replaceChildren();
    if(!all.length){const li=document.createElement('li');li.textContent='Todavía no hay controles confirmados.';list.append(li);}
    all.slice().reverse().forEach(r=>{
      const li=document.createElement('li'),info=document.createElement('div'),id=document.createElement('strong'),detail=document.createElement('small'),state=document.createElement('span');
      id.textContent=r.id;detail.textContent=(r.estado===STATES.llena?'LLENA':'VACÍA')+' · '+r.fecha+' '+(r.hora||'');
      info.append(id,detail);state.textContent=core.sent(r)?'✓ Enviado':r.syncError?'⚠ Pendiente: '+r.syncError:'⏳ Pendiente';state.className=core.sent(r)?'sent':'pending';li.append(info,state);list.append(li);
    });
  }
  async function stage(){
    if(!ready||saving){message('Espere a que termine el guardado local.',true);return;}
    const raw=$('caravana').value;if(!raw.trim())return;
    let id;try{id=normalizeId(raw);}catch(e){message(e.message,true);return;}
    $('caravana').value='';
    if(draft){message('Primero elija LLENA o VACÍA para '+draft+'. La nueva lectura no reemplazó esa caravana.',true);return;}
    if((await adapter.all()).some(r=>r.id===id)){message('Caravana ya registrada en este equipo: '+id+'. Revise el listado.',true);return;}
    await storeDraft(id);draft=id;$('caravanaActual').textContent=id;$('paso').textContent='2 · ELEGÍ EL RESULTADO';buttons();
    field.waiting('Caravana leída: falta elegir LLENA o VACÍA. Todavía no se registró el control.');
    message('Caravana leída. Toque LLENA o VACÍA para confirmar. Todavía no se envió.');
    focus();
  }
  async function choose(choice){
    if(!ready||!draft||saving)return;
    saving=true;buttons(choice);const id=draft;
    try{
      const item=makeRecord(id,choice);
      const added=await adapter.add(item);
      if(!added){message('Caravana ya registrada: '+id+'. No se agregó otro control.',true);return;}
      draft=null;buttons(choice);$('paso').textContent='1 · LEÉ LA SIGUIENTE CARAVANA';
      field.saved(id);
      try{await storeDraft(null);}catch(e){message('Control guardado; no se pudo limpiar la lectura en espera. Se verificará al reabrir.',true);}
      await render();message('✓ '+id+' · '+(choice==='llena'?'LLENA':'VACÍA')+' guardada en este equipo.'+(navigator.onLine?' Confirmando envío…':' Pendiente hasta recuperar conexión.'));
      if(navigator.onLine)sync();
    }catch(e){message('NO GUARDADO: '+id+'. '+e.message+'. La lectura sigue esperando confirmación.',true);}
    finally{saving=false;buttons(draft?'':choice);focus();}
  }
  async function syncWork(manual,validate){
    if(!ready)return;
    if(!navigator.onLine){if(manual)message('Sin conexión. Los controles quedan guardados en este equipo.');return;}
    const all=checkRecords(await adapter.all()),items=validate?all:all.filter(r=>!core.sent(r));
    if(!items.length){if(manual)message(validate?'No hay controles confirmados para validar.':'No hay controles pendientes.');return;}
    let confirmed=0,failed=0;
    for(const module of Object.values(STATES)){
      const group=items.filter(r=>r.estado===module);
      for(let i=0;i<group.length;i+=50){
        const batch=group.slice(i,i+50),results=await core.post(batch,validate?'validar':'sincronizar',undefined,module);retry.reset();
        if(!validate)await adapter.acknowledge(batch,results);
        confirmed+=results.filter(r=>r.status==='confirmed').length;failed+=results.filter(r=>r.status!=='confirmed').length;
        await render();
      }
    }
    message((validate?'Validación confirmada: ':'Envío confirmado: ')+confirmed+(failed?'. '+failed+' pendientes: revise el listado; use Validar si falta la caravana.':'.')+(draft?' Falta elegir resultado para '+draft+'.':''),failed>0);
  }
  function sync(manual=false,validate=false){
    if(!retry.allowed(manual)){scheduleRetry().catch(()=>{});return Promise.resolve();}
    if(running){if(!validate)resync=true;else message('Espere a que finalice el envío para validar.');return running;}
    const execute=()=>syncWork(manual,validate);
    running=(navigator.locks?navigator.locks.request('manga-tambo:'+cfg.module,{ifAvailable:true},lock=>lock?execute():undefined):execute()).catch(e=>{retry.fail();message('Envío no confirmado: '+e.message+'. Los controles siguen pendientes; se reintentará automáticamente.',true);}).finally(()=>{running=null;render().catch(()=>{});scheduleRetry().catch(()=>{});focus();if(resync){resync=false;sync();}});
    return running;
  }
  async function clearLocal(){
    if(!ready||saving||running){message('Espere a que termine la operación actual.',true);return;}
    try{
      await scanQueue;const all=await adapter.all(),pending=all.filter(r=>!core.sent(r));
      if(draft||pending.length){message('No se vació: hay una lectura sin resultado o controles pendientes. Respáldelos y sincronice.',true);return;}
      if(!all.length)return;
      if(!confirm('¿Vaciar las '+all.length+' lecturas locales ya enviadas? Se conservará una copia local.'))return;
      await core.backup(all,'antes-de-vaciar');await adapter.clearSent();await render();message('Lecturas enviadas retiradas del listado. Respaldo local conservado.');focus();
    }catch(e){message('No se pudo vaciar: '+e.message,true);}
  }
  async function exportBackup(){
    if(!ready)return;
    try{
      const records=await adapter.all();await core.backup(records,'exportacion');
      const data={format:'manga-tambo-backup-v1',module:cfg.module,createdAt:new Date().toISOString(),records,lecturaSinResultado:draft};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');
      a.href=url;a.download='respaldo-control-veterinario-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);message('Respaldo descargado, incluida la lectura sin resultado si la hay.');
    }catch(e){message('No se pudo respaldar: '+e.message,true);}
  }
  $('caravana').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.repeat){e.preventDefault();scanQueue=scanQueue.then(stage).catch(e=>message('No se pudo guardar la lectura: '+e.message,true));}});
  $('tomarLectura').addEventListener('click',()=>{scanQueue=scanQueue.then(stage).catch(e=>message(e.message,true));});
  for(const choice of Object.keys(STATES))$(choice).addEventListener('click',()=>choose(choice));
  $('cancelarLectura').addEventListener('click',async()=>{if(!draft||saving)return;if(!confirm('¿Descartar la lectura '+draft+' que todavía no tiene resultado?'))return;try{await storeDraft(null);draft=null;$('caravanaActual').textContent='Esperando lectura';$('paso').textContent='1 · LEÉ LA CARAVANA';buttons();message('Lectura sin resultado descartada. No se envió ningún control.');focus();}catch(e){message(e.message,true);}});
  $('btnSync').addEventListener('click',()=>sync(true));$('btnValidar').addEventListener('click',()=>sync(true,true));$('btnClear').addEventListener('click',clearLocal);$('btnBackup').addEventListener('click',exportBackup);
  $('btnInstall').addEventListener('click',async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;$('btnInstall').hidden=true;}else alert('En el menú del navegador elegí Instalar aplicación o Agregar a pantalla principal.');});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('btnInstall').hidden=false;});
  window.addEventListener('appinstalled',()=>{$('btnInstall').hidden=true;});
  window.addEventListener('online',()=>{retry.reset();render().catch(()=>{});sync();});window.addEventListener('offline',()=>{clearTimeout(retryTimer);render().catch(()=>{});message('Sin conexión: los controles se guardan en este equipo.');});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&navigator.onLine)sync();});
  async function init(){
    try{
      const db=await core.openDB(cfg.db,cfg.store,'id');adapter=core.storageAdapter(db);draftDB=await core.openDB('ControlVeterinarioBorrador_v1','borrador','id');
      const records=checkRecords(await adapter.all());await core.backup(records,'antes-de-actualizar');const saved=await loadDraft();
      if(saved){if(records.some(r=>r.id===saved.caravana))await storeDraft(null);else draft=normalizeId(saved.caravana);}
      ready=true;field.ready();await render();buttons();
      if(draft){$('caravanaActual').textContent=draft;$('paso').textContent='2 · ELEGÍ EL RESULTADO';message('Lectura recuperada. Elija LLENA o VACÍA para confirmar.');}else message('Listo para leer. Primero caravana; después LLENA o VACÍA.');
      focus();if(navigator.onLine)sync();
    }catch(e){message('Base local protegida: '+e.message+'. No se eliminaron datos.',true);}
  }
  init();
  if('serviceWorker' in navigator)navigator.serviceWorker.register(cfg.worker).catch(()=>message('No se completó la preparación sin conexión. Los registros locales se conservan.',true));
})();

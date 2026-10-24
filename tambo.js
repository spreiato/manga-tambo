/* Persistencia compatible: conserva nombres, claves y registros de las versiones instaladas. */
(function () {
  'use strict';
  const cfg = window.TAMBO_CONFIG;
  if (!cfg) return;
  const $ = id => document.getElementById(id);
  const clone = value => JSON.parse(JSON.stringify(value));
  const sent = item => cfg.local ? item.enviado === true : Number(item.synced) === 1;
  const token = item => JSON.stringify([cfg.module,item.id,item.caravana || '',item.fecha,item.hora || '',item.renspa || '',item.operationId || '']);
  const dateToday = () => { const d=new Date();return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; };
  function transaction(db,store,mode,action) {
    return new Promise((resolve,reject) => {
      const tx=db.transaction(store,mode); let value;
      tx.oncomplete=()=>resolve(value);
      tx.onerror=tx.onabort=()=>reject(tx.error || new Error('No se pudo guardar en el dispositivo.'));
      try { action(tx.objectStore(store),v=>{value=v;}); } catch(e) {tx.abort();reject(e);}
    });
  }
  function openDB(name,store,keyPath) {
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(name,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(store))req.result.createObjectStore(store,{keyPath});};
      req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
      req.onerror=()=>reject(req.error || new Error('No se pudo abrir la base local.'));
      req.onblocked=()=>reject(new Error('Cierre otras pestañas de esta aplicación para abrir la base local.'));
    });
  }
  function mergeLocal(list,queue) {
    const map=new Map();
    list.forEach(item=>map.set(token(item),clone(item)));
    queue.forEach(item=>map.set(token(item),Object.assign({},item,{enviado:false})));
    return [...map.values()];
  }
  function storageAdapter(db) {
    const readLocal=()=>{
      const list=JSON.parse(localStorage.getItem(cfg.module+'_lecturas') || '[]');
      const queue=JSON.parse(localStorage.getItem(cfg.module+'_queue') || '[]');
      if(!Array.isArray(list)||!Array.isArray(queue))throw new Error('Registro local inválido. Se conservaron los datos originales.');
      return mergeLocal(list,queue);
    };
    function writeLocal(items) {
      // Copia previa de ambas claves antes de una actualización de localStorage.
      localStorage.setItem('tambo_recovery_'+cfg.module,JSON.stringify({list:localStorage.getItem(cfg.module+'_lecturas'),queue:localStorage.getItem(cfg.module+'_queue')}));
      localStorage.setItem(cfg.module+'_lecturas',JSON.stringify(items));
      localStorage.setItem(cfg.module+'_queue',JSON.stringify(items.filter(i=>!sent(i))));
    }
    return {
      all:()=>cfg.local ? Promise.resolve(readLocal()) : transaction(db,cfg.store,'readonly',(s,done)=>{const r=s.getAll();r.onsuccess=()=>done(r.result);}),
      add:item=>{
        if(cfg.local){const items=readLocal();items.unshift(item);writeLocal(items);return Promise.resolve(true);}
        return transaction(db,cfg.store,'readwrite',(s,done)=>{const r=s.get(item.id);r.onsuccess=()=>{if(r.result){done(false);return;}s.add(item);done(true);};});
      },
      acknowledge:(items,results)=>{
        const statuses=new Map(results.map(r=>[r.token,r]));
        const update=item=>{const r=statuses.get(token(item));if(!r)return item;const updated=Object.assign({},item,{syncError:r.status==='confirmed'?'':r.message || 'No confirmado'});if(r.status==='confirmed'){if(cfg.local)updated.enviado=true;else updated.synced=1;}return updated;};
        if(cfg.local){writeLocal(readLocal().map(update));return Promise.resolve();}
        return transaction(db,cfg.store,'readwrite',s=>items.forEach(item=>{const r=s.get(item.id);r.onsuccess=()=>{if(r.result && token(r.result)===token(item))s.put(update(r.result));};}));
      },
      clearSent:()=>{
        if(cfg.local){writeLocal(readLocal().filter(item=>!sent(item)));return Promise.resolve();}
        return transaction(db,cfg.store,'readwrite',s=>{const r=s.openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(sent(c.value))c.delete();c.continue();}};});
      }
    };
  }
  async function backup(items,reason) {
    const backupDB=await openDB('MangaTamboBackups_v1','snapshots','key');
    const key=reason==='antes-de-actualizar' ? '2026-10-24.1:'+cfg.module : cfg.module+':'+Date.now()+':'+reason;
    try {
      await transaction(backupDB,'snapshots','readwrite',(s)=>{
        const req=s.get(key);
        req.onsuccess=()=>{if(!req.result)s.add({key,module:cfg.module,reason,createdAt:new Date().toISOString(),records:clone(items),legacy:cfg.local?{lecturas:localStorage.getItem(cfg.module+'_lecturas'),queue:localStorage.getItem(cfg.module+'_queue'),renspa:localStorage.getItem('traslado_renspa')}:null});};
      });
    } finally {backupDB.close();}
  }
  async function post(items,action,endpoint) {
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),30000);
    try {
      const response=await fetch(endpoint || cfg.endpoint,{method:'POST',mode:'cors',credentials:'omit',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({protocol:1,module:cfg.module,action:action||'sincronizar',lecturas:items.map(item=>({id:String(cfg.local?item.caravana:item.id),token:token(item),fecha:item.fecha,renspa:item.renspa || ''}))}),signal:controller.signal});
      if(!response.ok || response.type==='opaque')throw new Error('El servidor no confirmó el envío.');
      const body=await response.json();
      if(body.status!=='success'||body.protocol!==1||body.module!==cfg.module||!Array.isArray(body.results))throw new Error(body.message || 'Respuesta no confirmada del servidor.');
      const expected=new Map(items.map(item=>[token(item),String(cfg.local?item.caravana:item.id)])),seen=new Set();
      for(const r of body.results){if(!expected.has(r.token)||expected.get(r.token)!==r.id||seen.has(r.token)||!['confirmed','not_found','error'].includes(r.status))throw new Error('Confirmación inválida; se conservan los pendientes.');seen.add(r.token);}
      if(seen.size!==expected.size)throw new Error('Confirmación incompleta; se conservan los pendientes.');
      return body.results;
    } finally {clearTimeout(timer);}
  }
  window.TamboCore={sent,token,mergeLocal,storageAdapter,backup,post,openDB,transaction};
  if(window.TAMBO_TEST) return;
  const input=$('caravana') || $('caravanaInput');
  let adapter, ready=false, running=null, reading=Promise.resolve(), installPrompt=null, resync=false;
  let status=$('status');
  if(!status){status=document.createElement('div');status.id='status';status.setAttribute('role','status');status.style.cssText='padding:10px;margin:10px 0;font-weight:bold;';$('syncPanel').after(status);}
  status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const message=(text,error=false)=>{status.textContent=text;status.className=error?'status-existe':'status-sync';};
  const focus=()=>{if(ready && document.activeElement!==$('renspaInput'))input.focus();};
  const render=async()=>{
    if(!adapter)return;
    const items=await adapter.all(),pending=items.filter(i=>!sent(i));
    const counter=$('pendientesCount') || $('pendingCount');counter.textContent=pending.length;
    $('totalLecturas').textContent='Total: '+items.length;
    const list=$('lecturasList');list.replaceChildren();
    if(!items.length){const li=document.createElement('li');li.className='empty-msg';li.textContent='No hay lecturas registradas aún.';list.appendChild(li);}
    const display=cfg.local?items:items.slice().reverse();
    display.forEach(item=>{
      const li=document.createElement('li'),detail=document.createElement('div'),id=document.createElement('strong'),date=document.createElement('small'),state=document.createElement('span');
      id.textContent=cfg.local?item.caravana:item.id;date.textContent=[item.fecha,item.hora,item.renspa?'RENSPA: '+item.renspa:''].filter(Boolean).join(' | ');
      detail.append(id,document.createElement('br'),date);state.textContent=sent(item)?'✓ Enviado':item.syncError?'⚠ Pendiente: '+item.syncError:'⏳ Pendiente';state.style.color=sent(item)?'#287d32':'#b55a00';state.style.fontSize='0.8rem';li.append(detail,state);list.appendChild(li);
    });
    if($('syncText'))$('syncText').textContent=pending.length?'Pendientes de confirmación':'Sin pendientes locales';
    if($('netText'))$('netText').textContent=navigator.onLine?'Red disponible':'Sin señal';
  };
  async function syncWork(manual,validate) {
    if(!ready)return;
    if(!navigator.onLine){if(manual)message('Sin conexión. Las lecturas permanecen guardadas.');return;}
    const all=await adapter.all(),items=validate?all:all.filter(i=>!sent(i));
    if(!items.length){if(manual)message(validate?'No hay registros para validar.':'No hay lecturas pendientes.');return;}
    let confirmed=0,failed=0;
    for(let i=0;i<items.length;i+=50){
      const batch=items.slice(i,i+50);message(validate?'Validando caravanas...':'Enviando '+batch.length+' lecturas...');
      const results=await post(batch,validate?'validar':'sincronizar');
      // Validar comprueba existencia/altas. No cambia el estado de la sincronización de fechas.
      if(!validate)await adapter.acknowledge(batch,results);
      confirmed+=results.filter(r=>r.status==='confirmed').length;failed+=results.filter(r=>r.status!=='confirmed').length;await render();
    }
    message((validate?'Validación confirmada: ':'Guardado confirmado: ')+confirmed+(failed?'. '+failed+' requieren revisión y conservan su estado pendiente.':'.'),failed>0);
  }
  function sync(manual=false,validate=false) {
    if(running){if(!validate)resync=true;else message('Espere a que finalice el envío para validar.');return running;}
    const execute=()=>syncWork(manual,validate);
    running=(navigator.locks ? navigator.locks.request('manga-tambo:'+cfg.module,{ifAvailable:true},lock=>lock?execute():undefined):execute()).catch(e=>message('No confirmado: '+e.message+' Las lecturas siguen guardadas.',true)).finally(()=>{running=null;render().catch(()=>{});if(resync){resync=false;sync();}});
    return running;
  }
  function capture() {
    if(!ready){message('Espere a que la base local esté lista.',true);return;}
    let id=input.value.trim();if(cfg.clean)id=id.replace(/[^a-zA-Z0-9]/g,'');
    if(!id)return;
    if(id.length>128 || !/^[a-zA-Z0-9 .\/_-]+$/.test(id)){message('Caravana inválida. Revise la lectura.',true);return;}
    const renspa=$('renspaInput')?$('renspaInput').value.trim():'';
    if(cfg.module==='traslado' && !/^[0-9/.-]{4,40}$/.test(renspa)){message('Ingrese un RENSPA destino válido.',true);$('renspaInput').focus();return;}
    const item=cfg.local?{id:Date.now(),caravana:id,fecha:dateToday(),hora:new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),enviado:false,operationId:crypto.randomUUID()}: {id,fecha:dateToday(),synced:0};
    if(cfg.module==='traslado')item.renspa=renspa;
    input.value='';
    reading=reading.then(async()=>{const added=await adapter.add(item);message(added?'✓ Lectura guardada en el dispositivo: '+id:'⚠ Caravana ya registrada: '+id,!added);await render();if(navigator.onLine)sync();}).catch(e=>{if(!input.value)input.value=id;message('NO GUARDADO: '+id+'. '+e.message,true);});
    focus();
  }
  async function clearLocal() {
    if(!ready)return;
    if(running){message('Espere a que finalice la sincronización.',true);return;}
    try {
      await reading;const items=await adapter.all(),pending=items.filter(i=>!sent(i));
      if(pending.length){message('No se vació la base: hay '+pending.length+' lecturas pendientes. Puede descargarlas con Respaldar.',true);return;}
      if(!items.length)return;
      if(!confirm('¿Vaciar las '+items.length+' lecturas locales ya enviadas? Se conservará una copia local de seguridad.'))return;
      await backup(items,'antes-de-vaciar');await adapter.clearSent();await render();message('Lecturas enviadas retiradas del listado; respaldo local conservado.');focus();
    }catch(e){message('No se pudo vaciar: '+e.message,true);}
  }
  async function exportBackup() {
    if(!ready)return;
    try {
      const items=await adapter.all();await backup(items,'exportacion');
      const data={format:'manga-tambo-backup-v1',module:cfg.module,origin:location.origin,createdAt:new Date().toISOString(),records:items};
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=document.createElement('a');
      a.href=url;a.download='respaldo-'+cfg.module+'-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);message('Respaldo descargado. Los datos locales siguen intactos.');
    }catch(e){message('No se pudo generar el respaldo: '+e.message,true);}
  }
  window.sincronizarDatos=manual=>sync(manual);
  window.validarCaravanas=()=>sync(true,true);
  window.vaciarBaseLocal=clearLocal;
  if(cfg.module==='manga')window.toggleMenuApps=()=>{const p=$('panelMenuApps');p.style.display=p.style.display==='block'?'none':'block';};
  input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.repeat){e.preventDefault();capture();}});
  if($('btnAdd'))$('btnAdd').addEventListener('click',capture);
  if($('btnSyncNow'))$('btnSyncNow').addEventListener('click',()=>sync(true));
  if($('btnClearLocal'))$('btnClearLocal').addEventListener('click',clearLocal);
  if($('renspaInput')){try{$('renspaInput').value=localStorage.getItem('traslado_renspa') || '';}catch(e){}$('renspaInput').addEventListener('input',()=>{try{localStorage.setItem('traslado_renspa',$('renspaInput').value.trim());}catch(e){message('No se pudo recordar el RENSPA.',true);}});}
  const extra=document.createElement('div');extra.style.cssText='display:flex;gap:8px;justify-content:center;margin:12px 0;flex-wrap:wrap;';
  const backupButton=document.createElement('button');backupButton.type='button';backupButton.className='btn-sync';backupButton.textContent='Respaldar';backupButton.addEventListener('click',exportBackup);extra.appendChild(backupButton);
  const installHelp=document.createElement('button');installHelp.type='button';installHelp.className='btn-sync';installHelp.textContent='Cómo instalar';installHelp.addEventListener('click',()=>alert('Abra esta dirección en el navegador del celular. En Android use el menú e Instalar aplicación o Agregar a pantalla principal. En iPhone use Compartir y Agregar a inicio. No necesita desinstalar la app existente.'));extra.appendChild(installHelp);status.after(extra);
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;$('btnInstall').style.display='block';});
  $('btnInstall').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();const choice=await installPrompt.userChoice;if(choice.outcome==='accepted')$('btnInstall').style.display='none';installPrompt=null;});
  window.addEventListener('appinstalled',()=>{$('btnInstall').style.display='none';});
  window.addEventListener('online',()=>{render().catch(()=>{});sync();});
  window.addEventListener('offline',()=>{render().catch(()=>{});message('Sin señal. Las nuevas lecturas se guardan en este dispositivo.');});
  document.addEventListener('click',e=>{if(!e.target.closest('button,a,input,#menuFlotanteContainer'))focus();});
  async function init() {
    try {
      const db=cfg.local?null:await openDB(cfg.db,cfg.store,'id');adapter=storageAdapter(db);
      const items=await adapter.all();await backup(items,'antes-de-actualizar');ready=true;await render();message('LISTO PARA LEER. Base local conservada y respaldada.');focus();
      if(navigator.onLine)sync();
    } catch(e) {message('Base local protegida: '+e.message+' No se eliminaron datos.',true);}
  }
  init();
  if('serviceWorker' in navigator)navigator.serviceWorker.register(cfg.worker).catch(()=>message('No se completó la preparación sin conexión. Sus lecturas locales se conservan.',true));
})();

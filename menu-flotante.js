(function(){
 'use strict';
 const script=document.currentScript,base=new URL('.',script.src);
 const apps=[['manga','🐄','Carga Manga','index.html'],['control_veterinario','🩺','Control Veterinario','control_veterinario/index_veterinario.html'],['vacunacion','💉','Vacunación','vacunacion/index_vacunacion.html'],['inseminacion','🧬','Inseminación','inseminacion/index_inseminacion.html'],['traslado','🚛','Traslado','traslado/traslado.html'],['brucelosis','🔬','Brucelosis','brucelosis/brucelosis.html'],['ventas','💰','Ventas','ventas/ventas.html']];
 function init(){
  if(document.getElementById('appsDialog'))return;
  const cfg=window.TAMBO_CONFIG||{},input=document.getElementById('caravana')||document.getElementById('caravanaInput');
  const wrap=document.createElement('div');wrap.id='menuFlotanteContainer';
  const header=document.createElement('header');header.className='field-nav';
  const menu=document.createElement('button');menu.type='button';menu.className='field-apps';menu.textContent='☰ APLICACIONES';menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-controls','appsDialog');
  const keyboard=document.createElement('button');keyboard.type='button';keyboard.className='field-keyboard';keyboard.textContent='Carga manual';keyboard.setAttribute('aria-pressed','false');
  const dialog=document.createElement('dialog');dialog.id='appsDialog';dialog.setAttribute('aria-label','Elegir aplicación');
  const top=document.createElement('div');top.className='field-dialog-top';const title=document.createElement('h2');title.textContent='Elegí una aplicación';
  const close=document.createElement('button');close.type='button';close.textContent='Cerrar ✕';close.className='field-close';top.append(title,close);
  const grid=document.createElement('nav');grid.className='field-app-grid';grid.setAttribute('aria-label','Aplicaciones');
  apps.forEach(([module,icon,label,path])=>{const a=document.createElement('a');a.href=new URL(path,base).href;a.textContent=icon+' '+label;if(module===cfg.module)a.setAttribute('aria-current','page');grid.append(a);});
  dialog.append(top,grid);header.append(menu,keyboard);wrap.append(header,dialog);document.body.prepend(wrap);
  const badge=document.getElementById('appVersion');if(badge){badge.style.cssText='position:static;font:700 11px system-ui;white-space:nowrap;color:#fff;';header.append(badge);}
  const style=document.createElement('style');style.textContent=`body{padding-top:88px!important}#menuFlotanteContainer .field-nav{position:fixed;inset:0 0 auto;min-height:70px;padding:10px 12px;display:flex;align-items:center;gap:10px;background:#173e59;z-index:9999;box-shadow:0 2px 8px #0003}#menuFlotanteContainer button{font-family:system-ui,sans-serif;cursor:pointer;touch-action:manipulation}#menuFlotanteContainer .field-apps{min-height:50px;border:0;border-radius:9px;background:#fff;color:#173e59;font-size:15px;font-weight:850;padding:12px 14px;flex:1}#menuFlotanteContainer .field-keyboard{min-height:50px;border:1px solid #a7c2d4;border-radius:9px;background:#254f6b;color:#fff;font-size:14px;font-weight:750;padding:10px 12px}#menuFlotanteContainer .field-keyboard[aria-pressed="true"]{background:#fff1c0;color:#513700}#appsDialog{width:min(600px,calc(100vw - 24px));max-height:calc(100dvh - 24px);padding:18px;border:0;border-radius:16px;background:#f5f8fa;color:#173e59;z-index:20000}#appsDialog::backdrop{background:#0c2138b3}.field-dialog-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.field-dialog-top h2{font-size:20px;margin:0;color:#173e59}.field-close{min-height:48px;padding:10px 14px;background:#e2eaf0;color:#173e59;border:0;border-radius:9px;font-size:15px;font-weight:750}.field-app-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field-app-grid a{display:flex;align-items:center;justify-content:center;text-align:center;min-height:88px;padding:14px 10px;border:2px solid #c4d5e0;border-radius:12px;background:white;color:#173e59;text-decoration:none;font:800 17px/1.3 system-ui}.field-app-grid a[aria-current="page"]{border-color:#174d73;background:#dcecf7}#menuFlotanteContainer button:focus-visible,.field-app-grid a:focus-visible{outline:4px solid #edb92e;outline-offset:3px}@media(max-width:360px){#menuFlotanteContainer .field-nav{gap:6px;padding:9px 8px}.field-app-grid a{font-size:15px}.field-apps{font-size:14px!important;padding:10px!important}.field-keyboard{font-size:12px!important}}`;
  document.head.append(style);
  let manual=false;
  function setMode(value){manual=value;if(input)input.inputMode=manual?'text':'none';document.body.classList.toggle('manual-entry',manual);keyboard.textContent=manual?'Volver al bastón':'Carga manual';keyboard.setAttribute('aria-pressed',String(manual));}
  setMode(false);
  menu.addEventListener('click',()=>{if(input)input.blur();dialog.showModal();menu.setAttribute('aria-expanded','true');});
  const shut=()=>{dialog.close();menu.setAttribute('aria-expanded','false');if(!manual&&input)input.focus({preventScroll:true});else menu.focus();};close.addEventListener('click',shut);dialog.addEventListener('cancel',()=>{menu.setAttribute('aria-expanded','false');if(!manual&&input)input.focus({preventScroll:true});});
  keyboard.addEventListener('click',()=>{setMode(!manual);if(input){input.blur();input.focus({preventScroll:true});}});
  const renspa=document.getElementById('renspaInput');if(renspa){renspa.inputMode='text';renspa.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setMode(false);renspa.blur();if(input)input.focus({preventScroll:true});}});}
  window.TamboFieldNav={setMode,apps};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();

'use strict';
let luogoCorrente=null,saltati=[],ultimaPosizione=null,watchId=null,avvisati={},nowPrincipale=null,nowAlternative=[];
const luoghi=()=>data.places||[];
const contesto=()=>({lavoro:'08:00',casa:'18:30',sera:'21:00',watch:false,...(data.context||{})});
const etichettaLuogo={casa:'Casa',lavoro:'Lavoro',spesa:'Spesa',altro:'Altro'};

function posizione(fresca){return new Promise((ok,no)=>{if(!navigator.geolocation)return no(Error('non disponibile'));
 navigator.geolocation.getCurrentPosition(p=>ok({lat:p.coords.latitude,lon:p.coords.longitude,acc:Math.round(p.coords.accuracy||0)}),no,{enableHighAccuracy:!!fresca,timeout:fresca?20000:12000,maximumAge:fresca?0:60000});});}

async function aggiornaLuogo(chiesto){
 if(!luoghi().length&&!chiesto)return;
 try{ultimaPosizione=await posizione(chiesto);luogoCorrente=GiornoExtras.luogoDi(luoghi(),ultimaPosizione);
  if(chiesto)message(luogoCorrente?'Sei a '+luogoCorrente.name+'.':'Non sei in nessuno dei luoghi salvati.');}
 catch{luogoCorrente=null;if(chiesto)message('Non riesco a leggere la posizione. Dai il permesso a Giorno nelle impostazioni del telefono.');}
 renderNow();}

window.renderNow=function(){
 if(!$('nowCard'))return;
 const r=GiornoExtras.prossimaAzione(data,{now:new Date(),luogo:luogoCorrente,saltati});
 $('placeChip').textContent=luogoCorrente?'◎ '+luogoCorrente.name:(luoghi().length?'◎ Dove sono adesso':'◎ Aggiungi un luogo');
 $('placeChip').classList.toggle('attivo',!!luogoCorrente);
 nowPrincipale=r.principale;nowAlternative=r.alternative;
 const pulsanti=['nowDone','nowOpen','nowSkip'];
 if(!r.principale){
  $('nowReason').textContent=r.totale?'TUTTO RIMANDATO':'NIENTE IN SOSPESO';
  $('nowTitle').textContent=r.totale?'Hai detto “non ora” a tutto.':'Per adesso sei a posto.';
  $('nowDetail').textContent=r.totale?'Tocca qui sotto per rimettere in lista quello che hai saltato.':'Scrivi una cosa da fare: qui comparirà sempre una sola cosa, quella giusta per adesso.';
  $('nowAlt').innerHTML=r.totale?'<button data-reset="1">Rimetti tutto in lista</button>':'';
  pulsanti.forEach(id=>$(id).hidden=true);return;}
 const a=r.principale;
 pulsanti.forEach(id=>$(id).hidden=false);
 $('nowDone').hidden=a.tipo==='shop'||a.tipo==='inbox';
 $('nowReason').textContent=(r.contesto+' · '+a.motivo).toUpperCase();
 $('nowTitle').textContent=a.titolo;
 $('nowDetail').textContent=[a.dettaglio,a.note].filter(Boolean).join(' · ');
 $('nowAlt').innerHTML=r.alternative.map((x,i)=>`<button data-alt="${i}"><b>${esc(x.titolo)}</b><span>${esc(x.motivo)}</span></button>`).join('');};

function apri(a){if(!a)return;
 if(a.tipo==='block'){switchArea('today');const b=data.blocks.find(x=>x.id===a.id);if(b)day(b.date);$('timeline').scrollIntoView({behavior:'smooth',block:'center'});}
 else if(a.tipo==='work'){switchArea('work');const w=entries('work').find(x=>x.id===a.id);if(w)day(w.date);}
 else if(a.tipo==='family'){switchArea('family');}
 else if(a.tipo==='shop'){switchArea('family');$('shopList').scrollIntoView({behavior:'smooth',block:'center'});}
 else {switchArea('today');$('inboxList').scrollIntoView({behavior:'smooth',block:'center'});}}

$('nowOpen').onclick=()=>apri(nowPrincipale);
$('nowSkip').onclick=()=>{if(!nowPrincipale)return;saltati.push(nowPrincipale.tipo+':'+nowPrincipale.id);renderNow();};
$('nowDone').onclick=()=>{const a=nowPrincipale;if(!a)return;const n=structuredClone(data);
 if(a.tipo==='block'){const b=n.blocks.find(x=>x.id===a.id);if(!b)return;b.done=true;}
 else if(a.tipo==='work'){const w=(n.work||[]).find(x=>x.id===a.id);if(!w)return;w.done=true;}
 else if(a.tipo==='family'){n.family=GiornoDaily.completeFamily(entries('family'),a.id,today(),()=>crypto.randomUUID());}
 else return;
 if(commit(n))message('Fatta. Avanti con la prossima.');};
document.addEventListener('click',e=>{const b=e.target.closest('[data-alt],[data-reset]');if(!b)return;
 if(b.dataset.reset){saltati=[];renderNow();return;}
 apri(nowAlternative[Number(b.dataset.alt)]);});
$('placeChip').onclick=()=>{if(!luoghi().length){$('placesDialog').showModal();renderPlaces();return;}aggiornaLuogo(true);};

function renderPlaces(){
 $('placesList').innerHTML=luoghi().map(p=>`<article class="daily-row"><div><strong>${esc(p.name)}</strong><p>${etichettaLuogo[p.kind]} · raggio ${p.radius} m${luogoCorrente&&luogoCorrente.id===p.id?' · sei qui':''}</p></div><button class="quiet" data-place-del="${esc(p.id)}">Elimina</button></article>`).join('')||'<div class="list-empty">Nessun luogo salvato.<br>Vai dove vuoi salvare (casa, lavoro, supermercato) e premi il tasto qui sotto.</div>';
 $('watchPlaces').checked=!!contesto().watch;}
$('openPlaces').onclick=()=>{$('placeError').textContent='';renderPlaces();$('placesDialog').showModal();};
$('placeForm').onsubmit=async e=>{e.preventDefault();const nome=$('placeName').value.trim(),tipo=$('placeKind').value,raggio=Number($('placeRadius').value);
 $('placeError').textContent='Sto leggendo la posizione…';
 let pos=null;try{pos=await posizione(true);}catch{$('placeError').textContent='Non riesco a leggere la posizione. Dai il permesso a Giorno e riprova stando fermo qualche secondo.';return;}
 const p={id:crypto.randomUUID(),name:nome,kind:tipo,lat:Number(pos.lat.toFixed(6)),lon:Number(pos.lon.toFixed(6)),radius:Math.round(raggio)};
 if(!GiornoDaily.validPlaces([p])){$('placeError').textContent='Controlla nome e raggio (fra 50 e 5000 metri).';return;}
 const n=structuredClone(data);n.places=[...luoghi().filter(x=>x.name!==p.name),p];
 if(commit(n)){$('placeForm').reset();$('placeRadius').value=150;$('placeError').textContent=pos.acc?'Salvato con una precisione di circa '+pos.acc+' metri.':'Salvato.';
  ultimaPosizione=pos;luogoCorrente=GiornoExtras.luogoDi(n.places,pos);renderPlaces();renderNow();}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-place-del]');if(!b)return;
 if(!confirm('Eliminare questo luogo? Le cose collegate restano, ma senza luogo.'))return;
 const id=b.dataset.placeDel,n=structuredClone(data);
 n.places=luoghi().filter(p=>p.id!==id);
 for(const k of ['blocks','work','family','shop'])if(n[k])n[k]=n[k].map(x=>x.place===id?(({place,...resto})=>resto)(x):x);
 if(commit(n)){if(luogoCorrente&&luogoCorrente.id===id)luogoCorrente=null;renderPlaces();}});
$('watchPlaces').onchange=()=>{const n=structuredClone(data);n.context={...contesto(),watch:$('watchPlaces').checked};if(commit(n))avviaSorveglianza();};

function avviaSorveglianza(){
 if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;}
 if(!contesto().watch||!navigator.geolocation||!luoghi().length)return;
 watchId=navigator.geolocation.watchPosition(p=>{
  const pos={lat:p.coords.latitude,lon:p.coords.longitude};ultimaPosizione=pos;
  const trovato=GiornoExtras.luogoDi(luoghi(),pos),prima=luogoCorrente&&luogoCorrente.id;
  luogoCorrente=trovato;
  if(trovato&&trovato.id!==prima&&Date.now()-(avvisati[trovato.id]||0)>20*60000){
   avvisati[trovato.id]=Date.now();
   const r=GiornoExtras.prossimaAzione(data,{now:new Date(),luogo:trovato});
   const testo=r.principale?r.principale.titolo:'niente in sospeso qui';
   avvisa('Sei a '+trovato.name,testo);message('Sei a '+trovato.name+' · '+testo);}
  renderNow();},()=>{},{enableHighAccuracy:false,maximumAge:60000,timeout:30000});}

async function avvisa(titolo,corpo){
 try{if(!('Notification'in window)||Notification.permission!=='granted')return;
  const reg=await navigator.serviceWorker.getRegistration()||await navigator.serviceWorker.register('./reminders-sw.js');
  await reg.showNotification(titolo,{body:corpo,tag:'giorno-contesto-'+titolo,icon:'icon-192.png'});}catch{}}

function chiaveContesto(tipo){return 'giorno-contesto:'+tipo+':'+today();}
function controllaContesti(){
 const c=contesto(),ora=new Date(),hhmm=String(ora.getHours()).padStart(2,'0')+':'+String(ora.getMinutes()).padStart(2,'0');
 for(const [tipo,quando] of [['lavoro',c.lavoro],['casa',c.casa],['sera',c.sera]]){
  if(!quando||quando>hhmm)continue;
  try{if(localStorage.getItem(chiaveContesto(tipo)))continue;}catch{continue;}
  const testo=GiornoExtras.digestContesto(data,tipo,ora);
  try{localStorage.setItem(chiaveContesto(tipo),'1');}catch{}
  if(!testo)continue;
  const titolo=tipo==='lavoro'?'Le cose del lavoro':tipo==='casa'?'Le cose di casa':'Due minuti per domani';
  avvisa(titolo,testo);message(titolo+' · '+testo);}}

$('ctxWork').onchange=$('ctxHome').onchange=$('ctxEvening').onchange=()=>{
 const n=structuredClone(data);n.context={...contesto(),lavoro:$('ctxWork').value,casa:$('ctxHome').value,sera:$('ctxEvening').value};
 if(!GiornoDaily.validContext(n.context)){message('Orario non valido.');return;}
 if(commit(n)){message('Avvisi aggiornati.');if(window.queuePushSync)queuePushSync();}};
window.mostraContesti=()=>{const c=contesto();$('ctxWork').value=c.lavoro;$('ctxHome').value=c.casa;$('ctxEvening').value=c.sera;};

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){aggiornaLuogo(false);controllaContesti();}});
setInterval(controllaContesti,60000);
renderNow();
if(luoghi().length&&navigator.permissions&&navigator.permissions.query)
 navigator.permissions.query({name:'geolocation'}).then(p=>{if(p.state==='granted'){aggiornaLuogo(false);avviaSorveglianza();}}).catch(()=>{});
window.aggiornaLuogoOra=()=>{window.scrollTo(0,0);aggiornaLuogo(true);};

// ---- versione Android: i luoghi li sorveglia il sistema -------------------
const pluginGeofence=()=>{try{return window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()&&window.Capacitor.Plugins&&window.Capacitor.Plugins.Geofence||null;}catch{return null;}};
let codaGeofence=null;
function testoPerLuogo(p){const r=GiornoExtras.prossimaAzione(data,{now:new Date(),luogo:p});
 return r.principale?r.principale.titolo:'Niente in sospeso qui.';}
async function sincronizzaGeofence(){
 const G=pluginGeofence();if(!G)return;
 try{
  const l=luoghi();
  if(!l.length){await G.ferma();return;}
  const permessi=await G.permessi();
  if(!permessi.posizione)return;
  await G.imposta({luoghi:l.map(p=>({id:p.id,name:p.name,lat:p.lat,lon:p.lon,radius:p.radius,testo:testoPerLuogo(p)}))});
 }catch(e){}}
window.queueGeofenceSync=()=>{clearTimeout(codaGeofence);codaGeofence=setTimeout(sincronizzaGeofence,2500);};
async function mostraStatoNativo(){
 const G=pluginGeofence();if(!G)return;
 const p=await G.permessi();
 const mancanti=[!p.posizione&&'la posizione',!p.sempre&&'il permesso “Consenti sempre”',!p.notifiche&&'le notifiche'].filter(Boolean);
 $('nativoStato').textContent=mancanti.length?('Manca ancora '+mancanti.join(', ')+'.'):(luoghi().length?'Attivo: Android ti avviserà quando arrivi in uno dei tuoi luoghi.':'Tutto concesso. Salva un luogo e sei a posto.');
 $('apriImpostazioni').hidden=!(p.posizione&&!p.sempre);
 $('attivaArrivi').hidden=!mancanti.length;}
if(pluginGeofence()){
 $('nativoBox').hidden=false;$('watchWrap').hidden=true;
 mostraStatoNativo();
 $('attivaArrivi').onclick=async()=>{const G=pluginGeofence();
  try{$('nativoStato').textContent='Sto chiedendo i permessi…';
   let p=await G.chiediPosizione();
   if(!p.posizione){$('nativoStato').textContent='Senza il permesso di posizione non posso avvisarti all’arrivo.';return;}
   if(!p.notifiche)p=await G.chiediNotifiche();
   if(!p.sempre)p=await G.chiediSempre();
   await sincronizzaGeofence();await mostraStatoNativo();}
  catch{$('nativoStato').textContent='Non è andata a buon fine. Riprova dalle impostazioni del telefono.';}};
 $('apriImpostazioni').onclick=()=>{const G=pluginGeofence();G.apriImpostazioni();message('Scegli “Posizione → Consenti sempre”, poi torna qui.');};
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')mostraStatoNativo();});
}

// ---- promemoria del telefono, senza bisogno del servizio online ----------
const pluginNotifiche=()=>{try{return window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications||null;}catch{return null;}};
const numeroDa=t=>{let n=0;for(let i=0;i<t.length;i++){n=(n*31+t.charCodeAt(i))|0;}return Math.abs(n%2000000000)+1;};
let codaNotifiche=null,notificheMesse=[];
async function sincronizzaNotificheNative(){
 const N=pluginNotifiche();if(!N)return;
 try{
  const permesso=await N.checkPermissions();
  if(permesso.display!=='granted')return;
  if(notificheMesse.length)await N.cancel({notifications:notificheMesse.map(id=>({id}))});
  const lavori=(typeof pushJobs==='function'?pushJobs():[]).filter(x=>Date.parse(x.due)>Date.now()).slice(0,60);
  notificheMesse=lavori.map(x=>numeroDa(x.key));
  if(!lavori.length)return;
  await N.schedule({notifications:lavori.map((x,i)=>({
   id:notificheMesse[i],title:'Giorno',body:x.title,schedule:{at:new Date(x.due),allowWhileIdle:true},smallIcon:'ic_stat_giorno'}))});
 }catch(e){}}
window.queueNotificheNative=()=>{clearTimeout(codaNotifiche);codaNotifiche=setTimeout(sincronizzaNotificheNative,3000);};
async function chiediNotificheNative(){const N=pluginNotifiche();if(!N)return false;
 try{const p=await N.requestPermissions();return p.display==='granted';}catch{return false;}}
if(pluginNotifiche()){
 chiediNotificheNative().then(ok=>{if(ok)sincronizzaNotificheNative();});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')window.queueNotificheNative();});
}

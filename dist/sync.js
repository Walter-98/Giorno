'use strict';
// Il programma personale su più dispositivi: una copia sola per persona, con revisione.
const SYNC_META='giorno-sync',SYNC_COPIA='giorno-copia-locale';
let syncAttivo=true,syncTimer=null,syncInCorso=false,syncDisponibile=true;

function metaSync(){try{return JSON.parse(localStorage.getItem(SYNC_META)||'{}');}catch{return {};}}
function salvaMeta(m){try{localStorage.setItem(SYNC_META,JSON.stringify(m));}catch{}}
function impronta(v){const s=JSON.stringify(v);let n=0;for(let i=0;i<s.length;i++)n=(n*31+s.charCodeAt(i))|0;return s.length+':'+n;}
function syncTesto(t){const el=$('syncStato');if(el)el.textContent=t;}
const oraBreve=()=>new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});

function senzaMetadati(v){const {rev,...resto}=v||{};return resto;}

async function scaricaProgramma(){
 const remoto=await cloudRPC('giorno_personal_get');
 return remoto||null;}

async function inviaProgramma(revisione){
 const corpo=senzaMetadati(data);
 const esito=await cloudRPC('giorno_personal_put',{p_payload:corpo,p_revision:revisione});
 salvaMeta({rev:esito.revision,impronta:impronta(corpo),at:new Date().toISOString()});
 syncTesto('Programma salvato online alle '+oraBreve()+'.');}

function adotta(payload){
 if(!valid(payload)){syncTesto('La copia online non è leggibile: non ho toccato niente.');return false;}
 try{localStorage.setItem(SYNC_COPIA,JSON.stringify(data));}catch{}
 try{localStorage.setItem(KEY,JSON.stringify(payload));data=payload;render();return true;}
 catch{syncTesto('Non sono riuscito a scrivere la copia scaricata.');return false;}}

async function sincronizza(primaVolta){
 if(!syncAttivo||!syncDisponibile||!cloud||!cloudUser||syncInCorso||!storageOK)return;
 syncInCorso=true;
 try{
  const meta=metaSync(),remoto=await scaricaProgramma();
  if(!remoto){await inviaProgramma(0);return;}
  const revLocale=Number(meta.rev||0);
  if(remoto.revision>revLocale){
   if(adotta(remoto.payload)){
    salvaMeta({rev:remoto.revision,impronta:impronta(senzaMetadati(remoto.payload)),at:new Date().toISOString()});
    syncTesto('Scaricato il programma aggiornato da un altro dispositivo ('+oraBreve()+').');
    if(!primaVolta)message('Ho preso il programma aggiornato da un altro dispositivo.');}
   return;}
  if(impronta(senzaMetadati(data))!==meta.impronta)await inviaProgramma(revLocale);
  else syncTesto('Tutto allineato ('+oraBreve()+').');
 }catch(e){
  const testo=String(e&&(e.message||e.hint||'')||'');
  if(testo.includes('CONFLICT')){
   try{const remoto=await scaricaProgramma();
    if(remoto&&adotta(remoto.payload)){
     salvaMeta({rev:remoto.revision,impronta:impronta(senzaMetadati(remoto.payload)),at:new Date().toISOString()});
     syncTesto('Un altro dispositivo era più avanti: ho tenuto quella copia e messo da parte la tua.');
     message('C’era una versione più recente su un altro dispositivo: ho tenuto quella.');}}
   catch{}
  }else if(testo.includes('giorno_personal')||testo.includes('schema cache')||testo.includes('404')){
   syncDisponibile=false;
   syncTesto('Il database non ha ancora la parte di sincronizzazione: va eseguito backend/sync.sql.');
  }else syncTesto('Sincronizzazione non riuscita. Riprovo al prossimo cambiamento.');
 }finally{syncInCorso=false;}}

window.queueSync=()=>{if(!syncAttivo)return;clearTimeout(syncTimer);syncTimer=setTimeout(()=>sincronizza(false),4000);};

function mostraSync(){
 const box=$('syncBox');if(!box)return;
 box.hidden=!(cloudReady&&cloudUser);
 const s=$('syncSwitch');if(s)s.checked=syncAttivo;
 const meta=metaSync();
 if(cloudUser&&syncDisponibile&&!$('syncStato').textContent)
  syncTesto(meta.at?'Ultimo allineamento: '+new Date(meta.at).toLocaleString('it-IT',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+'.':'Non ancora sincronizzato.');}

try{syncAttivo=localStorage.getItem('giorno-sync-off')!=='1';}catch{}
if($('syncSwitch'))$('syncSwitch').onchange=()=>{
 syncAttivo=$('syncSwitch').checked;
 try{localStorage.setItem('giorno-sync-off',syncAttivo?'0':'1');}catch{}
 syncTesto(syncAttivo?'Sincronizzazione attiva.':'Sincronizzazione sospesa su questo dispositivo.');
 if(syncAttivo)sincronizza(false);};

document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sincronizza(false);});
setTimeout(()=>{mostraSync();sincronizza(true);},1500);
window.mostraSync=mostraSync;

(function(root){
const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
const clock=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const shift=(base,n)=>{const d=new Date(base+'T12:00:00');d.setDate(d.getDate()+n);return fmt(d);};
const unescapeText=s=>s.replace(/\\n/gi,' ').replace(/\\,/g,',').replace(/\\;/g,';').replace(/\\\\/g,'\\').replace(/\s+/g,' ').trim();
function unfold(text){return String(text).replace(/\r\n/g,'\n').replace(/\r/g,'\n').replace(/\n[ \t]/g,'').split('\n');}
function stamp(value,params){const local=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?$/.exec(value),utc=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z$/.exec(value);
 if(/VALUE=DATE/i.test(params)||/^\d{8}$/.test(value))return {allDay:true};
 if(utc){const d=new Date(Date.UTC(+utc[1],+utc[2]-1,+utc[3],+utc[4],+utc[5],+(utc[6]||0)));return {date:fmt(d),time:clock(d.getHours()*60+d.getMinutes())};}
 if(local)return {date:`${local[1]}-${local[2]}-${local[3]}`,time:`${local[4]}:${local[5]}`};
 return {invalid:true};}
function parseICS(text,from,to,limit=200){
 const lines=unfold(text),events=[],skipped={allDay:0,recurring:0,outside:0,invalid:0};
 let current=null;
 for(const line of lines){
  const cut=line.indexOf(':');if(cut<0)continue;
  const name=line.slice(0,cut),value=line.slice(cut+1),key=name.split(';')[0].toUpperCase(),params=name.slice(key.length);
  if(key==='BEGIN'&&value.toUpperCase()==='VEVENT'){current={};continue;}
  if(!current)continue;
  if(key==='END'&&value.toUpperCase()==='VEVENT'){
   const e=current;current=null;
   if(e.rrule){skipped.recurring++;continue;}
   if(e.startAllDay||e.endAllDay){skipped.allDay++;continue;}
   if(!e.start||!e.start.date||!e.start.time||e.startInvalid){skipped.invalid++;continue;}
   const title=(e.title||'Impegno').slice(0,140);
   const startDate=e.start.date,startTime=e.start.time;
   let endTime=e.end&&e.end.date===startDate&&e.end.time?e.end.time:clock(Math.min(1439,mins(startTime)+60));
   if(mins(endTime)<=mins(startTime))endTime=clock(Math.min(1439,mins(startTime)+30));
   if(mins(endTime)<=mins(startTime)){skipped.invalid++;continue;}
   if(startDate<from||startDate>to){skipped.outside++;continue;}
   if(events.some(x=>x.date===startDate&&x.start===startTime&&x.title===title))continue;
   if(events.length>=limit)continue;
   events.push({title,date:startDate,start:startTime,end:endTime});
   continue;}
  if(key==='DTSTART'){const s=stamp(value.trim(),params);current.start=s;current.startAllDay=!!s.allDay;current.startInvalid=!!s.invalid;}
  if(key==='DTEND'){const s=stamp(value.trim(),params);current.end=s;current.endAllDay=!!s.allDay;}
  if(key==='RRULE')current.rrule=true;
  if(key==='SUMMARY')current.title=unescapeText(value);
 }
 events.sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
 return {events,skipped};}
function applyTemplate(items,blocks,date){const add=[],busy=blocks.filter(b=>b.date===date).map(b=>({start:mins(b.start),end:mins(b.end)})),skipped=[];
 for(const i of [...items].sort((a,b)=>a.start.localeCompare(b.start))){const s=mins(i.start),e=mins(i.end);
  if(busy.some(b=>b.start<e&&s<b.end)){skipped.push(i.title);continue;}
  busy.push({start:s,end:e});add.push({title:i.title,date,start:i.start,end:i.end,kind:i.kind});}
 return {add,skipped};}
function weekReport(data,from,to){
 const range=d=>!!d&&d>=from&&d<=to,blocks=(data.blocks||[]).filter(b=>range(b.date));
 const kinds={task:0,fixed:0,break:0};let planned=0,completed=0;
 for(const b of blocks){const len=mins(b.end)-mins(b.start);planned+=len;kinds[b.kind]=(kinds[b.kind]||0)+len;if(b.done)completed+=len;}
 const work=(data.work||[]).filter(x=>range(x.date)),family=(data.family||[]).filter(x=>range(x.date));
 const days=[];for(let d=from;d<=to;d=shift(d,1)){const list=blocks.filter(b=>b.date===d);days.push({date:d,minutes:list.reduce((s,b)=>s+mins(b.end)-mins(b.start),0),done:list.filter(b=>b.done).length,total:list.length});}
 const slipping=[...(data.blocks||[]),...(data.work||[]),...(data.family||[])].filter(x=>(x.moved||0)>=2&&!x.done).map(x=>({title:x.title,moved:x.moved})).sort((a,b)=>b.moved-a.moved).slice(0,5);
 const busiest=days.slice().sort((a,b)=>b.minutes-a.minutes)[0]||null;
 return {days,planned,completed,kinds,blocksDone:blocks.filter(b=>b.done).length,blocksTotal:blocks.length,
  workDone:work.filter(x=>x.done).length,workTotal:work.length,familyDone:family.filter(x=>x.done).length,familyTotal:family.length,
  waiting:(data.inbox||[]).filter(x=>x.waiting).length,pending:(data.inbox||[]).length,slipping,busiest,
  stima:work.filter(x=>x.actual).reduce((n,x)=>n+x.minutes,0),reale:work.filter(x=>x.actual).reduce((n,x)=>n+x.actual,0),misurate:work.filter(x=>x.actual).length};}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();}
function cerca(data,query,includiFatte){
 const q=norm(query);if(q.length<2)return [];
 const out=[];
 const push=(area,x,date,extra)=>{if(!includiFatte&&x.done)return;
  const testo=norm(x.title)+' '+norm(x.note)+' '+norm(x.person);
  if(!testo.includes(q))return;
  out.push({area,id:x.id,title:x.title,date:date||'',done:!!x.done,note:x.note||'',extra:extra||''});};
 (data.blocks||[]).forEach(x=>push('blocks',x,x.date,x.start+'–'+x.end));
 (data.inbox||[]).forEach(x=>push('inbox',x,x.deadline||'',(x.duration||30)+' min'));
 (data.work||[]).forEach(x=>push('work',x,x.date,(x.minutes||0)+' min'+(x.actual?' · reali '+x.actual:'')));
 (data.family||[]).forEach(x=>push('family',x,x.date||'',x.person||''));
 return out.sort((a,b)=>(b.date||'0').localeCompare(a.date||'0')||a.title.localeCompare(b.title)).slice(0,40);}
function durataSuggerita(work,titolo){const q=norm(titolo);if(q.length<3)return null;
 const v=(work||[]).filter(x=>x.actual&&norm(x.title)===q).map(x=>x.actual).sort((a,b)=>a-b);
 if(!v.length)return null;
 const m=v.length%2?v[(v.length-1)/2]:Math.round((v[v.length/2-1]+v[v.length/2])/2);
 return {minuti:Math.max(5,Math.round(m/5)*5),volte:v.length};}

// ---- luoghi -------------------------------------------------------------
function distanza(a,b){const R=6371000,r=Math.PI/180;
 const dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r,la=a.lat*r,lb=b.lat*r;
 const h=Math.sin(dLat/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(dLon/2)**2;
 return Math.round(2*R*Math.asin(Math.min(1,Math.sqrt(h))));}
function luogoDi(places,pos){if(!pos||!Array.isArray(places))return null;
 let best=null;for(const p of places){if(typeof p.lat!=='number'||typeof p.lon!=='number')continue;
  const d=distanza(p,pos);if(d<=(p.radius||200)&&(!best||d<best.distanza))best={...p,distanza:d};}
 return best;}
// ---- cosa fare adesso ---------------------------------------------------
const _min=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
const _giorno=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function oreLavorative(now){const g=now.getDay(),m=now.getHours()*60+now.getMinutes();return g>=1&&g<=5&&m>=7*60&&m<18*60;}
function prossimaAzione(data,ctx){
 ctx=ctx||{};const now=ctx.now||new Date(),oggi=_giorno(now),adesso=now.getHours()*60+now.getMinutes();
 const luogo=ctx.luogo||null,minuti=ctx.minuti||null,saltati=ctx.saltati||[];
 const kind=luogo?luogo.kind:null,c=[];
 const perLuogo=(x,punti)=>{if(!x.place)return punti;if(luogo&&x.place===luogo.id)return punti+35;if(luogo)return punti-40;return punti-5;};
 for(const b of (data.blocks||[])){
  if(b.done||b.date!==oggi)continue;
  const i=_min(b.start),f=_min(b.end);let p=35,motivo='in programma alle '+b.start;
  if(adesso>=i&&adesso<f){p=110;motivo='è adesso, '+b.start+'–'+b.end;}
  else if(i>adesso&&i-adesso<=45){p=95;motivo='inizia fra '+(i-adesso)+' minuti';}
  else if(i>adesso){p=b.important?70:40;motivo=(b.important?'è la cosa che conta oggi · ':'')+'alle '+b.start;}
  else {p=b.important?60:28;motivo='era alle '+b.start+', non l’hai ancora spuntata';}
  if(b.kind==='break')p-=15;
  c.push({tipo:'block',area:'today',id:b.id,titolo:b.title,dettaglio:b.start+'–'+b.end,note:b.note||'',punteggio:perLuogo(b,p),motivo});}
 for(const w of (data.work||[])){
  if(w.done||!w.date||w.date>oggi)continue;
  let p=15,motivo='attività di lavoro';
  if(kind==='lavoro'){p=78;motivo='sei al lavoro';}
  else if(!luogo&&oreLavorative(now)){p=55;motivo='sei in orario di lavoro';}
  else if(kind==='casa'){p=8;motivo='è roba di lavoro, puoi lasciarla lì';}
  if(w.priority)p+=14;
  if(w.date<oggi){p+=6;motivo+=' · rimasta indietro';}
  c.push({tipo:'work',area:'work',id:w.id,titolo:w.title,dettaglio:w.minutes+' min',note:w.note||'',punteggio:perLuogo(w,p),motivo});}
 for(const f of (data.family||[])){
  if(f.done)continue;
  if(f.date&&f.date>oggi){
   const giorniMancanti=Math.round((new Date(f.date+'T12:00:00')-new Date(oggi+'T12:00:00'))/86400000);
   if(!f.notice||giorniMancanti>f.notice)continue;
   c.push({tipo:'family',area:'family',id:f.id,titolo:f.title,dettaglio:'scade fra '+(giorniMancanti===1?'un giorno':giorniMancanti+' giorni'),note:f.note||'',punteggio:perLuogo(f,kind==='casa'?72:52),motivo:'scadenza vicina'});
   continue;}
  let p=18,motivo='faccenda di casa';
  if(kind==='casa'){p=76;motivo='sei a casa';}
  else if(!luogo&&!oreLavorative(now)){p=52;motivo='è l’ora delle cose di casa';}
  else if(kind==='lavoro'){p=6;motivo='è roba di casa, non da qui';}
  if(f.date&&f.date<oggi){p+=10;motivo+=' · era per '+f.date;}
  c.push({tipo:'family',area:'family',id:f.id,titolo:f.title,dettaglio:f.person||'da fare',note:f.note||'',punteggio:perLuogo(f,p),motivo});}
 const spesa=(data.shop||[]).filter(x=>!x.done);
 if(spesa.length){
  let p=20,motivo='lista pronta';
  if(kind==='spesa'){p=115;motivo='sei al supermercato';}
  else if(kind==='casa'){p=24;motivo='da prendere quando esci';}
  c.push({tipo:'shop',area:'family',id:'spesa',titolo:'La spesa: '+spesa.slice(0,3).map(x=>x.title).join(', ')+(spesa.length>3?' e altro':''),dettaglio:spesa.length+(spesa.length===1?' prodotto':' prodotti'),note:'',punteggio:p,motivo});}
 for(const t of (data.inbox||[])){
  if(t.waiting)continue;
  const durata=t.duration||30;let p=12,motivo='da incastrare';
  if(minuti&&durata<=minuti){p=62;motivo='ci sta nei '+minuti+' minuti che hai';}
  if(t.deadline&&t.deadline<=oggi){p=Math.max(p,68);motivo='scadenza arrivata';}
  c.push({tipo:'inbox',area:'today',id:t.id,titolo:t.title,dettaglio:durata+' min',note:'',punteggio:perLuogo(t,p),motivo});}
 const liberi=c.filter(x=>!saltati.includes(x.tipo+':'+x.id)).sort((a,b)=>b.punteggio-a.punteggio||a.titolo.localeCompare(b.titolo));
 const contesto=luogo?('Sei a '+luogo.name):(oreLavorative(now)?'Orario di lavoro':'Fuori orario');
 return {principale:liberi[0]||null,alternative:liberi.slice(1,4),contesto,totale:c.length};}
// ---- riassunti per le notifiche di contesto -----------------------------
function digestContesto(data,tipo,now){
 const oggi=_giorno(now||new Date());
 if(tipo==='lavoro'){const l=(data.work||[]).filter(x=>!x.done&&x.date&&x.date<=oggi);
  if(!l.length)return '';
  const prima=l.find(x=>x.priority)||l[0];
  return `${l.length} ${l.length===1?'attività':'attività'} di lavoro. Comincia da: ${prima.title}`;}
 if(tipo==='casa'){const f=(data.family||[]).filter(x=>!x.done&&(!x.date||x.date<=oggi)),s=(data.shop||[]).filter(x=>!x.done);
  const pezzi=[];if(f.length)pezzi.push(f.slice(0,3).map(x=>x.title).join(', '));
  if(s.length)pezzi.push('spesa: '+s.length+(s.length===1?' prodotto':' prodotti'));
  return pezzi.join(' · ');}
 if(tipo==='sera'){const d=new Date((now||new Date()).getTime()+86400000),domani=_giorno(d);
  const b=(data.blocks||[]).filter(x=>!x.done&&x.date===domani),f=(data.family||[]).filter(x=>!x.done&&x.date===domani);
  if(!b.length&&!f.length)return 'Domani è libero. Scegli una cosa che conta.';
  return `Domani: ${b.length?b.length+(b.length===1?' impegno':' impegni'):'niente in agenda'}${f.length?' · '+f.length+(f.length===1?' faccenda':' faccende'):''}. Scegli la priorità.`;}
 return '';}
const api={parseICS,applyTemplate,weekReport,cerca,durataSuggerita,distanza,luogoDi,prossimaAzione,digestContesto,oreLavorative};if(typeof module!=='undefined')module.exports=api;else root.GiornoExtras=api;
})(globalThis);

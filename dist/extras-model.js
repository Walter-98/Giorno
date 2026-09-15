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
const api={parseICS,applyTemplate,weekReport,cerca,durataSuggerita};if(typeof module!=='undefined')module.exports=api;else root.GiornoExtras=api;
})(globalThis);

'use strict';
let icsPending=[];
const templates=()=>data.templates||[];
const dayGap=(a,b)=>Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000);
const hours=n=>`${Math.floor(n/60)?Math.floor(n/60)+' h ':''}${n%60?n%60+' min':(n?'':'0 min')}`;
window.renderWeek=function(){const from=$('date').value;if(!validDate(from)||!$('weekGrid'))return;
 let html='';
 for(let i=0;i<7;i++){const d=plus(from,i),blocks=data.blocks.filter(b=>b.date===d),load=blocks.reduce((s,b)=>s+min(b.end)-min(b.start),0),pri=blocks.find(b=>b.important),w=entries('work').filter(x=>x.date===d&&!x.done).length,f=entries('family').filter(x=>x.date===d&&!x.done).length;
  html+=`<button class="week-day${d===today()?' is-today':''}" data-week="${d}"><span class="week-date">${niceDate(d)}</span><b>${blocks.length?blocks.length+(blocks.length===1?' blocco':' blocchi'):'Libero'}</b><span class="week-load">${blocks.length?hours(load)+' · '+blocks.filter(b=>b.done).length+' fatti':'Niente in programma'}</span>${pri?`<span class="week-pri">★ ${esc(pri.title)}</span>`:''}${w||f?`<span class="week-extra">${w?w+' lavoro':''}${w&&f?' · ':''}${f?f+' casa':''}</span>`:''}</button>`;}
 $('weekGrid').innerHTML=html;
 const soon=GiornoDaily.upcoming(entries('family'),from);
 $('upcomingList').innerHTML=soon.map(x=>{const gap=dayGap(from,x.date);return `<article class="daily-row"><div><strong>${esc(x.title)}</strong><p>${niceDate(x.date)} · ${gap===1?'domani':'fra '+gap+' giorni'}${x.person?' · '+esc(x.person):''}${x.repeat==='yearly'?' · ogni anno':x.repeat==='monthly'?' · ogni mese':''}</p></div><button class="quiet" data-edit="family" data-id="${esc(x.id)}">Modifica</button></article>`;}).join('')||'<div class="list-empty">Nessuna scadenza in arrivo.<br>Dai un preavviso alle faccende con data: bollo, revisione, bollette, compleanni.</div>';};
document.addEventListener('click',e=>{const b=e.target.closest('[data-week]');if(!b)return;switchArea('today');day(b.dataset.week);});

function renderRoutines(){$('routineDay').textContent=niceDate($('date').value);
 $('routineList').innerHTML=templates().map(t=>`<article class="daily-row"><div><strong>${esc(t.name)}</strong><p>${t.items.length} ${t.items.length===1?'blocco':'blocchi'} · ${t.items[0].start}–${t.items[t.items.length-1].end}</p></div><button class="quiet" data-routine="${esc(t.id)}">Applica</button><button class="quiet" data-routine-del="${esc(t.id)}">Elimina</button></article>`).join('')||'<div class="list-empty">Nessuna routine salvata.<br>Prepara una giornata tipo in Oggi e salvala qui sotto.</div>';}
$('openRoutines').onclick=()=>{$('routineTarget').value=$('date').value;$('routineError').textContent='';renderRoutines();$('routineDialog').showModal();};
$('routineSave').onsubmit=e=>{e.preventDefault();const d=$('date').value,name=$('routineName').value.trim(),items=data.blocks.filter(x=>x.date===d).sort((a,b)=>a.start.localeCompare(b.start)).map(x=>({title:x.title,start:x.start,end:x.end,kind:x.kind}));
 if(!items.length){$('routineError').textContent='Questa giornata non ha blocchi da salvare. Aprine una con il programma che vuoi ripetere.';return;}
 if(items.length>30){$('routineError').textContent='Una routine può contenere al massimo 30 blocchi.';return;}
 const t={id:crypto.randomUUID(),name,items},n=structuredClone(data);n.templates=[...templates().filter(x=>x.name!==name),t];
 if(!GiornoDaily.validTemplates(n.templates)){$('routineError').textContent='Controlla il nome della routine.';return;}
 if(commit(n)){$('routineName').value='';$('routineError').textContent='';renderRoutines();message('Routine salvata');}};
document.addEventListener('click',e=>{const b=e.target.closest('[data-routine],[data-routine-del]');if(!b)return;
 if(b.dataset.routineDel){if(!confirm('Eliminare questa routine?'))return;const n=structuredClone(data);n.templates=templates().filter(t=>t.id!==b.dataset.routineDel);if(commit(n))renderRoutines();return;}
 const t=templates().find(x=>x.id===b.dataset.routine),target=$('routineTarget').value;
 if(!t)return;
 if(!validDate(target)){$('routineError').textContent='Scegli un giorno valido.';return;}
 const {add,skipped}=GiornoExtras.applyTemplate(t.items,data.blocks,target);
 if(!add.length){$('routineError').textContent='Tutti i blocchi della routine si sovrappongono a impegni già presenti in quel giorno.';return;}
 const n=structuredClone(data);add.forEach(x=>n.blocks.push({...x,id:crypto.randomUUID(),important:false,done:false}));
 if(commit(n)){$('routineDialog').close();switchArea('today');day(target);message(`${add.length} ${add.length===1?'blocco aggiunto':'blocchi aggiunti'}${skipped.length?' · '+skipped.length+' saltati per sovrapposizione':''}`);}});

$('openImport').onclick=()=>{icsPending=[];$('icsPreview').innerHTML='';$('icsConfirm').hidden=true;$('icsDialog').showModal();};
$('pickIcs').onclick=()=>$('icsFile').click();
$('icsFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
 try{if(f.size>3000000)throw Error('big');const text=await f.text();const from=today(),to=plus(from,60),{events,skipped}=GiornoExtras.parseICS(text,from,to,200);
  icsPending=events.filter(x=>!data.blocks.some(b=>b.date===x.date&&b.title===x.title&&b.start===x.start));
  const note=[skipped.recurring?skipped.recurring+' ripetuti':'',skipped.allDay?skipped.allDay+' di un giorno intero':'',skipped.outside?skipped.outside+' fuori dai 60 giorni':'',skipped.invalid?skipped.invalid+' senza orario leggibile':''].filter(Boolean);
  $('icsPreview').innerHTML=icsPending.length?icsPending.map((x,i)=>`<label class="review-row"><input type="checkbox" data-ics="${i}" checked> ${esc(x.title)} · ${niceDate(x.date)} ${x.start}–${x.end}</label>`).join(''):'<div class="list-empty">Nessun impegno nuovo da importare in questo file.</div>';
  $('icsNote').textContent=(note.length?'Non importati: '+note.join(', ')+'. ':'')+'Gli orari sono letti come orari locali. Gli impegni già presenti non vengono duplicati.';
  $('icsConfirm').hidden=!icsPending.length;}
 catch{$('icsPreview').innerHTML='<div class="list-empty">Non riesco a leggere questo file. Esporta di nuovo il calendario in formato .ics (massimo 3 MB).</div>';$('icsConfirm').hidden=true;}};
$('icsConfirm').onclick=()=>{const picked=[...document.querySelectorAll('[data-ics]:checked')].map(x=>icsPending[Number(x.dataset.ics)]).filter(Boolean);
 if(!picked.length){message('Scegli almeno un impegno da importare.');return;}
 const n=structuredClone(data);let added=0,skipped=0;
 for(const x of picked){if(n.blocks.some(b=>b.date===x.date&&min(b.start)<min(x.end)&&min(x.start)<min(b.end))){skipped++;continue;}n.blocks.push({id:crypto.randomUUID(),title:x.title,date:x.date,start:x.start,end:x.end,kind:'fixed',important:false,done:false});added++;}
 if(!added){message('Tutti gli impegni scelti si sovrappongono a blocchi già presenti.');return;}
 if(commit(n)){$('icsDialog').close();switchArea('today');message(`${added} ${added===1?'impegno importato':'impegni importati'}${skipped?' · '+skipped+' saltati per sovrapposizione':''}`);}};

function renderReport(){const from=$('reportFrom').value,to=$('reportTo').value;
 if(!validDate(from)||!validDate(to)||from>to){$('reportBody').innerHTML='<div class="list-empty">Scegli un periodo valido, con la data iniziale prima di quella finale.</div>';return;}
 if(dayGap(from,to)>92){$('reportBody').innerHTML='<div class="list-empty">Scegli un periodo di massimo tre mesi.</div>';return;}
 const r=GiornoExtras.weekReport(data,from,to),top=Math.max(1,...r.days.map(d=>d.minutes));
 $('reportBody').innerHTML=`<div class="report-grid"><div class="report-card"><b>${r.blocksDone}/${r.blocksTotal}</b><span>blocchi completati</span></div><div class="report-card"><b>${hours(r.completed)}</b><span>di ${hours(r.planned)} programmate</span></div><div class="report-card"><b>${r.workDone}/${r.workTotal}</b><span>attività di lavoro</span></div><div class="report-card"><b>${r.familyDone}/${r.familyTotal}</b><span>faccende con data</span></div></div>
 <h3>Come è distribuito il tempo</h3><p class="small">Da fare ${hours(r.kinds.task||0)} · Impegni fissi ${hours(r.kinds.fixed||0)} · Pause ${hours(r.kinds.break||0)}</p>
 <div class="report-days">${r.days.map(d=>`<div class="report-day"><span>${niceDate(d.date).split(' ')[0]}</span><div class="bar"><i style="height:${Math.round(d.minutes/top*100)}%"></i></div><span class="small">${d.total?d.done+'/'+d.total:'–'}</span></div>`).join('')}</div>
 <h3>Cosa continua a slittare</h3>${r.slipping.length?'<ul class="report-list">'+r.slipping.map(x=>`<li>${esc(x.title)} · rimandata ${x.moved} volte</li>`).join('')+'</ul>':'<p class="small">Niente che si trascini da più di due rinvii. Buon segno.</p>'}
 <h3>Ancora da incastrare</h3><p class="small">${r.pending} ${r.pending===1?'impegno in lista':'impegni in lista'}${r.waiting?' · '+r.waiting+' in attesa di un passo o di una risposta':''}.${r.busiest&&r.busiest.minutes?' Giornata più carica: '+niceDate(r.busiest.date)+' con '+hours(r.busiest.minutes)+'.':''}</p>`;}
$('openReport').onclick=()=>{$('reportTo').value=$('date').value;$('reportFrom').value=plus($('date').value,-6);renderReport();$('reportDialog').showModal();};
$('reportFrom').onchange=$('reportTo').onchange=renderReport;
renderWeek();
const vista=new URLSearchParams(location.search).get('vista');
if(vista==='settimana')switchArea('week');else if(vista==='spesa')switchArea('shop');else if(vista==='tempo')$('freeNow').click();

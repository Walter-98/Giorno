const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={structuredClone};for(const file of ['daily-model.js','extras-model.js'])vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/'+file,'utf8'),ctx);
const d=ctx.GiornoDaily,x=ctx.GiornoExtras;
const ics=lines=>['BEGIN:VCALENDAR',...lines,'END:VCALENDAR'].join('\r\n');

test('scadenze mensili e annuali non slittano di giorno', ()=>{
 assert.equal(d.nextDate('2026-03-01','yearly','2026-03-05'),'2027-03-01');
 assert.equal(d.nextDate('2026-01-31','monthly','2026-02-02'),'2026-02-28');
 assert.equal(d.nextDate('2026-09-01','weekly','2026-09-15'),'2026-09-22');
 assert.equal(d.nextDate('2026-09-01','monthly','2026-12-20'),'2027-01-01');
});
test('preavviso valido e scadenze in arrivo', ()=>{
 const base={id:'a',title:'Bollo',done:false,person:'',repeat:'yearly',date:'2026-09-20'};
 assert.equal(d.validExtra({family:[{...base,notice:7}]}),true);
 assert.equal(d.validExtra({family:[{...base,notice:2}]}),false);
 assert.equal(d.validExtra({family:[{...base,repeat:'monthly'}]}),true);
 assert.equal(d.upcoming([{...base,notice:7}],'2026-09-15').length,1);
 assert.equal(d.upcoming([{...base,notice:1}],'2026-09-15').length,0);
 assert.equal(d.upcoming([{...base,notice:7,done:true}],'2026-09-15').length,0);
 assert.equal(d.upcoming([{...base,notice:7}],'2026-09-20').length,0);
});
test('le routine si controllano prima di essere salvate', ()=>{
 const good=[{id:'t1',name:'Cantiere',items:[{title:'Giro',start:'08:00',end:'09:00',kind:'fixed'}]}];
 assert.equal(d.validTemplates(good),true);
 assert.equal(d.validTemplates([{...good[0],items:[]}]),false);
 assert.equal(d.validTemplates([{...good[0],items:[{title:'x',start:'10:00',end:'09:00',kind:'task'}]}]),false);
 assert.equal(d.validExtra({templates:good}),true);
});
test('una routine salta i blocchi che si sovrappongono', ()=>{
 const items=[{title:'A',start:'09:00',end:'10:00',kind:'task'},{title:'B',start:'11:00',end:'12:00',kind:'task'}];
 const r=x.applyTemplate(items,[{date:'2026-09-16',start:'09:30',end:'10:30'}],'2026-09-16');
 assert.equal(JSON.stringify(r.skipped),JSON.stringify(['A']));assert.equal(r.add.length,1);assert.equal(r.add[0].date,'2026-09-16');
 assert.equal(x.applyTemplate(items,[],'2026-09-16').add.length,2);
});
test('import calendario: orari, pieghe, ripetuti e giorni interi', ()=>{
 const text=ics(['BEGIN:VEVENT','DTSTART;TZID=Europe/Rome:20260916T090000','DTEND;TZID=Europe/Rome:20260916T103000','SUMMARY:Riunione di can','\ttiere','END:VEVENT',
  'BEGIN:VEVENT','DTSTART;VALUE=DATE:20260917','SUMMARY:Ferie','END:VEVENT',
  'BEGIN:VEVENT','DTSTART:20260918T080000Z','DTEND:20260918T090000Z','RRULE:FREQ=WEEKLY','SUMMARY:Riunione','END:VEVENT',
  'BEGIN:VEVENT','DTSTART:20270101T080000','DTEND:20270101T090000','SUMMARY:Lontano','END:VEVENT',
  'BEGIN:VEVENT','DTSTART:20260919T080000','SUMMARY:Senza fine','END:VEVENT']);
 const r=x.parseICS(text,'2026-09-15','2026-11-15');
 assert.equal(r.events.length,2);
 assert.equal(JSON.stringify(r.events[0]),JSON.stringify({title:'Riunione di cantiere',date:'2026-09-16',start:'09:00',end:'10:30'}));
 assert.equal(r.events[1].end,'09:00');
 assert.equal(r.skipped.allDay,1);assert.equal(r.skipped.recurring,1);assert.equal(r.skipped.outside,1);
 assert.equal(x.parseICS('non è un calendario','2026-09-15','2026-11-15').events.length,0);
});
test('il resoconto conta solo il periodo scelto e segnala i rinvii', ()=>{
 const data={blocks:[{id:'1',title:'A',date:'2026-09-15',start:'09:00',end:'10:00',kind:'task',done:true},
  {id:'2',title:'B',date:'2026-09-16',start:'09:00',end:'11:00',kind:'fixed',done:false,moved:3},
  {id:'3',title:'C',date:'2026-10-01',start:'09:00',end:'10:00',kind:'task',done:true}],
  work:[{id:'w',title:'Offerta',date:'2026-09-15',minutes:30,priority:false,done:false}],
  family:[{id:'f',title:'Spazzatura',date:'2026-09-16',person:'',repeat:'weekly',done:true}],
  inbox:[{id:'i',title:'Meccanico',waiting:true}]};
 const r=x.weekReport(data,'2026-09-14','2026-09-20');
 assert.equal(r.blocksTotal,2);assert.equal(r.blocksDone,1);
 assert.equal(r.planned,180);assert.equal(r.completed,60);
 assert.equal(r.kinds.fixed,120);assert.equal(r.days.length,7);
 assert.equal(r.workTotal,1);assert.equal(r.familyDone,1);
 assert.equal(JSON.stringify(r.slipping),JSON.stringify([{title:'B',moved:3}]));
 assert.equal(r.waiting,1);assert.equal(r.busiest.date,'2026-09-16');
});

test('la ricerca guarda anche le note e rispetta le completate', ()=>{
 const data={blocks:[{id:'b1',title:'Offerta depuratore',date:'2026-09-15',start:'09:00',end:'10:00',done:false,note:'chiamare Rossi'}],
  inbox:[{id:'i1',title:'Meccanico',duration:60}],
  work:[{id:'w1',title:'Offerta',date:'2026-09-10',minutes:30,actual:40,done:true}],
  family:[{id:'f1',title:'Bollo',date:'2026-09-20',person:'Walter',done:false}]};
 assert.equal(x.cerca(data,'rossi',false).length,1);
 assert.equal(x.cerca(data,'offerta',false).length,1);
 assert.equal(x.cerca(data,'offerta',true).length,2);
 assert.equal(x.cerca(data,'o',true).length,0);
 assert.equal(x.cerca(data,'walter',false)[0].title,'Bollo');
 assert.equal(x.cerca(data,'MECCANICO',false)[0].area,'inbox');
});
test('la durata suggerita usa la mediana delle misure', ()=>{
 const work=[{id:'a',title:'Offerta',actual:40},{id:'b',title:'offerta',actual:50},{id:'c',title:'Offerta',actual:60},{id:'d',title:'Altro',actual:10}];
 assert.equal(x.durataSuggerita(work,'Offerta').minuti,50);
 assert.equal(x.durataSuggerita(work,'Offerta').volte,3);
 assert.equal(x.durataSuggerita(work,'Mai fatta'),null);
 assert.equal(x.durataSuggerita([{id:'a',title:'Giro',minutes:30}],'Giro'),null);
});
test('il resoconto confronta stima e tempo reale', ()=>{
 const data={blocks:[],work:[{id:'w1',title:'A',date:'2026-09-15',minutes:30,actual:45,done:true},
  {id:'w2',title:'B',date:'2026-09-15',minutes:60,priority:false,done:false}],family:[],inbox:[]};
 const r=x.weekReport(data,'2026-09-14','2026-09-20');
 assert.equal(r.misurate,1);assert.equal(r.stima,30);assert.equal(r.reale,45);
});

test('i luoghi si riconoscono dalla distanza', ()=>{
 const luoghi=[{id:'L',name:'Lavoro',kind:'lavoro',lat:43.8,lon:13.0,radius:200},
               {id:'C',name:'Casa',kind:'casa',lat:43.85,lon:13.05,radius:150}];
 assert.equal(x.luogoDi(luoghi,{lat:43.8001,lon:13.0001}).id,'L');
 assert.equal(x.luogoDi(luoghi,{lat:43.8501,lon:13.0501}).id,'C');
 assert.equal(x.luogoDi(luoghi,{lat:44.2,lon:12.5}),null);
 assert.equal(x.luogoDi([],{lat:43.8,lon:13}),null);
 assert.equal(x.luogoDi(luoghi,null),null);
 assert.ok(Math.abs(x.distanza({lat:43.8,lon:13},{lat:43.81,lon:13})-1112)<30);
});
test('adesso sceglie in base al luogo', ()=>{
 const now=new Date('2026-10-05T10:00:00');
 const luoghi={lavoro:{id:'L',name:'Lavoro',kind:'lavoro'},casa:{id:'C',name:'Casa',kind:'casa'},spesa:{id:'S',name:'Conad',kind:'spesa'}};
 const data={blocks:[],inbox:[],
  work:[{id:'w1',title:'Offerta',date:'2026-10-05',minutes:30,priority:false,done:false}],
  family:[{id:'f1',title:'Lavatrice',done:false,person:'',repeat:'none'}],
  shop:[{id:'s1',title:'Latte',done:false,qty:''}]};
 assert.equal(x.prossimaAzione(data,{now,luogo:luoghi.lavoro}).principale.titolo,'Offerta');
 assert.equal(x.prossimaAzione(data,{now,luogo:luoghi.casa}).principale.titolo,'Lavatrice');
 assert.equal(x.prossimaAzione(data,{now,luogo:luoghi.spesa}).principale.tipo,'shop');
 assert.equal(x.prossimaAzione(data,{now,luogo:luoghi.lavoro}).contesto,'Sei a Lavoro');
});
test('adesso mette davanti quello che sta per iniziare', ()=>{
 const now=new Date('2026-10-05T10:00:00');
 const data={blocks:[{id:'b1',title:'Riunione',date:'2026-10-05',start:'10:20',end:'11:00',kind:'fixed',important:false,done:false},
                     {id:'b2',title:'Pomeriggio',date:'2026-10-05',start:'15:00',end:'16:00',kind:'task',important:false,done:false}],
  inbox:[],work:[],family:[],shop:[]};
 assert.equal(x.prossimaAzione(data,{now}).principale.titolo,'Riunione');
 const inCorso=x.prossimaAzione(data,{now:new Date('2026-10-05T10:30:00')});
 assert.match(inCorso.principale.motivo,/è adesso/);
 const saltata=x.prossimaAzione(data,{now,saltati:['block:b1']});
 assert.equal(saltata.principale.titolo,'Pomeriggio');
 assert.equal(x.prossimaAzione({blocks:[],inbox:[],work:[],family:[],shop:[]},{now}).principale,null);
});
test('una cosa legata a un luogo non salta fuori altrove', ()=>{
 const now=new Date('2026-10-05T10:00:00');
 const casa={id:'C',name:'Casa',kind:'casa'},lavoro={id:'L',name:'Lavoro',kind:'lavoro'};
 const data={blocks:[],inbox:[],work:[],shop:[],
  family:[{id:'f1',title:'Innaffiare',done:false,person:'',repeat:'none',place:'C'},
          {id:'f2',title:'Chiamare il comune',done:false,person:'',repeat:'none'}]};
 assert.equal(x.prossimaAzione(data,{now,luogo:casa}).principale.titolo,'Innaffiare');
 assert.equal(x.prossimaAzione(data,{now,luogo:lavoro}).principale.titolo,'Chiamare il comune');
});
test('i riassunti di contesto dicono da dove partire', ()=>{
 const now=new Date('2026-10-05T08:00:00');
 const data={blocks:[{id:'b',title:'Visita',date:'2026-10-06',start:'09:00',end:'10:00',kind:'fixed',done:false}],
  work:[{id:'w',title:'Offerta',date:'2026-10-05',minutes:30,priority:true,done:false}],
  family:[{id:'f',title:'Spazzatura',done:false,person:'',repeat:'none'}],
  shop:[{id:'s',title:'Latte',done:false,qty:''}],inbox:[]};
 assert.match(x.digestContesto(data,'lavoro',now),/Offerta/);
 assert.match(x.digestContesto(data,'casa',now),/Spazzatura/);
 assert.match(x.digestContesto(data,'casa',now),/spesa/);
 assert.match(x.digestContesto(data,'sera',now),/Domani/);
 assert.equal(x.digestContesto({work:[],family:[],shop:[],blocks:[]},'lavoro',now),'');
});

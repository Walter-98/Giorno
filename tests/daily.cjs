const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const ctx={structuredClone};vm.runInNewContext(fs.readFileSync(__dirname+'/../dist/daily-model.js','utf8'),ctx);const m=ctx.GiornoDaily;
test('old backups remain readable; new data is validated',()=>{assert.equal(m.validExtra({version:1,blocks:[],inbox:[]}),true);assert.equal(m.validExtra({work:[{id:'a',title:'Email',done:false,date:'2026-09-15',minutes:30,priority:false}]}),true);assert.equal(m.validExtra({work:[null]}),false);assert.equal(m.validExtra({family:[{id:'a',title:'Pulire',done:false,date:'2026-02-30',person:'',repeat:'none'}]}),false);assert.equal(m.validExtra({reminders:{enabled:true,lead:999}}),false);});
test('recurring chores create one next task and skip accumulated missed days',()=>{const old=[{id:'a',title:'Pulire',date:'2026-09-01',person:'Io',repeat:'weekly',done:false}];const next=m.completeFamily(old,'a','2026-09-15',()=> 'b');assert.equal(next.length,2);assert.equal(next[1].date,'2026-09-22');assert.equal(old[0].done,false);assert.equal(m.completeFamily(next,'a','2026-09-15',()=> 'c').length,2);});
test('reminders respect lead, completion, deduplication and stale cutoff',()=>{const b={id:'a',date:'2026-09-15',start:'10:00',done:false},now=new Date('2026-09-15T09:50:20').getTime();assert.equal(m.due([b],now,10,[]).length,1);assert.equal(m.due([b],now,10,['a:2026-09-15:10:00:10']).length,0);assert.equal(m.due([{...b,done:true}],now,10,[]).length,0);assert.equal(m.due([b],now+120000,10,[]).length,0);});

test('note, durate reali e preferenze vengono controllate',()=>{
 const base={id:'a',title:'Offerta',done:false,date:'2026-09-15',minutes:30,priority:false};
 assert.equal(m.validExtra({work:[{...base,note:'chiamare',actual:45}]}),true);
 assert.equal(m.validExtra({work:[{...base,actual:5000}]}),false);
 assert.equal(m.validExtra({work:[{...base,note:'x'.repeat(501)}]}),false);
 assert.equal(m.validExtra({family:[{id:'f',title:'Bollo',done:false,person:'',repeat:'none',note:'targa'}]}),true);
 assert.equal(m.validExtra({prefs:{theme:'scuro',size:'grande'}}),true);
 assert.equal(m.validExtra({prefs:{theme:'viola',size:'grande'}}),false);
 assert.equal(m.validExtra({shop:[{id:'s',title:'Latte',done:false,qty:'1 L'}]}),true);
});

test('luoghi e avvisi di contesto vengono controllati',()=>{
 const posto={id:'p1',name:'Casa',kind:'casa',lat:43.8,lon:13.0,radius:150};
 assert.equal(m.validPlaces([posto]),true);
 assert.equal(m.validPlaces([{...posto,lat:200}]),false);
 assert.equal(m.validPlaces([{...posto,kind:'bar'}]),false);
 assert.equal(m.validPlaces([{...posto,radius:10}]),false);
 assert.equal(m.validPlaces([posto,{...posto}]),false);
 assert.equal(m.validContext({lavoro:'08:00',casa:'',sera:'21:00',watch:true}),true);
 assert.equal(m.validContext({lavoro:'99:00'}),false);
 assert.equal(m.validExtra({family:[{id:'f',title:'x',done:false,person:'',repeat:'none',place:'p1'}],places:[posto]}),true);
 assert.equal(m.validExtra({shop:[{id:'s',title:'Latte',done:false,qty:'1 L',place:'p1'}]}),true);
});

test('i rinvii e la data dell ultimo backup vengono controllati',()=>{
 const ora=new Date('2026-10-03T12:00:00');
 assert.equal(m.validSnoozed(undefined),true);
 assert.equal(m.validSnoozed({'work:w1':'2026-10-03T15:00:00.000Z'}),true);
 assert.equal(m.validSnoozed({'work:w1':'domani'}),false);
 assert.equal(m.validSnoozed([]),false);
 assert.equal(JSON.stringify(m.rinviiAttivi({a:'2026-10-03T15:00:00Z',b:'2026-10-03T09:00:00Z'},ora)),JSON.stringify(['a']));
 assert.equal(m.rinviiAttivi(undefined,ora).length,0);
 assert.equal(m.validExtra({lastBackup:'2026-10-03T10:00:00.000Z'}),true);
 assert.equal(m.validExtra({lastBackup:'ieri'}),false);
 assert.equal(m.validExtra({snoozed:{'family:f1':'2026-10-04T08:00:00.000Z'}}),true);
});

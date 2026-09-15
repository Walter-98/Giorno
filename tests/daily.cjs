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

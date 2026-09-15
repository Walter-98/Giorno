(function(root){
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='2020-01-01'&&s<='2100-12-31'&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const time=s=>typeof s==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const mins=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
const text=(s,n)=>typeof s==='string'&&s.length<=n;
const item=x=>x&&text(x.id,80)&&/^[\w-]+$/.test(x.id)&&text(x.title,140)&&x.title.trim()&&typeof x.done==='boolean';
const repeats=['none','daily','weekly','monthly','yearly'];
const notices=[0,1,3,7,14,30];
const count=x=>x===undefined||Number.isInteger(x)&&x>=0&&x<=999;
function validTemplates(list){return list===undefined||Array.isArray(list)&&list.length<=50&&new Set(list.map(t=>t&&t.id)).size===list.length&&list.every(t=>t&&text(t.id,80)&&/^[\w-]+$/.test(t.id)&&text(t.name,60)&&t.name.trim()&&Array.isArray(t.items)&&t.items.length>0&&t.items.length<=30&&t.items.every(i=>i&&text(i.title,140)&&i.title.trim()&&time(i.start)&&time(i.end)&&mins(i.end)>mins(i.start)&&['task','fixed','break'].includes(i.kind)));}
function validExtra(v){try{return ['work','family','shop'].every(k=>v[k]===undefined||Array.isArray(v[k])&&v[k].length<=10000&&new Set(v[k].map(x=>x.id)).size===v[k].length&&v[k].every(x=>item(x)&&(k==='work'?date(x.date)&&Number.isInteger(x.minutes)&&x.minutes>=5&&x.minutes<=720&&typeof x.priority==='boolean'&&count(x.moved):k==='family'?(!x.date||date(x.date))&&text(x.person,60)&&repeats.includes(x.repeat)&&(x.notice===undefined||notices.includes(x.notice))&&count(x.moved):text(x.qty,40))))&&validTemplates(v.templates)&&(v.reminders===undefined||v.reminders&&typeof v.reminders.enabled==='boolean'&&[0,5,10,15].includes(v.reminders.lead));}catch{return false;}}
const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function step(d,repeat){const day=d.getDate();if(repeat==='weekly')d.setDate(day+7);else if(repeat==='monthly'||repeat==='yearly'){const target=new Date(d.getTime());target.setDate(1);if(repeat==='monthly')target.setMonth(target.getMonth()+1);else target.setFullYear(target.getFullYear()+1);const last=new Date(target.getFullYear(),target.getMonth()+1,0).getDate();target.setDate(Math.min(day,last));d.setTime(target.getTime());}else d.setDate(day+1);return d;}
function nextDate(base,repeat,today){const start=base&&date(base)?base:today;let d=new Date(start+'T12:00:00'),guard=0;do{step(d,repeat);}while(fmt(d)<=today&&++guard<500);return fmt(d);}
function completeFamily(items,id,today,makeId){const list=structuredClone(items),x=list.find(x=>x.id===id);if(!x||x.done)return list;x.done=true;if(x.repeat!=='none')list.push({...x,id:makeId(),date:nextDate(x.date,x.repeat,today),done:false,moved:0});return list;}
function due(blocks,now,lead,seen){return blocks.filter(b=>{const start=new Date(b.date+'T'+b.start+':00').getTime(),at=start-lead*60000,key=b.id+':'+b.date+':'+b.start+':'+lead;return !b.done&&now>=at&&now<at+60000&&!seen.includes(key);});}
function upcoming(items,today){return (items||[]).filter(x=>!x.done&&x.date&&x.notice&&x.date>today&&x.date<=fmt(new Date(new Date(today+'T12:00:00').getTime()+x.notice*86400000))).sort((a,b)=>a.date.localeCompare(b.date));}
root.GiornoDaily={validExtra,nextDate,completeFamily,due,upcoming,validTemplates};
})(globalThis);

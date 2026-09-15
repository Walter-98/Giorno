(function(root){
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&s>='2020-01-01'&&s<='2100-12-31'&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const text=(s,n)=>typeof s==='string'&&s.length<=n;
const item=x=>x&&text(x.id,80)&&/^[\w-]+$/.test(x.id)&&text(x.title,140)&&x.title.trim()&&typeof x.done==='boolean';
function validExtra(v){try{return ['work','family','shop'].every(k=>v[k]===undefined||Array.isArray(v[k])&&v[k].length<=10000&&new Set(v[k].map(x=>x.id)).size===v[k].length&&v[k].every(x=>item(x)&&(k==='work'?date(x.date)&&Number.isInteger(x.minutes)&&x.minutes>=5&&x.minutes<=720&&typeof x.priority==='boolean':k==='family'?(!x.date||date(x.date))&&text(x.person,60)&&['none','daily','weekly'].includes(x.repeat):text(x.qty,40))))&&(v.reminders===undefined||v.reminders&&typeof v.reminders.enabled==='boolean'&&[0,5,10,15].includes(v.reminders.lead));}catch{return false;}}
function nextDate(base,repeat,today){const d=new Date((base&&base>today?base:today)+'T12:00:00');d.setDate(d.getDate()+(repeat==='weekly'?7:1));return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function completeFamily(items,id,today,makeId){const list=structuredClone(items),x=list.find(x=>x.id===id);if(!x||x.done)return list;x.done=true;if(x.repeat!=='none')list.push({...x,id:makeId(),date:nextDate(x.date,x.repeat,today),done:false});return list;}
function due(blocks,now,lead,seen){return blocks.filter(b=>{const start=new Date(b.date+'T'+b.start+':00').getTime(),at=start-lead*60000,key=b.id+':'+b.date+':'+b.start+':'+lead;return !b.done&&now>=at&&now<at+60000&&!seen.includes(key);});}
root.GiornoDaily={validExtra,nextDate,completeFamily,due};
})(globalThis);

(function(root){
const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3));
const time=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
const date=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const defaults=t=>({duration:30,from:'09:00',to:'18:00',days:[1,2,3,4,5,6,0],deadline:'',after:'',waiting:false,prerequisite:'',...t});
function findSlots(task,blocks,selected,now=new Date()){
 const t=defaults(task),today=date(now),start=[selected,today,t.after||''].sort().at(-1),result=[];
 if(t.waiting)return result;
 const cursor=new Date(start+'T12:00:00');
 for(let i=0;i<14&&result.length<3;i++,cursor.setDate(cursor.getDate()+1)){
  const day=date(cursor);if(day>'2100-12-31'||t.deadline&&day>t.deadline)break;
  if(!t.days.includes(cursor.getDay()))continue;
  let at=minutes(t.from),end=minutes(t.to);
  if(day===today)at=Math.max(at,Math.ceil((now.getHours()*60+now.getMinutes()+1)/5)*5);
  for(const b of blocks.filter(b=>b.date===day).sort((a,b)=>a.start.localeCompare(b.start))){
   if(minutes(b.end)<=at)continue;
   if(at+t.duration<=Math.min(minutes(b.start),end))break;
   if(minutes(b.start)<at+t.duration)at=Math.max(at,minutes(b.end));
  }
  if(at+t.duration<=end)result.push({date:day,start:time(at),end:time(at+t.duration)});
 }
 return result;
}
const api={defaults,findSlots};if(typeof module!=='undefined')module.exports=api;else root.GiornoSlots=api;
})(globalThis);

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import webpush from 'npm:web-push@3.6.7';
const allowedEndpoint=(s:string)=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname==='web.push.apple.com'||u.hostname.endsWith('.push.apple.com'));}catch{return false;}};
Deno.serve(async request=>{
 const secret=Deno.env.get('GIORNO_CRON_SECRET');
 if(request.method!=='POST'||!secret||request.headers.get('x-giorno-secret')!==secret)return new Response('Unauthorized',{status:401});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
 webpush.setVapidDetails(Deno.env.get('GIORNO_VAPID_SUBJECT')!,Deno.env.get('GIORNO_VAPID_PUBLIC')!,Deno.env.get('GIORNO_VAPID_PRIVATE')!);
 const {data:jobs,error}=await db.rpc('giorno_claim_push');if(error)return new Response('Queue unavailable',{status:503});
 for(const job of jobs||[]){
  const {data:subs,error:subError}=await db.from('giorno_push_subscriptions').select('id,subscription').eq('user_id',job.user_id);
  if(subError)continue;let retry=false;
  for(const sub of subs||[]){if(!allowedEndpoint(sub.subscription.endpoint))continue;
   try{await webpush.sendNotification(sub.subscription,JSON.stringify({title:'Giorno',body:job.title,tag:job.id}),{TTL:900,timeout:10000});}
   catch(e){if(e.statusCode===404||e.statusCode===410)await db.from('giorno_push_subscriptions').delete().eq('id',sub.id);else retry=true;}
  }
  if(!retry)await db.from('giorno_push_jobs').update({status:'sent',lease_until:null}).eq('id',job.id);
 }
 await db.from('giorno_push_jobs').delete().lt('due',new Date(Date.now()-7*86400000).toISOString());
 return new Response(JSON.stringify({processed:jobs?.length||0}),{headers:{'Content-Type':'application/json'}});
});

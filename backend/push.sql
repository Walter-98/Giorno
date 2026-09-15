begin;
create table if not exists public.giorno_push_subscriptions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,subscription jsonb not null check(octet_length(subscription::text)<8192));
alter table public.giorno_push_subscriptions enable row level security;
drop policy if exists giorno_push_own on public.giorno_push_subscriptions;
create policy giorno_push_own on public.giorno_push_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.giorno_push_subscriptions to authenticated;
create table if not exists public.giorno_push_jobs(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,device uuid not null,job_key text not null,title text not null check(length(title)<=140),due timestamptz not null,status text not null default 'pending',lease_until timestamptz,attempts integer not null default 0,unique(user_id,device,job_key));
alter table public.giorno_push_jobs enable row level security;
revoke all on public.giorno_push_jobs from anon,authenticated;
grant all on public.giorno_push_jobs,public.giorno_push_subscriptions to service_role;
create or replace function public.giorno_schedule_push(p_device uuid,p_jobs jsonb) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin if auth.uid() is null or jsonb_typeof(p_jobs)<>'array' or jsonb_array_length(p_jobs)>250 then raise exception 'Richiesta non valida';end if;
delete from giorno_push_jobs where user_id=auth.uid() and device=p_device and status='pending' and not exists(select 1 from jsonb_array_elements(p_jobs) x where x->>'key'=job_key);
insert into giorno_push_jobs(user_id,device,job_key,title,due)
select auth.uid(),p_device,x->>'key',left(x->>'title',140),(x->>'due')::timestamptz from jsonb_array_elements(p_jobs) x where (x->>'due')::timestamptz>now() and (x->>'due')::timestamptz<now()+interval '8 days'
on conflict(user_id,device,job_key) do update set title=excluded.title,due=excluded.due where giorno_push_jobs.status='pending';
end $$;
create or replace function public.giorno_claim_push() returns setof public.giorno_push_jobs language sql security definer set search_path=public,pg_temp as $$
update giorno_push_jobs set lease_until=now()+interval '2 minutes',attempts=attempts+1 where id in(select id from giorno_push_jobs where status='pending' and due<=now() and due>now()-interval '15 minutes' and attempts<5 and (lease_until is null or lease_until<now()) order by due for update skip locked limit 100) returning *;
$$;
revoke all on function public.giorno_schedule_push(uuid,jsonb),public.giorno_claim_push() from public,anon,authenticated;
grant execute on function public.giorno_schedule_push(uuid,jsonb) to authenticated;
grant execute on function public.giorno_claim_push() to service_role;
commit;

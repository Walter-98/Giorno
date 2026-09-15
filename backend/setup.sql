-- Giorno: spazio isolato da Tasca. Eseguire nel SQL Editor di Supabase.
begin;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.giorno_groups(id uuid primary key default gen_random_uuid(), title text not null check(length(title) between 1 and 60),owner uuid not null references auth.users(id));
create table if not exists public.giorno_members(user_id uuid primary key references auth.users(id) on delete cascade,group_id uuid not null references public.giorno_groups(id) on delete cascade,name text not null check(length(name) between 1 and 60));
create table if not exists public.giorno_items(id uuid primary key,group_id uuid not null references public.giorno_groups(id) on delete cascade,kind text not null check(kind in ('family','shop')),title text not null check(length(title) between 1 and 140),person text not null default '' check(length(person)<=60),done boolean not null default false,revision integer not null default 1,updated_at timestamptz not null default now());
create table if not exists public.giorno_invites(token_hash text primary key,group_id uuid not null references public.giorno_groups(id) on delete cascade,expires_at timestamptz not null);
alter table public.giorno_groups enable row level security;
alter table public.giorno_members enable row level security;
alter table public.giorno_items enable row level security;
alter table public.giorno_invites enable row level security;
revoke all on public.giorno_groups,public.giorno_members,public.giorno_items,public.giorno_invites from anon,authenticated;
create or replace function public.giorno_board() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare g uuid;result jsonb;begin
if auth.uid() is null then raise exception 'Accesso richiesto';end if;
select group_id into g from giorno_members where user_id=auth.uid();if g is null then return null;end if;
select jsonb_build_object('id',id,'title',title,'owner',owner,'members',(select coalesce(jsonb_agg(jsonb_build_object('id',user_id,'name',name)),'[]') from giorno_members where group_id=g),'items',(select coalesce(jsonb_agg(to_jsonb(i) order by updated_at),'[]') from giorno_items i where group_id=g)) into result from giorno_groups where id=g;return result;end $$;
create or replace function public.giorno_create(p_title text,p_name text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare g uuid;begin if auth.uid() is null then raise exception 'Accesso richiesto';end if;
insert into giorno_groups(title,owner) values(trim(p_title),auth.uid()) returning id into g;
insert into giorno_members(user_id,group_id,name) values(auth.uid(),g,trim(p_name));return giorno_board();end $$;
create or replace function public.giorno_invite() returns text language plpgsql security definer set search_path=public,pg_temp as $$
declare g uuid;t text;begin select id into g from giorno_groups where owner=auth.uid();if g is null then raise exception 'Solo il creatore può invitare';end if;t=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');delete from giorno_invites where group_id=g;insert into giorno_invites values(encode(extensions.digest(t,'sha256'),'hex'),g,now()+interval '24 hours');return t;end $$;
create or replace function public.giorno_join(p_token text,p_name text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare g uuid;begin if auth.uid() is null then raise exception 'Accesso richiesto';end if;
select group_id into g from giorno_invites where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now() for update;
if g is null then raise exception 'Codice non valido o scaduto';end if;
perform 1 from giorno_groups where id=g for update;
if (select count(*) from giorno_members where group_id=g)>=10 then raise exception 'Massimo 10 persone';end if;
insert into giorno_members values(auth.uid(),g,trim(p_name));delete from giorno_invites where group_id=g;return giorno_board();end $$;
create or replace function public.giorno_save_item(p_id uuid,p_kind text,p_title text,p_person text,p_done boolean,p_revision integer) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare g uuid;begin select group_id into g from giorno_members where user_id=auth.uid();if g is null then raise exception 'Famiglia non trovata';end if;
if p_revision=0 then
if (select count(*) from giorno_items where group_id=g)>=2000 then raise exception 'Lista piena: elimina alcune voci';end if;
insert into giorno_items(id,group_id,kind,title,person,done) values(p_id,g,p_kind,trim(p_title),trim(p_person),p_done);
else update giorno_items set title=trim(p_title),person=trim(p_person),done=p_done,revision=revision+1,updated_at=now() where id=p_id and group_id=g and revision=p_revision;
if not found then raise exception 'CONFLICT: la voce è cambiata. Aggiorna e riprova';end if;end if;return giorno_board();end $$;
create or replace function public.giorno_delete_item(p_id uuid,p_revision integer) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin delete from giorno_items where id=p_id and revision=p_revision and group_id=(select group_id from giorno_members where user_id=auth.uid());if not found then raise exception 'CONFLICT: voce modificata o non accessibile';end if;return giorno_board();end $$;
create or replace function public.giorno_remove_member(p_user uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare g uuid;begin select group_id into g from giorno_members where user_id=auth.uid();if g is null or exists(select 1 from giorno_groups where id=g and owner=p_user) then raise exception 'Il creatore non può essere rimosso';end if;
if p_user<>auth.uid() and not exists(select 1 from giorno_groups where id=g and owner=auth.uid()) then raise exception 'Operazione non consentita';end if;
delete from giorno_members where user_id=p_user and group_id=g;delete from giorno_invites where group_id=g;return giorno_board();end $$;
revoke all on function public.giorno_board(),public.giorno_create(text,text),public.giorno_invite(),public.giorno_join(text,text),public.giorno_save_item(uuid,text,text,text,boolean,integer),public.giorno_delete_item(uuid,integer),public.giorno_remove_member(uuid) from public,anon;
grant execute on function public.giorno_board(),public.giorno_create(text,text),public.giorno_invite(),public.giorno_join(text,text),public.giorno_save_item(uuid,text,text,text,boolean,integer),public.giorno_delete_item(uuid,integer),public.giorno_remove_member(uuid) to authenticated;
commit;

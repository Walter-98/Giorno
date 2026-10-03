-- Programma personale sincronizzato fra i dispositivi di una stessa persona.
-- Da eseguire nel SQL Editor di Supabase dopo setup.sql.
begin;

create table if not exists public.giorno_personal(
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint giorno_personal_dimensione check (octet_length(payload::text) < 2000000)
);

alter table public.giorno_personal enable row level security;
revoke all on public.giorno_personal from anon, authenticated;
grant all on public.giorno_personal to service_role;

-- Legge il programma di chi ha fatto l'accesso. Nessuno può leggere quello di un altro.
create or replace function public.giorno_personal_get() returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare risultato jsonb;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  select jsonb_build_object('payload',payload,'revision',revision,'updated_at',updated_at)
    into risultato from giorno_personal where user_id=auth.uid();
  return risultato;
end $$;

-- Salva il programma. p_revision = 0 crea la prima copia; altrimenti deve coincidere
-- con quella sul server, se no risponde CONFLICT e non sovrascrive niente.
create or replace function public.giorno_personal_put(p_payload jsonb, p_revision integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare nuova integer;
begin
  if auth.uid() is null then raise exception 'Accesso richiesto'; end if;
  if jsonb_typeof(p_payload) <> 'object' then raise exception 'Dati non validi'; end if;
  if octet_length(p_payload::text) >= 2000000 then raise exception 'Programma troppo grande'; end if;

  if p_revision = 0 then
    insert into giorno_personal(user_id,payload) values(auth.uid(),p_payload)
    on conflict (user_id) do nothing
    returning revision into nuova;
    if nuova is null then raise exception 'CONFLICT: esiste già una copia sul server'; end if;
  else
    update giorno_personal set payload=p_payload, revision=revision+1, updated_at=now()
      where user_id=auth.uid() and revision=p_revision
      returning revision into nuova;
    if nuova is null then raise exception 'CONFLICT: il programma è cambiato su un altro dispositivo'; end if;
  end if;

  return jsonb_build_object('revision',nuova,'updated_at',now());
end $$;

revoke all on function public.giorno_personal_get(), public.giorno_personal_put(jsonb,integer) from public,anon;
grant execute on function public.giorno_personal_get(), public.giorno_personal_put(jsonb,integer) to authenticated;

commit;

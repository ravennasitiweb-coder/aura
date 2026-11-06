-- Limite giornaliero dell'assistente AI: 10 richieste al giorno per attività,
-- così un solo account non consuma la quota gratuita di tutti.

create table public.ai_usage (
  salon_id uuid not null references public.salons (id) on delete cascade,
  day date not null,
  requests integer not null default 0,
  primary key (salon_id, day)
);

alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Conta una richiesta e dice se è ancora permessa. Solo il titolare può usarla.
create function public.use_ai_request(p_salon_id uuid, p_limit integer default 10)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.has_salon_role(p_salon_id, 'owner') then
    raise exception 'Solo il titolare' using errcode = '42501';
  end if;
  insert into public.ai_usage as u (salon_id, day, requests)
  values (p_salon_id, (now() at time zone 'Europe/Rome')::date, 1)
  on conflict (salon_id, day) do update set requests = u.requests + 1
  returning u.requests into v_count;
  return v_count <= least(greatest(p_limit, 1), 10);
end;
$$;

revoke execute on function public.use_ai_request(uuid, integer) from public, anon;
grant execute on function public.use_ai_request(uuid, integer) to authenticated;

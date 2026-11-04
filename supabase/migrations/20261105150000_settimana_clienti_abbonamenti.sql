-- Vista settimana, clienti e abbonamenti.

-- 1. Agenda su più giorni (vista settimana) --------------------------------

create function public.agenda_range(p_salon_id uuid, p_from date, p_to date)
returns table (
  day date,
  id uuid,
  staff_id uuid,
  service_name text,
  customer_name text,
  status public.appointment_status,
  source public.appointment_source,
  start_min integer,
  end_min integer
)
language plpgsql stable security invoker
set search_path = ''
as $$
declare
  v_tz text;
begin
  if p_to < p_from or p_to - p_from > 13 then
    raise exception 'Intervallo non valido (massimo 14 giorni)' using errcode = '22023';
  end if;
  select timezone into v_tz from public.salons where id = p_salon_id;

  return query
  select
    (a.starts_at at time zone v_tz)::date,
    a.id, a.staff_id, s.name, a.customer_name, a.status, a.source,
    (extract(hour from a.starts_at at time zone v_tz) * 60 + extract(minute from a.starts_at at time zone v_tz))::integer,
    (extract(epoch from (a.ends_at at time zone v_tz) - ((a.starts_at at time zone v_tz)::date)::timestamp) / 60)::integer
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.salon_id = p_salon_id
    and a.starts_at >= (p_from::timestamp at time zone v_tz)
    and a.starts_at < ((p_to + 1)::timestamp at time zone v_tz)
  order by a.starts_at;
end;
$$;

-- 2. Clienti ---------------------------------------------------------------
-- Non c'è una tabella clienti: il cliente si ricava dagli appuntamenti.
-- Lo stesso numero scritto in modi diversi ("+39 333..." e "333...") è lo
-- stesso cliente; senza telefono si raggruppa per nome.

create function public.customer_key(p_phone text, p_name text)
returns text
language sql immutable
set search_path = ''
as $$
  select coalesce(
    nullif(public.normalize_phone(p_phone), ''),
    'n:' || lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'))
  );
$$;

create index appointments_customer_key_idx
  on public.appointments (salon_id, public.customer_key(customer_phone, customer_name));

create function public.customer_list(p_salon_id uuid, p_search text default null)
returns table (
  customer_key text,
  name text,
  phone text,
  email text,
  visits integer,
  no_shows integer,
  last_visit timestamptz,
  next_appointment timestamptz
)
language sql stable security invoker
set search_path = ''
as $$
  with a as (
    select *, public.customer_key(customer_phone, customer_name) as k
    from public.appointments
    where salon_id = p_salon_id
  )
  select
    a.k,
    (array_agg(a.customer_name order by a.starts_at desc))[1],
    (array_agg(a.customer_phone order by a.starts_at desc) filter (where a.customer_phone is not null))[1],
    (array_agg(a.customer_email order by a.starts_at desc) filter (where a.customer_email is not null))[1],
    (count(*) filter (where a.status = 'completed'))::integer,
    (count(*) filter (where a.status = 'no_show'))::integer,
    max(a.starts_at) filter (where a.starts_at < now() and a.status <> 'cancelled'),
    min(a.starts_at) filter (where a.starts_at >= now() and a.status = 'confirmed')
  from a
  group by a.k
  having p_search is null or p_search = ''
    or bool_or(a.customer_name ilike '%' || p_search || '%')
    or bool_or(coalesce(a.customer_phone, '') ilike '%' || p_search || '%')
    or bool_or(coalesce(a.customer_email, '') ilike '%' || p_search || '%')
  order by max(a.starts_at) desc
  limit 300;
$$;

create function public.customer_history(p_salon_id uuid, p_customer_key text)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  service_name text,
  staff_name text,
  customer_name text,
  customer_phone text,
  customer_email text,
  notes text,
  status public.appointment_status,
  source public.appointment_source
)
language sql stable security invoker
set search_path = ''
as $$
  select a.id, a.starts_at, a.ends_at, s.name, st.name, a.customer_name, a.customer_phone,
    a.customer_email, a.notes, a.status, a.source
  from public.appointments a
  join public.services s on s.id = a.service_id
  join public.staff st on st.id = a.staff_id
  where a.salon_id = p_salon_id
    and public.customer_key(a.customer_phone, a.customer_name) = p_customer_key
  order by a.starts_at desc;
$$;

-- Diritto all'oblio (GDPR): cancella i dati personali del cliente dagli
-- appuntamenti, lasciando solo data e servizio per le statistiche del salone.
create function public.forget_customer(p_salon_id uuid, p_customer_key text)
returns integer
language plpgsql security invoker
set search_path = ''
as $$
declare
  n integer;
begin
  if not public.has_salon_role(p_salon_id, 'owner') then
    raise exception 'Solo il titolare può cancellare i dati di un cliente' using errcode = '42501';
  end if;
  update public.appointments set
    customer_name = 'Cliente rimosso',
    customer_phone = null,
    customer_email = null,
    notes = null
  where salon_id = p_salon_id
    and public.customer_key(customer_phone, customer_name) = p_customer_key;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- 3. Abbonamenti (Stripe) ---------------------------------------------------
-- Scritta solo dal server quando Stripe avvisa di un pagamento (webhook),
-- con la chiave segreta che salta la RLS. Gli utenti possono solo leggerla.

create table public.subscriptions (
  salon_id uuid primary key references public.salons (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  plan text,
  status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

create policy "I membri vedono l'abbonamento del salone" on public.subscriptions
  for select to authenticated using (public.is_salon_member(salon_id));

-- Permessi -------------------------------------------------------------------

revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;

revoke execute on function public.agenda_range(uuid, date, date) from public, anon;
revoke execute on function public.customer_list(uuid, text) from public, anon;
revoke execute on function public.customer_history(uuid, text) from public, anon;
revoke execute on function public.forget_customer(uuid, text) from public, anon;
grant execute on function public.agenda_range(uuid, date, date) to authenticated;
grant execute on function public.customer_list(uuid, text) to authenticated;
grant execute on function public.customer_history(uuid, text) to authenticated;
grant execute on function public.forget_customer(uuid, text) to authenticated;

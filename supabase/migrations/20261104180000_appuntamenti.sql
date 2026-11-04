-- Fase 3: appuntamenti.
--
-- Il punto chiave è il vincolo "appointments_no_overlap": è il database
-- stesso a rifiutare due appuntamenti sovrapposti per lo stesso
-- collaboratore, anche se arrivano nello stesso istante da due persone.

create extension if not exists btree_gist with schema extensions;

create type public.appointment_status as enum ('confirmed', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('manual', 'online', 'chatbot');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  staff_id uuid not null,
  service_id uuid not null,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text check (char_length(customer_phone) <= 30),
  notes text check (char_length(notes) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  source public.appointment_source not null default 'manual',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Collaboratore e servizio devono essere dello stesso salone dell'appuntamento.
  -- "restrict": non si può eliminare chi ha appuntamenti (lo si disattiva).
  foreign key (staff_id, salon_id) references public.staff (id, salon_id) on delete restrict,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete restrict,
  -- Niente sovrapposizioni per lo stesso collaboratore (gli annullati non contano)
  constraint appointments_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('confirmed', 'completed', 'no_show'))
);

create index appointments_salon_day_idx on public.appointments (salon_id, starts_at);

-- Crea un appuntamento partendo da data e ora locali del salone.
-- Calcola la fine dalla durata del servizio e controlla che il
-- collaboratore sappia farlo. "security invoker": vale la RLS di chi chiama.

create function public.create_appointment(
  p_salon_id uuid,
  p_staff_id uuid,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_customer_name text,
  p_customer_phone text default null,
  p_notes text default null
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_tz text;
  v_duration integer;
  v_start timestamptz;
  v_id uuid;
begin
  select timezone into v_tz from public.salons where id = p_salon_id;
  if v_tz is null then
    raise exception 'Salone non trovato' using errcode = '42501';
  end if;

  select duration_min into v_duration
  from public.services where id = p_service_id and salon_id = p_salon_id;
  if v_duration is null then
    raise exception 'Servizio non trovato' using errcode = 'SB001';
  end if;

  if not exists (
    select 1 from public.staff_services
    where staff_id = p_staff_id and service_id = p_service_id and salon_id = p_salon_id
  ) then
    raise exception 'Il collaboratore non esegue questo servizio' using errcode = 'SB002';
  end if;

  v_start := (p_date + p_time) at time zone v_tz;

  insert into public.appointments (
    salon_id, staff_id, service_id, customer_name, customer_phone, notes, starts_at, ends_at
  ) values (
    p_salon_id, p_staff_id, p_service_id, trim(p_customer_name),
    nullif(trim(p_customer_phone), ''), nullif(trim(p_notes), ''),
    v_start, v_start + make_interval(mins => v_duration)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- Appuntamenti di un giorno, con orari in minuti dalla mezzanotte locale
-- (es. 9:30 = 570): comodo per disegnare l'agenda.

create function public.agenda_day(p_salon_id uuid, p_date date)
returns table (
  id uuid,
  staff_id uuid,
  service_id uuid,
  service_name text,
  customer_name text,
  customer_phone text,
  notes text,
  status public.appointment_status,
  source public.appointment_source,
  start_min integer,
  end_min integer
)
language sql stable security invoker
set search_path = ''
as $$
  with tz as (select timezone from public.salons where id = p_salon_id)
  select
    a.id, a.staff_id, a.service_id, s.name, a.customer_name, a.customer_phone, a.notes, a.status, a.source,
    (extract(epoch from (a.starts_at at time zone tz.timezone) - p_date::timestamp) / 60)::integer,
    (extract(epoch from (a.ends_at at time zone tz.timezone) - p_date::timestamp) / 60)::integer
  from public.appointments a
  join public.services s on s.id = a.service_id
  cross join tz
  where a.salon_id = p_salon_id
    and a.starts_at >= (p_date::timestamp at time zone tz.timezone)
    and a.starts_at < ((p_date + 1)::timestamp at time zone tz.timezone)
  order by a.starts_at;
$$;

-- Permessi -------------------------------------------------------------

revoke all on public.appointments from anon;
revoke execute on function public.create_appointment(uuid, uuid, uuid, date, time, text, text, text) from public, anon;
revoke execute on function public.agenda_day(uuid, date) from public, anon;
grant execute on function public.create_appointment(uuid, uuid, uuid, date, time, text, text, text) to authenticated;
grant execute on function public.agenda_day(uuid, date) to authenticated;

-- Row Level Security ---------------------------------------------------
-- Tutti i membri gestiscono l'agenda; solo il titolare può eliminare.

alter table public.appointments enable row level security;

create policy "I membri leggono l'agenda" on public.appointments
  for select to authenticated using (public.is_salon_member(salon_id));

create policy "I membri aggiungono appuntamenti" on public.appointments
  for insert to authenticated with check (public.is_salon_member(salon_id));

create policy "I membri aggiornano appuntamenti" on public.appointments
  for update to authenticated
  using (public.is_salon_member(salon_id))
  with check (public.is_salon_member(salon_id));

create policy "Il titolare elimina appuntamenti" on public.appointments
  for delete to authenticated using (public.has_salon_role(salon_id, 'owner'));

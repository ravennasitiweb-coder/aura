-- SCHEMA COMPLETO DI SMARTBOOKING
-- Unione di tutti i file in supabase/migrations, nell'ordine giusto.
-- Da eseguire UNA SOLA VOLTA su un database Supabase NUOVO e vuoto
-- (es. il database di produzione). NON eseguirlo sul database di prova,
-- che ha già tutte queste tabelle.


-- ============================================================
-- 20261104120000_saloni_e_membri.sql
-- ============================================================

-- Fase 1: saloni e membri, con isolamento tra saloni (multi-tenant).
--
-- Regola generale: ogni dato appartiene a un salone (salon_id) e la
-- Row Level Security (RLS) lascia vedere a un utente solo i saloni
-- di cui è membro. Anche un errore nel codice dell'app non può
-- esporre i dati di un altro salone.

create type public.member_role as enum ('owner', 'staff');

-- Saloni ---------------------------------------------------------------

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  -- Indirizzo pubblico della pagina di prenotazione, es. /p/salone-aurora
  slug text not null unique
    check (char_length(slug) between 3 and 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  city text check (char_length(city) <= 80),
  timezone text not null default 'Europe/Rome',
  created_at timestamptz not null default now()
);

-- Membri: chi lavora in quale salone e con che ruolo -------------------

create table public.salon_members (
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (salon_id, user_id)
);

create index salon_members_user_id_idx on public.salon_members (user_id);

-- Funzioni di controllo usate dalle regole RLS -------------------------
-- "security definer" permette di leggere salon_members senza far
-- scattare di nuovo le sue stesse regole (eviterebbe un ciclo infinito).

create function public.is_salon_member(p_salon_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id and user_id = (select auth.uid())
  );
$$;

create function public.has_salon_role(p_salon_id uuid, p_role public.member_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id and user_id = (select auth.uid()) and role = p_role
  );
$$;

-- Creazione salone: crea il salone e rende titolare chi lo crea,
-- in un'unica operazione (o tutto o niente).

create function public.create_salon(p_name text, p_slug text, p_city text default null)
returns public.salons
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_salon public.salons;
begin
  if v_user_id is null then
    raise exception 'Accesso richiesto' using errcode = '28000';
  end if;

  insert into public.salons (name, slug, city)
  values (trim(p_name), lower(trim(p_slug)), nullif(trim(p_city), ''))
  returning * into v_salon;

  insert into public.salon_members (salon_id, user_id, role)
  values (v_salon.id, v_user_id, 'owner');

  return v_salon;
end;
$$;

-- Permessi -------------------------------------------------------------
-- Gli utenti non loggati (anon) non toccano queste tabelle.
-- La pagina pubblica del salone avrà più avanti un accesso dedicato e limitato.

revoke all on public.salons, public.salon_members from anon;
revoke execute on function public.is_salon_member(uuid) from public, anon;
revoke execute on function public.has_salon_role(uuid, public.member_role) from public, anon;
revoke execute on function public.create_salon(text, text, text) from public, anon;
grant execute on function public.is_salon_member(uuid) to authenticated;
grant execute on function public.has_salon_role(uuid, public.member_role) to authenticated;
grant execute on function public.create_salon(text, text, text) to authenticated;

-- Row Level Security ---------------------------------------------------

alter table public.salons enable row level security;
alter table public.salon_members enable row level security;

create policy "I membri vedono il proprio salone"
  on public.salons for select to authenticated
  using (public.is_salon_member(id));

create policy "Il titolare modifica il proprio salone"
  on public.salons for update to authenticated
  using (public.has_salon_role(id, 'owner'))
  with check (public.has_salon_role(id, 'owner'));

create policy "I membri vedono i colleghi dello stesso salone"
  on public.salon_members for select to authenticated
  using (public.is_salon_member(salon_id));

-- Nessuna regola di insert/update/delete diretta: i saloni si creano solo
-- con create_salon(), e gli inviti ai collaboratori arriveranno in seguito.

-- ============================================================
-- 20261104150000_servizi_collaboratori_orari.sql
-- ============================================================

-- Fase 2: configurazione del salone (servizi, collaboratori, orari).
-- Stesse regole della Fase 1: i membri leggono, solo il titolare modifica.

-- Servizi --------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  duration_min integer not null check (duration_min between 5 and 480),
  price_cents integer not null default 0 check (price_cents between 0 and 10000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  -- Serve per collegare in modo sicuro solo servizi e collaboratori dello stesso salone
  unique (id, salon_id)
);

create index services_salon_id_idx on public.services (salon_id);

-- Collaboratori (chi riceve appuntamenti; non serve che abbia un account) ---

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  role_title text check (char_length(role_title) <= 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, salon_id)
);

create index staff_salon_id_idx on public.staff (salon_id);

-- Quali servizi sa fare ogni collaboratore.
-- Le chiavi composte impediscono di collegare elementi di saloni diversi.

create table public.staff_services (
  salon_id uuid not null,
  staff_id uuid not null,
  service_id uuid not null,
  primary key (staff_id, service_id),
  foreign key (staff_id, salon_id) references public.staff (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade
);

create index staff_services_salon_id_idx on public.staff_services (salon_id);

-- Orari di apertura: una o più fasce per giorno (es. 9-13 e 15-19).
-- weekday: 1 = lunedì ... 7 = domenica

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at)
);

create index opening_hours_salon_id_idx on public.opening_hours (salon_id, weekday);

-- Salvataggio degli orari della settimana in un colpo solo.
-- "security invoker": vale la RLS di chi chiama, quindi solo il titolare può farlo.

create function public.set_opening_hours(p_salon_id uuid, p_hours jsonb)
returns void
language plpgsql security invoker
set search_path = ''
as $$
begin
  if not public.has_salon_role(p_salon_id, 'owner') then
    raise exception 'Solo il titolare può modificare gli orari' using errcode = '42501';
  end if;

  delete from public.opening_hours where salon_id = p_salon_id;

  insert into public.opening_hours (salon_id, weekday, opens_at, closes_at)
  select p_salon_id, (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time
  from jsonb_array_elements(p_hours) as h;
end;
$$;

-- Permessi -------------------------------------------------------------

revoke all on public.services, public.staff, public.staff_services, public.opening_hours from anon;
revoke execute on function public.set_opening_hours(uuid, jsonb) from public, anon;
grant execute on function public.set_opening_hours(uuid, jsonb) to authenticated;

-- Row Level Security ---------------------------------------------------

alter table public.services enable row level security;
alter table public.staff enable row level security;
alter table public.staff_services enable row level security;
alter table public.opening_hours enable row level security;

-- Le stesse quattro regole per ogni tabella
do $$
declare
  t text;
begin
  foreach t in array array['services', 'staff', 'staff_services', 'opening_hours'] loop
    execute format(
      'create policy "I membri leggono" on public.%I for select to authenticated using (public.is_salon_member(salon_id))', t);
    execute format(
      'create policy "Il titolare aggiunge" on public.%I for insert to authenticated with check (public.has_salon_role(salon_id, %L))', t, 'owner');
    execute format(
      'create policy "Il titolare modifica" on public.%I for update to authenticated using (public.has_salon_role(salon_id, %L)) with check (public.has_salon_role(salon_id, %L))', t, 'owner', 'owner');
    execute format(
      'create policy "Il titolare elimina" on public.%I for delete to authenticated using (public.has_salon_role(salon_id, %L))', t, 'owner');
  end loop;
end;
$$;

-- ============================================================
-- 20261104180000_appuntamenti.sql
-- ============================================================

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

-- ============================================================
-- 20261105090000_prenotazione_pubblica.sql
-- ============================================================

-- Fase 4: prenotazione pubblica dalla pagina /p/[salone].
--
-- I visitatori (anon) NON accedono alle tabelle. Hanno solo tre funzioni
-- "security definer" che restituiscono il minimo indispensabile e
-- ricontrollano ogni regola prima di salvare.

-- Dati del cliente raccolti online
alter table public.appointments
  add column customer_email text check (char_length(customer_email) <= 254),
  add column privacy_consent_at timestamptz;

-- L'agenda mostra anche l'email: si ricrea la funzione con il nuovo campo
drop function public.agenda_day(uuid, date);

create function public.agenda_day(p_salon_id uuid, p_date date)
returns table (
  id uuid,
  staff_id uuid,
  service_id uuid,
  service_name text,
  customer_name text,
  customer_phone text,
  customer_email text,
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
    a.id, a.staff_id, a.service_id, s.name, a.customer_name, a.customer_phone, a.customer_email,
    a.notes, a.status, a.source,
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

revoke execute on function public.agenda_day(uuid, date) from public, anon;
grant execute on function public.agenda_day(uuid, date) to authenticated;

-- 1. Informazioni pubbliche del salone -----------------------------------
-- Solo servizi attivi che almeno un collaboratore attivo sa fare.
-- Dei collaboratori si espone solo il nome.

create function public.public_salon_info(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'salon', jsonb_build_object('name', s.name, 'city', s.city, 'slug', s.slug),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sv.id, 'name', sv.name, 'duration_min', sv.duration_min, 'price_cents', sv.price_cents
      ) order by sv.created_at)
      from public.services sv
      where sv.salon_id = s.id and sv.active
        and exists (
          select 1 from public.staff_services ss
          join public.staff st on st.id = ss.staff_id
          where ss.service_id = sv.id and st.active
        )
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id,
        'name', st.name,
        'service_ids', coalesce((select jsonb_agg(ss.service_id) from public.staff_services ss where ss.staff_id = st.id), '[]'::jsonb)
      ) order by st.created_at)
      from public.staff st
      where st.salon_id = s.id and st.active
    ), '[]'::jsonb),
    'open_weekdays', coalesce((
      select jsonb_agg(distinct oh.weekday) from public.opening_hours oh where oh.salon_id = s.id
    ), '[]'::jsonb)
  )
  from public.salons s
  where s.slug = lower(p_slug);
$$;

-- 2. Fasce di apertura e orari occupati di un giorno ----------------------
-- Nessun dato dei clienti: solo "chi è occupato da che ora a che ora".

create function public.public_day(p_slug text, p_date date)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with s as (select id, timezone from public.salons where slug = lower(p_slug))
  select jsonb_build_object(
    'open_ranges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'start', (extract(epoch from oh.opens_at) / 60)::integer,
        'end', (extract(epoch from oh.closes_at) / 60)::integer
      ) order by oh.opens_at)
      from public.opening_hours oh
      where oh.salon_id = s.id and oh.weekday = extract(isodow from p_date)
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object(
        'staff_id', a.staff_id,
        'start', (extract(epoch from (a.starts_at at time zone s.timezone) - p_date::timestamp) / 60)::integer,
        'end', (extract(epoch from (a.ends_at at time zone s.timezone) - p_date::timestamp) / 60)::integer
      ))
      from public.appointments a
      where a.salon_id = s.id
        and a.status <> 'cancelled'
        and a.starts_at < ((p_date + 1)::timestamp at time zone s.timezone)
        and a.ends_at > (p_date::timestamp at time zone s.timezone)
    ), '[]'::jsonb)
  )
  from s;
$$;

-- Telefono in forma confrontabile: solo cifre, senza prefisso italiano
-- "+39 333 111 2222", "0039 333..." e "333 111 2222" diventano "3331112222"
create function public.normalize_phone(p_phone text)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when d like '0039%' then substr(d, 5)
    when d like '39%' and char_length(d) >= 11 then substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) as x;
$$;

-- 3. Prenotazione ---------------------------------------------------------
-- Ricontrolla tutte le regole: non si fida di nulla che arrivi dal browser.
-- Codici di errore SBxxx: l'app li traduce in messaggi in italiano.

create function public.public_book(
  p_slug text,
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_phone text,
  p_email text,
  p_privacy boolean
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
  v_service public.services;
  v_staff public.staff;
  v_start timestamptz;
  v_end_time time;
  v_phone_digits text := public.normalize_phone(p_phone);
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_id uuid;
begin
  -- Dati del cliente
  if not coalesce(p_privacy, false) then
    raise exception 'Consenso privacy mancante' using errcode = 'SB010';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then
    raise exception 'Nome non valido' using errcode = 'SB011';
  end if;
  if char_length(v_phone_digits) not between 6 and 15 or char_length(p_phone) > 30 then
    raise exception 'Telefono non valido' using errcode = 'SB012';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Email non valida' using errcode = 'SB013';
  end if;

  -- Salone, servizio e collaboratore
  select * into v_salon from public.salons where slug = lower(p_slug);
  if not found then
    raise exception 'Salone non trovato' using errcode = 'SB020';
  end if;
  select * into v_service from public.services where id = p_service_id and salon_id = v_salon.id and active;
  if not found then
    raise exception 'Servizio non disponibile' using errcode = 'SB001';
  end if;
  select * into v_staff from public.staff where id = p_staff_id and salon_id = v_salon.id and active;
  if not found or not exists (
    select 1 from public.staff_services where staff_id = p_staff_id and service_id = p_service_id
  ) then
    raise exception 'Collaboratore non disponibile per il servizio' using errcode = 'SB002';
  end if;

  -- Orario
  v_start := (p_date + p_time) at time zone v_salon.timezone;
  v_end_time := p_time + make_interval(mins => v_service.duration_min);

  if v_start < now() + interval '15 minutes' then
    raise exception 'Orario già passato' using errcode = 'SB021';
  end if;
  if p_date > (now() at time zone v_salon.timezone)::date + 90 then
    raise exception 'Troppo avanti nel tempo' using errcode = 'SB022';
  end if;
  if extract(minute from p_time)::integer % 15 <> 0
    or v_end_time <= p_time -- il servizio sforerebbe la mezzanotte
    or not exists (
      select 1 from public.opening_hours
      where salon_id = v_salon.id
        and weekday = extract(isodow from p_date)
        and opens_at <= p_time
        and closes_at >= v_end_time
    ) then
    raise exception 'Fuori dall''orario di apertura' using errcode = 'SB023';
  end if;

  -- Anti-abuso: massimo 3 prenotazioni future con lo stesso telefono
  if (
    select count(*) from public.appointments
    where salon_id = v_salon.id
      and status = 'confirmed'
      and starts_at > now()
      and public.normalize_phone(customer_phone) = v_phone_digits
  ) >= 3 then
    raise exception 'Troppe prenotazioni' using errcode = 'SB024';
  end if;

  -- Il vincolo anti-sovrapposizione blocca l'orario se nel frattempo è stato preso
  insert into public.appointments (
    salon_id, staff_id, service_id, customer_name, customer_phone, customer_email,
    starts_at, ends_at, source, privacy_consent_at
  ) values (
    v_salon.id, p_staff_id, p_service_id, trim(p_name), trim(p_phone), v_email,
    v_start, v_start + make_interval(mins => v_service.duration_min), 'online', now()
  )
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'starts_at', v_start,
    'ends_at', v_start + make_interval(mins => v_service.duration_min),
    'service_name', v_service.name,
    'staff_name', v_staff.name,
    'salon_name', v_salon.name
  );
end;
$$;

-- Permessi: queste tre funzioni sono le uniche aperte ai visitatori
revoke execute on function public.public_salon_info(text) from public;
revoke execute on function public.public_day(text, date) from public;
revoke execute on function public.public_book(text, uuid, uuid, date, time, text, text, text, boolean) from public;
grant execute on function public.public_salon_info(text) to anon, authenticated;
grant execute on function public.public_day(text, date) to anon, authenticated;
grant execute on function public.public_book(text, uuid, uuid, date, time, text, text, text, boolean) to anon, authenticated;

-- ============================================================
-- 20261105120000_modifica_appuntamenti.sql
-- ============================================================

-- Modifica e spostamento di un appuntamento.
-- Stesse regole della creazione: la fine si ricalcola dalla durata del
-- servizio, il collaboratore deve saperlo fare, e il vincolo
-- anti-sovrapposizione blocca gli spostamenti su orari occupati.
-- "security invoker": vale la RLS di chi chiama (solo membri del salone).

create function public.update_appointment(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_customer_name text,
  p_customer_phone text default null,
  p_notes text default null
)
returns void
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_salon_id uuid;
  v_tz text;
  v_duration integer;
  v_start timestamptz;
begin
  -- La RLS fa trovare l'appuntamento solo ai membri del suo salone
  select a.salon_id, s.timezone into v_salon_id, v_tz
  from public.appointments a
  join public.salons s on s.id = a.salon_id
  where a.id = p_appointment_id;
  if v_salon_id is null then
    raise exception 'Appuntamento non trovato' using errcode = '42501';
  end if;

  select duration_min into v_duration
  from public.services where id = p_service_id and salon_id = v_salon_id;
  if v_duration is null then
    raise exception 'Servizio non trovato' using errcode = 'SB001';
  end if;

  if not exists (
    select 1 from public.staff_services
    where staff_id = p_staff_id and service_id = p_service_id and salon_id = v_salon_id
  ) then
    raise exception 'Il collaboratore non esegue questo servizio' using errcode = 'SB002';
  end if;

  v_start := (p_date + p_time) at time zone v_tz;

  update public.appointments set
    staff_id = p_staff_id,
    service_id = p_service_id,
    customer_name = trim(p_customer_name),
    customer_phone = nullif(trim(p_customer_phone), ''),
    notes = nullif(trim(p_notes), ''),
    starts_at = v_start,
    ends_at = v_start + make_interval(mins => v_duration)
  where id = p_appointment_id;
end;
$$;

revoke execute on function public.update_appointment(uuid, uuid, uuid, date, time, text, text, text) from public, anon;
grant execute on function public.update_appointment(uuid, uuid, uuid, date, time, text, text, text) to authenticated;

-- ============================================================
-- 20261105150000_settimana_clienti_abbonamenti.sql
-- ============================================================

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

-- ============================================================
-- 20261105160000_correzione_agenda_range.sql
-- ============================================================

-- Correzione di agenda_range: in una funzione plpgsql che restituisce una
-- tabella con colonna "id", scrivere solo "id" è ambiguo (colonna del salone
-- o colonna restituita?). Qui ogni colonna ha il nome della tabella davanti.

create or replace function public.agenda_range(p_salon_id uuid, p_from date, p_to date)
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
  select sl.timezone into v_tz from public.salons sl where sl.id = p_salon_id;

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

-- ============================================================
-- 20261105170000_tipi_di_attivita.sql
-- ============================================================

-- SmartBooking per più tipi di attività (non solo saloni).
-- Ogni attività ha un tipo: l'elenco è lo stesso di src/lib/business-types.ts.
-- Quelle già registrate diventano "parrucchiere", quindi non cambia nulla.

alter table public.salons
  add column business_type text not null default 'parrucchiere'
  check (business_type in (
    'parrucchiere', 'barbiere', 'estetista', 'onicotecnica',
    'tatuatore', 'massaggi', 'personal_trainer', 'toelettatura'
  ));

-- create_salon riceve anche il tipo. Si elimina la versione precedente:
-- con due versioni dello stesso nome il database non saprebbe quale usare.
drop function public.create_salon(text, text, text);

create function public.create_salon(
  p_name text,
  p_slug text,
  p_city text default null,
  p_business_type text default 'parrucchiere'
)
returns public.salons
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_salon public.salons;
begin
  if v_user_id is null then
    raise exception 'Accesso richiesto' using errcode = '28000';
  end if;

  insert into public.salons (name, slug, city, business_type)
  values (trim(p_name), lower(trim(p_slug)), nullif(trim(p_city), ''), p_business_type)
  returning * into v_salon;

  insert into public.salon_members (salon_id, user_id, role)
  values (v_salon.id, v_user_id, 'owner');

  return v_salon;
end;
$$;

revoke execute on function public.create_salon(text, text, text, text) from public, anon;
grant execute on function public.create_salon(text, text, text, text) to authenticated;

-- La pagina pubblica mostra il tipo di attività (es. "Studio tatuaggi")
create or replace function public.public_salon_info(p_slug text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'salon', jsonb_build_object('name', s.name, 'city', s.city, 'slug', s.slug, 'business_type', s.business_type),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sv.id, 'name', sv.name, 'duration_min', sv.duration_min, 'price_cents', sv.price_cents
      ) order by sv.created_at)
      from public.services sv
      where sv.salon_id = s.id and sv.active
        and exists (
          select 1 from public.staff_services ss
          join public.staff st on st.id = ss.staff_id
          where ss.service_id = sv.id and st.active
        )
    ), '[]'::jsonb),
    'staff', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', st.id,
        'name', st.name,
        'service_ids', coalesce((select jsonb_agg(ss.service_id) from public.staff_services ss where ss.staff_id = st.id), '[]'::jsonb)
      ) order by st.created_at)
      from public.staff st
      where st.salon_id = s.id and st.active
    ), '[]'::jsonb),
    'open_weekdays', coalesce((
      select jsonb_agg(distinct oh.weekday) from public.opening_hours oh where oh.salon_id = s.id
    ), '[]'::jsonb)
  )
  from public.salons s
  where s.slug = lower(p_slug);
$$;

-- ============================================================
-- 20261105180000_altri_tipi_di_attivita.sql
-- ============================================================

-- Altri tipi di attività: tutte quelle "semplici" (un cliente, un
-- professionista, un servizio a durata fissa). L'elenco è generato da
-- src/lib/business-types.ts: il test business-types.test.ts lo confronta.
-- Le attività già registrate non cambiano.

-- Toglie il vincolo precedente, qualunque nome abbia ricevuto
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.salons'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%business_type%'
  loop
    execute format('alter table public.salons drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.salons
  add constraint salons_business_type_check
  check (business_type in (
    'parrucchiere',
    'barbiere',
    'estetista',
    'onicotecnica',
    'tatuatore',
    'lash_maker',
    'brow_specialist',
    'make_up_artist',
    'parrucchiere_domicilio',
    'solarium',
    'piercing',
    'trucco_semipermanente',
    'massaggi',
    'riflessologia',
    'shiatsu_reiki',
    'consulente_immagine',
    'personal_trainer',
    'pilates',
    'yoga',
    'tennis_padel',
    'nuoto',
    'scuola_guida',
    'sci',
    'musica',
    'ripetizioni',
    'lingue',
    'informatica',
    'coaching',
    'lezioni_fotografia',
    'consulenza',
    'fotografo',
    'avvocato',
    'notaio',
    'immobiliare',
    'architetto',
    'wedding_planner',
    'sartoria',
    'calzolaio',
    'riparazioni_tech',
    'gommista',
    'autolavaggio',
    'officina',
    'interventi_domicilio',
    'toelettatura',
    'addestramento_cani',
    'pet_sitter',
    'dog_walker'
  ));

-- ============================================================
-- 20261105190000_salto_di_qualita.sql
-- ============================================================

-- Salto di qualità: orari e assenze per collaboratore, account dei
-- collaboratori, promemoria con conferma/sposta/annulla, lista d'attesa,
-- consensi marketing, richiamo clienti, recensioni, note cliente, statistiche.
--
-- Convenzione: in ogni funzione le colonne hanno sempre il nome della
-- tabella davanti (es. a.id, sl.id), per evitare nomi ambigui.

-- 1. Nuove impostazioni dell'attività -------------------------------------

alter table public.salons
  add column cancel_hours integer not null default 24 check (cancel_hours between 0 and 168),
  add column reminders_enabled boolean not null default true,
  add column daily_summary boolean not null default true,
  add column recall_days integer check (recall_days between 14 and 365),
  add column google_review_url text check (google_review_url ~ '^https://' and char_length(google_review_url) <= 300);

-- 2. Collaboratori: account collegato e calendario personale ---------------

alter table public.staff
  add column user_id uuid references auth.users (id) on delete set null,
  add column calendar_token uuid not null default gen_random_uuid() unique;

-- Orari personali: se un collaboratore ne ha, valgono i suoi; altrimenti quelli dell'attività
create table public.staff_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  staff_id uuid not null,
  weekday smallint not null check (weekday between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  check (closes_at > opens_at),
  foreign key (staff_id, salon_id) references public.staff (id, salon_id) on delete cascade
);
create index staff_hours_staff_idx on public.staff_hours (staff_id, weekday);

-- Ferie, permessi, malattia: in quei momenti il collaboratore non è prenotabile
create table public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null,
  staff_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (char_length(reason) <= 80),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  foreign key (staff_id, salon_id) references public.staff (id, salon_id) on delete cascade
);
create index staff_time_off_staff_idx on public.staff_time_off (staff_id, starts_at);

-- 3. Appuntamenti: link personale del cliente e consensi -------------------

alter table public.appointments
  add column manage_token uuid not null default gen_random_uuid() unique,
  add column customer_confirmed_at timestamptz,
  add column marketing_consent_at timestamptz,
  add column reminder_sent_at timestamptz;

-- 4. Inviti ai collaboratori -----------------------------------------------

create table public.salon_invites (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  staff_id uuid,
  email text not null check (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  foreign key (staff_id, salon_id) references public.staff (id, salon_id) on delete cascade
);

-- 5. Lista d'attesa --------------------------------------------------------

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  service_id uuid not null,
  staff_id uuid,
  day date not null,
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  customer_phone text not null check (char_length(customer_phone) <= 30),
  customer_email text not null check (char_length(customer_email) <= 254),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade
);
create index waitlist_salon_day_idx on public.waitlist (salon_id, day);

-- 6. Disiscrizioni, registro messaggi, note cliente ------------------------

create table public.marketing_optouts (
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_key text not null,
  created_at timestamptz not null default now(),
  primary key (salon_id, customer_key)
);

-- Ogni messaggio automatico viene registrato: così non parte mai due volte
create table public.message_log (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  kind text not null,
  ref text not null,
  sent_at timestamptz not null default now(),
  unique (salon_id, kind, ref)
);

create table public.customer_notes (
  salon_id uuid not null references public.salons (id) on delete cascade,
  customer_key text not null,
  notes text not null check (char_length(notes) <= 2000),
  updated_at timestamptz not null default now(),
  primary key (salon_id, customer_key)
);

-- 7. Permessi e Row Level Security -----------------------------------------

revoke all on public.staff_hours, public.staff_time_off, public.salon_invites, public.waitlist,
  public.marketing_optouts, public.message_log, public.customer_notes from anon;

alter table public.staff_hours enable row level security;
alter table public.staff_time_off enable row level security;
alter table public.salon_invites enable row level security;
alter table public.waitlist enable row level security;
alter table public.marketing_optouts enable row level security;
alter table public.message_log enable row level security;
alter table public.customer_notes enable row level security;

-- Orari e assenze: i membri leggono, il titolare modifica
do $$
declare
  t text;
begin
  foreach t in array array['staff_hours', 'staff_time_off'] loop
    execute format('create policy "I membri leggono" on public.%I for select to authenticated using (public.is_salon_member(salon_id))', t);
    execute format('create policy "Il titolare aggiunge" on public.%I for insert to authenticated with check (public.has_salon_role(salon_id, %L))', t, 'owner');
    execute format('create policy "Il titolare modifica" on public.%I for update to authenticated using (public.has_salon_role(salon_id, %L)) with check (public.has_salon_role(salon_id, %L))', t, 'owner', 'owner');
    execute format('create policy "Il titolare elimina" on public.%I for delete to authenticated using (public.has_salon_role(salon_id, %L))', t, 'owner');
  end loop;
end;
$$;

-- Inviti: solo il titolare
create policy "Il titolare vede gli inviti" on public.salon_invites for select to authenticated using (public.has_salon_role(salon_id, 'owner'));
create policy "Il titolare crea inviti" on public.salon_invites for insert to authenticated with check (public.has_salon_role(salon_id, 'owner'));
create policy "Il titolare elimina inviti" on public.salon_invites for delete to authenticated using (public.has_salon_role(salon_id, 'owner'));

-- Lista d'attesa: i membri la vedono e la puliscono (le iscrizioni arrivano dalla pagina pubblica)
create policy "I membri leggono la lista d'attesa" on public.waitlist for select to authenticated using (public.is_salon_member(salon_id));
create policy "I membri eliminano dalla lista d'attesa" on public.waitlist for delete to authenticated using (public.is_salon_member(salon_id));

-- Disiscrizioni e registro: solo lettura per i membri (scrive il sistema)
create policy "I membri leggono le disiscrizioni" on public.marketing_optouts for select to authenticated using (public.is_salon_member(salon_id));
create policy "I membri leggono il registro" on public.message_log for select to authenticated using (public.is_salon_member(salon_id));
revoke insert, update, delete on public.marketing_optouts, public.message_log from authenticated;

-- Note cliente: tutti i membri leggono e scrivono
create policy "I membri leggono le note" on public.customer_notes for select to authenticated using (public.is_salon_member(salon_id));
create policy "I membri aggiungono note" on public.customer_notes for insert to authenticated with check (public.is_salon_member(salon_id));
create policy "I membri modificano note" on public.customer_notes for update to authenticated using (public.is_salon_member(salon_id)) with check (public.is_salon_member(salon_id));
create policy "I membri eliminano note" on public.customer_notes for delete to authenticated using (public.is_salon_member(salon_id));

-- 8. Controllo unico di un orario prenotabile ------------------------------
-- Usato da prenotazione online, spostamento dal cliente e lista d'attesa.
-- Restituisce il codice del problema (SBxxx) oppure null se va tutto bene.
-- Non è accessibile direttamente dai visitatori.

create function public.slot_problem(
  p_salon_id uuid,
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time time
)
returns text
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_duration integer;
  v_start timestamptz;
  v_end timestamptz;
  v_end_time time;
  v_weekday smallint := extract(isodow from p_date)::smallint;
begin
  select sl.timezone into v_tz from public.salons sl where sl.id = p_salon_id;
  if v_tz is null then return 'SB020'; end if;

  select sv.duration_min into v_duration
  from public.services sv where sv.id = p_service_id and sv.salon_id = p_salon_id and sv.active;
  if v_duration is null then return 'SB001'; end if;

  if not exists (
    select 1 from public.staff st
    join public.staff_services ss on ss.staff_id = st.id and ss.service_id = p_service_id
    where st.id = p_staff_id and st.salon_id = p_salon_id and st.active
  ) then
    return 'SB002';
  end if;

  v_start := (p_date + p_time) at time zone v_tz;
  v_end := v_start + make_interval(mins => v_duration);
  v_end_time := p_time + make_interval(mins => v_duration);

  if v_start < now() + interval '15 minutes' then return 'SB021'; end if;
  if p_date > (now() at time zone v_tz)::date + 90 then return 'SB022'; end if;
  if extract(minute from p_time)::integer % 15 <> 0 or v_end_time <= p_time then return 'SB023'; end if;

  -- Orari personali del collaboratore, se ne ha; altrimenti quelli dell'attività
  if exists (select 1 from public.staff_hours sh where sh.staff_id = p_staff_id) then
    if not exists (
      select 1 from public.staff_hours sh
      where sh.staff_id = p_staff_id and sh.weekday = v_weekday and sh.opens_at <= p_time and sh.closes_at >= v_end_time
    ) then
      return 'SB023';
    end if;
  elsif not exists (
    select 1 from public.opening_hours oh
    where oh.salon_id = p_salon_id and oh.weekday = v_weekday and oh.opens_at <= p_time and oh.closes_at >= v_end_time
  ) then
    return 'SB023';
  end if;

  if exists (
    select 1 from public.staff_time_off off
    where off.staff_id = p_staff_id and off.starts_at < v_end and off.ends_at > v_start
  ) then
    return 'SB025';
  end if;

  -- Gli appuntamenti sovrapposti li blocca il vincolo del database (appointments_no_overlap)
  return null;
end;
$$;

revoke execute on function public.slot_problem(uuid, uuid, uuid, date, time) from public, anon, authenticated;

-- 9. Giorno pubblico: anche orari personali e assenze ----------------------

create or replace function public.public_day(p_slug text, p_date date)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  with sl as (select s.id, s.timezone from public.salons s where s.slug = lower(p_slug)),
  day_start as (select (p_date::timestamp at time zone sl.timezone) as t0, ((p_date + 1)::timestamp at time zone sl.timezone) as t1 from sl)
  select jsonb_build_object(
    'open_ranges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'start', (extract(epoch from oh.opens_at) / 60)::integer,
        'end', (extract(epoch from oh.closes_at) / 60)::integer
      ) order by oh.opens_at)
      from public.opening_hours oh
      where oh.salon_id = sl.id and oh.weekday = extract(isodow from p_date)
    ), '[]'::jsonb),
    -- Collaboratori con orari personali e le loro fasce di quel giorno
    'staff_with_hours', coalesce((
      select jsonb_agg(distinct sh.staff_id) from public.staff_hours sh where sh.salon_id = sl.id
    ), '[]'::jsonb),
    'staff_ranges', coalesce((
      select jsonb_agg(jsonb_build_object(
        'staff_id', sh.staff_id,
        'start', (extract(epoch from sh.opens_at) / 60)::integer,
        'end', (extract(epoch from sh.closes_at) / 60)::integer
      ))
      from public.staff_hours sh
      where sh.salon_id = sl.id and sh.weekday = extract(isodow from p_date)
    ), '[]'::jsonb),
    -- Occupato: appuntamenti e assenze, in minuti del giorno (tagliati a 0–1440)
    'busy', coalesce((
      select jsonb_agg(b) from (
        select jsonb_build_object(
          'staff_id', a.staff_id,
          'start', greatest(0, (extract(epoch from (a.starts_at at time zone sl.timezone) - p_date::timestamp) / 60)::integer),
          'end', least(1440, (extract(epoch from (a.ends_at at time zone sl.timezone) - p_date::timestamp) / 60)::integer)
        ) as b
        from public.appointments a, day_start d
        where a.salon_id = sl.id and a.status <> 'cancelled' and a.starts_at < d.t1 and a.ends_at > d.t0
        union all
        select jsonb_build_object(
          'staff_id', off.staff_id,
          'start', greatest(0, (extract(epoch from (off.starts_at at time zone sl.timezone) - p_date::timestamp) / 60)::integer),
          'end', least(1440, (extract(epoch from (off.ends_at at time zone sl.timezone) - p_date::timestamp) / 60)::integer)
        )
        from public.staff_time_off off, day_start d
        where off.salon_id = sl.id and off.starts_at < d.t1 and off.ends_at > d.t0
      ) as x
    ), '[]'::jsonb)
  )
  from sl;
$$;

-- 10. Prenotazione online: controlli unificati + consenso marketing --------

drop function public.public_book(text, uuid, uuid, date, time, text, text, text, boolean);

create function public.public_book(
  p_slug text,
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_phone text,
  p_email text,
  p_privacy boolean,
  p_marketing boolean default false
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
  v_duration integer;
  v_service_name text;
  v_staff_name text;
  v_problem text;
  v_start timestamptz;
  v_phone_key text := public.normalize_phone(p_phone);
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_id uuid;
  v_token uuid;
begin
  if not coalesce(p_privacy, false) then raise exception 'Consenso privacy mancante' using errcode = 'SB010'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Nome non valido' using errcode = 'SB011'; end if;
  if char_length(v_phone_key) not between 6 and 15 or char_length(p_phone) > 30 then raise exception 'Telefono non valido' using errcode = 'SB012'; end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Email non valida' using errcode = 'SB013';
  end if;

  select * into v_salon from public.salons sl where sl.slug = lower(p_slug);
  if not found then raise exception 'Attività non trovata' using errcode = 'SB020'; end if;

  v_problem := public.slot_problem(v_salon.id, p_service_id, p_staff_id, p_date, p_time);
  if v_problem is not null then raise exception 'Orario non prenotabile' using errcode = v_problem; end if;

  if (
    select count(*) from public.appointments a
    where a.salon_id = v_salon.id and a.status = 'confirmed' and a.starts_at > now()
      and public.normalize_phone(a.customer_phone) = v_phone_key
  ) >= 3 then
    raise exception 'Troppe prenotazioni' using errcode = 'SB024';
  end if;

  select sv.duration_min, sv.name into v_duration, v_service_name from public.services sv where sv.id = p_service_id;
  select st.name into v_staff_name from public.staff st where st.id = p_staff_id;
  v_start := (p_date + p_time) at time zone v_salon.timezone;

  insert into public.appointments (
    salon_id, staff_id, service_id, customer_name, customer_phone, customer_email,
    starts_at, ends_at, source, privacy_consent_at, marketing_consent_at
  ) values (
    v_salon.id, p_staff_id, p_service_id, trim(p_name), trim(p_phone), v_email,
    v_start, v_start + make_interval(mins => v_duration), 'online', now(),
    case when coalesce(p_marketing, false) then now() end
  )
  returning id, manage_token into v_id, v_token;

  return jsonb_build_object(
    'id', v_id,
    'manage_token', v_token,
    'starts_at', v_start,
    'ends_at', v_start + make_interval(mins => v_duration),
    'service_name', v_service_name,
    'staff_name', v_staff_name,
    'salon_name', v_salon.name
  );
end;
$$;

revoke execute on function public.public_book(text, uuid, uuid, date, time, text, text, text, boolean, boolean) from public;
grant execute on function public.public_book(text, uuid, uuid, date, time, text, text, text, boolean, boolean) to anon, authenticated;

-- 11. Il cliente gestisce il suo appuntamento dal link personale -----------

create function public.public_appointment(p_token uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'salon_name', sl.name,
    'salon_slug', sl.slug,
    'business_type', sl.business_type,
    'service_name', sv.name,
    'staff_name', st.name,
    'starts_at', a.starts_at,
    'ends_at', a.ends_at,
    'status', a.status,
    'customer_name', a.customer_name,
    'confirmed', a.customer_confirmed_at is not null,
    'cancel_hours', sl.cancel_hours,
    'can_change', a.status = 'confirmed' and now() < a.starts_at - make_interval(hours => sl.cancel_hours)
  )
  from public.appointments a
  join public.salons sl on sl.id = a.salon_id
  join public.services sv on sv.id = a.service_id
  join public.staff st on st.id = a.staff_id
  where a.manage_token = p_token;
$$;

create function public.public_confirm(p_token uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.appointments a set customer_confirmed_at = coalesce(a.customer_confirmed_at, now())
  where a.manage_token = p_token and a.status = 'confirmed' and a.starts_at > now();
  get diagnostics n = row_count;
  return n = 1;
end;
$$;

create function public.public_cancel(p_token uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  n integer;
begin
  update public.appointments a set status = 'cancelled'
  from public.salons sl
  where a.manage_token = p_token
    and sl.id = a.salon_id
    and a.status = 'confirmed'
    and now() < a.starts_at - make_interval(hours => sl.cancel_hours);
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Non più modificabile' using errcode = 'SB026'; end if;
  return true;
end;
$$;

create function public.public_reschedule(p_token uuid, p_date date, p_time time)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_appt public.appointments;
  v_salon public.salons;
  v_duration integer;
  v_problem text;
  v_start timestamptz;
begin
  select * into v_appt from public.appointments a where a.manage_token = p_token and a.status = 'confirmed';
  if not found then raise exception 'Appuntamento non trovato' using errcode = 'SB026'; end if;
  select * into v_salon from public.salons sl where sl.id = v_appt.salon_id;
  if now() >= v_appt.starts_at - make_interval(hours => v_salon.cancel_hours) then
    raise exception 'Non più modificabile' using errcode = 'SB026';
  end if;

  v_problem := public.slot_problem(v_appt.salon_id, v_appt.service_id, v_appt.staff_id, p_date, p_time);
  if v_problem is not null then raise exception 'Orario non prenotabile' using errcode = v_problem; end if;

  select sv.duration_min into v_duration from public.services sv where sv.id = v_appt.service_id;
  v_start := (p_date + p_time) at time zone v_salon.timezone;

  -- Il vincolo anti-sovrapposizione blocca l'orario se è occupato da altri
  update public.appointments a
  set starts_at = v_start, ends_at = v_start + make_interval(mins => v_duration),
      customer_confirmed_at = now(), reminder_sent_at = null
  where a.id = v_appt.id;

  return jsonb_build_object('starts_at', v_start, 'ends_at', v_start + make_interval(mins => v_duration));
end;
$$;

-- Disiscrizione dai messaggi promozionali (link in fondo alle email)
create function public.public_unsubscribe(p_token uuid)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_salon_id uuid;
  v_key text;
begin
  select a.salon_id, public.customer_key(a.customer_phone, a.customer_name) into v_salon_id, v_key
  from public.appointments a where a.manage_token = p_token;
  if v_salon_id is null then return false; end if;
  insert into public.marketing_optouts (salon_id, customer_key) values (v_salon_id, v_key) on conflict do nothing;
  return true;
end;
$$;

-- Iscrizione alla lista d'attesa dalla pagina pubblica
create function public.public_join_waitlist(
  p_slug text,
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_name text,
  p_phone text,
  p_email text,
  p_privacy boolean
)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_salon public.salons;
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if not coalesce(p_privacy, false) then raise exception 'Consenso privacy mancante' using errcode = 'SB010'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 80 then raise exception 'Nome non valido' using errcode = 'SB011'; end if;
  if char_length(public.normalize_phone(p_phone)) not between 6 and 15 or char_length(p_phone) > 30 then raise exception 'Telefono non valido' using errcode = 'SB012'; end if;
  if v_email is null or char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email non valida' using errcode = 'SB013';
  end if;

  select * into v_salon from public.salons sl where sl.slug = lower(p_slug);
  if not found then raise exception 'Attività non trovata' using errcode = 'SB020'; end if;
  if not exists (select 1 from public.services sv where sv.id = p_service_id and sv.salon_id = v_salon.id and sv.active) then
    raise exception 'Servizio non disponibile' using errcode = 'SB001';
  end if;
  if p_date < (now() at time zone v_salon.timezone)::date or p_date > (now() at time zone v_salon.timezone)::date + 90 then
    raise exception 'Data non valida' using errcode = 'SB022';
  end if;

  -- Anti-abuso: massimo 3 iscrizioni future per telefono
  if (
    select count(*) from public.waitlist w
    where w.salon_id = v_salon.id and w.day >= (now() at time zone v_salon.timezone)::date
      and public.normalize_phone(w.customer_phone) = public.normalize_phone(p_phone)
  ) >= 3 then
    raise exception 'Troppe iscrizioni' using errcode = 'SB024';
  end if;

  insert into public.waitlist (salon_id, service_id, staff_id, day, customer_name, customer_phone, customer_email)
  values (
    v_salon.id, p_service_id,
    (select st.id from public.staff st where st.id = p_staff_id and st.salon_id = v_salon.id),
    p_date, trim(p_name), trim(p_phone), v_email
  );
  return true;
end;
$$;

revoke execute on function public.public_appointment(uuid) from public;
revoke execute on function public.public_confirm(uuid) from public;
revoke execute on function public.public_cancel(uuid) from public;
revoke execute on function public.public_reschedule(uuid, date, time) from public;
revoke execute on function public.public_unsubscribe(uuid) from public;
revoke execute on function public.public_join_waitlist(text, uuid, uuid, date, text, text, text, boolean) from public;
grant execute on function public.public_appointment(uuid) to anon, authenticated;
grant execute on function public.public_confirm(uuid) to anon, authenticated;
grant execute on function public.public_cancel(uuid) to anon, authenticated;
grant execute on function public.public_reschedule(uuid, date, time) to anon, authenticated;
grant execute on function public.public_unsubscribe(uuid) to anon, authenticated;
grant execute on function public.public_join_waitlist(text, uuid, uuid, date, text, text, text, boolean) to anon, authenticated;

-- 12. Accettazione dell'invito da parte del collaboratore ------------------

create function public.accept_invite(p_token uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text := lower((select auth.jwt()) ->> 'email');
  v_invite public.salon_invites;
begin
  if v_user_id is null then raise exception 'Accesso richiesto' using errcode = '28000'; end if;

  select * into v_invite from public.salon_invites si where si.token = p_token;
  if not found then raise exception 'Invito non valido' using errcode = 'SB030'; end if;
  if lower(v_invite.email) <> coalesce(v_email, '') then
    raise exception 'Invito per un altro indirizzo email' using errcode = 'SB031';
  end if;

  insert into public.salon_members (salon_id, user_id, role)
  values (v_invite.salon_id, v_user_id, 'staff')
  on conflict (salon_id, user_id) do nothing;

  if v_invite.staff_id is not null then
    update public.staff st set user_id = v_user_id where st.id = v_invite.staff_id and st.salon_id = v_invite.salon_id;
  end if;
  update public.salon_invites si set accepted_at = coalesce(si.accepted_at, now()) where si.id = v_invite.id;
  return v_invite.salon_id;
end;
$$;

revoke execute on function public.accept_invite(uuid) from public, anon;
grant execute on function public.accept_invite(uuid) to authenticated;

-- Il collaboratore invitato può vedere l'invito che lo riguarda (per mostrare il nome dell'attività)
create function public.invite_info(p_token uuid)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object('salon_name', sl.name, 'email', si.email, 'accepted', si.accepted_at is not null)
  from public.salon_invites si join public.salons sl on sl.id = si.salon_id
  where si.token = p_token;
$$;
revoke execute on function public.invite_info(uuid) from public;
grant execute on function public.invite_info(uuid) to anon, authenticated;

-- 13. Agenda: conferma del cliente e assenze -------------------------------

drop function public.agenda_day(uuid, date);

create function public.agenda_day(p_salon_id uuid, p_date date)
returns table (
  id uuid,
  staff_id uuid,
  service_id uuid,
  service_name text,
  customer_name text,
  customer_phone text,
  customer_email text,
  notes text,
  status public.appointment_status,
  source public.appointment_source,
  start_min integer,
  end_min integer,
  customer_confirmed boolean
)
language sql stable security invoker
set search_path = ''
as $$
  with tz as (select sl.timezone from public.salons sl where sl.id = p_salon_id)
  select
    a.id, a.staff_id, a.service_id, s.name, a.customer_name, a.customer_phone, a.customer_email,
    a.notes, a.status, a.source,
    (extract(epoch from (a.starts_at at time zone tz.timezone) - p_date::timestamp) / 60)::integer,
    (extract(epoch from (a.ends_at at time zone tz.timezone) - p_date::timestamp) / 60)::integer,
    a.customer_confirmed_at is not null
  from public.appointments a
  join public.services s on s.id = a.service_id
  cross join tz
  where a.salon_id = p_salon_id
    and a.starts_at >= (p_date::timestamp at time zone tz.timezone)
    and a.starts_at < ((p_date + 1)::timestamp at time zone tz.timezone)
  order by a.starts_at;
$$;

revoke execute on function public.agenda_day(uuid, date) from public, anon;
grant execute on function public.agenda_day(uuid, date) to authenticated;

-- 14. Statistiche ----------------------------------------------------------

create function public.salon_stats(p_salon_id uuid, p_from date, p_to date)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  with sl as (select s.id, s.timezone from public.salons s where s.id = p_salon_id),
  appts as (
    select a.*, sv.name as service_name, sv.price_cents, st.name as staff_name,
      public.customer_key(a.customer_phone, a.customer_name) as ck
    from public.appointments a
    join public.services sv on sv.id = a.service_id
    join public.staff st on st.id = a.staff_id
    cross join sl
    where a.salon_id = sl.id
      and a.starts_at >= (p_from::timestamp at time zone sl.timezone)
      and a.starts_at < ((p_to + 1)::timestamp at time zone sl.timezone)
  ),
  first_visit as (
    select public.customer_key(a.customer_phone, a.customer_name) as ck, min(a.starts_at) as first_at
    from public.appointments a where a.salon_id = p_salon_id and a.status <> 'cancelled'
    group by 1
  )
  select jsonb_build_object(
    'booked', (select count(*) from appts where status <> 'cancelled'),
    'completed', (select count(*) from appts where status = 'completed'),
    'no_show', (select count(*) from appts where status = 'no_show'),
    'cancelled', (select count(*) from appts where status = 'cancelled'),
    'online', (select count(*) from appts where status <> 'cancelled' and source = 'online'),
    'revenue_cents', (select coalesce(sum(price_cents), 0) from appts where status = 'completed'),
    'expected_cents', (select coalesce(sum(price_cents), 0) from appts where status in ('confirmed', 'completed')),
    'customers', (select count(distinct ck) from appts where status <> 'cancelled'),
    'new_customers', (
      select count(*) from first_visit fv cross join sl
      where fv.first_at >= (p_from::timestamp at time zone sl.timezone)
        and fv.first_at < ((p_to + 1)::timestamp at time zone sl.timezone)
    ),
    'top_services', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('name', service_name, 'count', count(*), 'revenue_cents', sum(price_cents) filter (where status = 'completed')) as x
        from appts where status <> 'cancelled' group by service_name order by count(*) desc limit 5
      ) as t
    ), '[]'::jsonb),
    'by_staff', coalesce((
      select jsonb_agg(x) from (
        select jsonb_build_object('name', staff_name, 'count', count(*), 'no_show', count(*) filter (where status = 'no_show')) as x
        from appts where status <> 'cancelled' group by staff_name order by count(*) desc
      ) as t
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.salon_stats(uuid, date, date) from public, anon;
grant execute on function public.salon_stats(uuid, date, date) to authenticated;

-- 15. Diritto all'oblio: ora cancella anche note e lista d'attesa ----------

create or replace function public.forget_customer(p_salon_id uuid, p_customer_key text)
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
  update public.appointments a set
    customer_name = 'Cliente rimosso',
    customer_phone = null,
    customer_email = null,
    notes = null,
    marketing_consent_at = null
  where a.salon_id = p_salon_id
    and public.customer_key(a.customer_phone, a.customer_name) = p_customer_key;
  get diagnostics n = row_count;
  delete from public.customer_notes cn where cn.salon_id = p_salon_id and cn.customer_key = p_customer_key;
  delete from public.waitlist w
  where w.salon_id = p_salon_id and public.customer_key(w.customer_phone, w.customer_name) = p_customer_key;
  return n;
end;
$$;

-- 16. Orari personali e assenze dall'app ------------------------------------
-- "security invoker": vale la RLS, quindi solo il titolare può modificarli.

-- p_hours vuoto = il collaboratore torna a usare gli orari dell'attività
create function public.set_staff_hours(p_staff_id uuid, p_hours jsonb)
returns void
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_salon_id uuid;
begin
  select st.salon_id into v_salon_id from public.staff st where st.id = p_staff_id;
  if v_salon_id is null or not public.has_salon_role(v_salon_id, 'owner') then
    raise exception 'Solo il titolare può modificare gli orari' using errcode = '42501';
  end if;

  delete from public.staff_hours sh where sh.staff_id = p_staff_id;
  insert into public.staff_hours (salon_id, staff_id, weekday, opens_at, closes_at)
  select v_salon_id, p_staff_id, (h ->> 'weekday')::smallint, (h ->> 'opens_at')::time, (h ->> 'closes_at')::time
  from jsonb_array_elements(p_hours) as h;
end;
$$;

-- Date e ore arrivano "locali" (es. 2026-12-01 09:00) e vengono convertite
-- con il fuso dell'attività, ora legale compresa
create function public.add_time_off(p_staff_id uuid, p_from timestamp, p_to timestamp, p_reason text default null)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_salon_id uuid;
  v_tz text;
  v_id uuid;
begin
  select st.salon_id, sl.timezone into v_salon_id, v_tz
  from public.staff st join public.salons sl on sl.id = st.salon_id
  where st.id = p_staff_id;
  if v_salon_id is null then raise exception 'Collaboratore non trovato' using errcode = '42501'; end if;

  insert into public.staff_time_off (salon_id, staff_id, starts_at, ends_at, reason)
  values (v_salon_id, p_staff_id, p_from at time zone v_tz, p_to at time zone v_tz, nullif(trim(p_reason), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.set_staff_hours(uuid, jsonb) from public, anon;
revoke execute on function public.add_time_off(uuid, timestamp, timestamp, text) from public, anon;
grant execute on function public.set_staff_hours(uuid, jsonb) to authenticated;
grant execute on function public.add_time_off(uuid, timestamp, timestamp, text) to authenticated;

-- 17. Appuntamenti inseriti in agenda: anche email e consenso marketing ------
-- (così ricevono promemoria e link di gestione come quelli prenotati online).
-- I nuovi parametri sono in fondo e facoltativi: le chiamate di prima funzionano ancora.

drop function public.create_appointment(uuid, uuid, uuid, date, time, text, text, text);

create function public.create_appointment(
  p_salon_id uuid,
  p_staff_id uuid,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_customer_name text,
  p_customer_phone text default null,
  p_notes text default null,
  p_customer_email text default null,
  p_marketing boolean default false
)
returns uuid
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_tz text;
  v_duration integer;
  v_start timestamptz;
  v_email text := nullif(lower(trim(coalesce(p_customer_email, ''))), '');
  v_id uuid;
begin
  select sl.timezone into v_tz from public.salons sl where sl.id = p_salon_id;
  if v_tz is null then raise exception 'Salone non trovato' using errcode = '42501'; end if;

  select sv.duration_min into v_duration from public.services sv where sv.id = p_service_id and sv.salon_id = p_salon_id;
  if v_duration is null then raise exception 'Servizio non trovato' using errcode = 'SB001'; end if;

  if not exists (
    select 1 from public.staff_services ss
    where ss.staff_id = p_staff_id and ss.service_id = p_service_id and ss.salon_id = p_salon_id
  ) then
    raise exception 'Il collaboratore non esegue questo servizio' using errcode = 'SB002';
  end if;

  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Email non valida' using errcode = 'SB013';
  end if;

  v_start := (p_date + p_time) at time zone v_tz;

  insert into public.appointments (
    salon_id, staff_id, service_id, customer_name, customer_phone, customer_email, notes,
    starts_at, ends_at, marketing_consent_at
  ) values (
    p_salon_id, p_staff_id, p_service_id, trim(p_customer_name),
    nullif(trim(p_customer_phone), ''), v_email, nullif(trim(p_notes), ''),
    v_start, v_start + make_interval(mins => v_duration),
    case when coalesce(p_marketing, false) then now() end
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.create_appointment(uuid, uuid, uuid, date, time, text, text, text, text, boolean) from public, anon;
grant execute on function public.create_appointment(uuid, uuid, uuid, date, time, text, text, text, text, boolean) to authenticated;

drop function public.update_appointment(uuid, uuid, uuid, date, time, text, text, text);

create function public.update_appointment(
  p_appointment_id uuid,
  p_staff_id uuid,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_customer_name text,
  p_customer_phone text default null,
  p_notes text default null,
  p_customer_email text default null
)
returns void
language plpgsql security invoker
set search_path = ''
as $$
declare
  v_salon_id uuid;
  v_tz text;
  v_duration integer;
  v_start timestamptz;
  v_old_start timestamptz;
  v_email text := nullif(lower(trim(coalesce(p_customer_email, ''))), '');
begin
  -- La RLS fa trovare l'appuntamento solo ai membri del suo salone
  select a.salon_id, sl.timezone, a.starts_at into v_salon_id, v_tz, v_old_start
  from public.appointments a
  join public.salons sl on sl.id = a.salon_id
  where a.id = p_appointment_id;
  if v_salon_id is null then raise exception 'Appuntamento non trovato' using errcode = '42501'; end if;

  select sv.duration_min into v_duration from public.services sv where sv.id = p_service_id and sv.salon_id = v_salon_id;
  if v_duration is null then raise exception 'Servizio non trovato' using errcode = 'SB001'; end if;

  if not exists (
    select 1 from public.staff_services ss
    where ss.staff_id = p_staff_id and ss.service_id = p_service_id and ss.salon_id = v_salon_id
  ) then
    raise exception 'Il collaboratore non esegue questo servizio' using errcode = 'SB002';
  end if;

  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then
    raise exception 'Email non valida' using errcode = 'SB013';
  end if;

  v_start := (p_date + p_time) at time zone v_tz;

  update public.appointments a set
    staff_id = p_staff_id,
    service_id = p_service_id,
    customer_name = trim(p_customer_name),
    customer_phone = nullif(trim(p_customer_phone), ''),
    customer_email = v_email,
    notes = nullif(trim(p_notes), ''),
    starts_at = v_start,
    ends_at = v_start + make_interval(mins => v_duration),
    -- Se cambia l'orario, il promemoria e la conferma del cliente ripartono da capo
    reminder_sent_at = case when v_start <> v_old_start then null else a.reminder_sent_at end,
    customer_confirmed_at = case when v_start <> v_old_start then null else a.customer_confirmed_at end
  where a.id = p_appointment_id;
end;
$$;

revoke execute on function public.update_appointment(uuid, uuid, uuid, date, time, text, text, text, text) from public, anon;
grant execute on function public.update_appointment(uuid, uuid, uuid, date, time, text, text, text, text) to authenticated;

-- 18. Il titolare può togliere l'accesso a un collaboratore (mai a un altro titolare)
create policy "Il titolare rimuove i collaboratori" on public.salon_members
  for delete to authenticated
  using (role = 'staff' and public.has_salon_role(salon_id, 'owner'));

-- 19. Pubblico dei messaggi promozionali ------------------------------------
-- Clienti con consenso, email, non disiscritti e senza appuntamenti in arrivo.
-- "security invoker": per il titolare vale la RLS; il server (chiave segreta)
-- la usa per i messaggi automatici di tutte le attività.

create function public.marketing_audience(p_salon_id uuid)
returns table (customer_key text, customer_name text, customer_email text, token uuid, last_visit timestamptz)
language sql stable security invoker
set search_path = ''
as $$
  with a as (
    select ap.*, public.customer_key(ap.customer_phone, ap.customer_name) as ck
    from public.appointments ap
    where ap.salon_id = p_salon_id
  ),
  per as (
    select
      a.ck,
      (array_agg(a.customer_name order by a.starts_at desc))[1] as name,
      (array_agg(a.customer_email order by a.starts_at desc) filter (where a.customer_email is not null))[1] as email,
      (array_agg(a.manage_token order by a.starts_at desc))[1] as token,
      max(a.starts_at) filter (where a.starts_at < now() and a.status in ('completed', 'confirmed')) as last_visit,
      bool_or(a.marketing_consent_at is not null) as consent,
      bool_or(a.starts_at >= now() and a.status = 'confirmed') as has_future
    from a
    group by a.ck
  )
  select per.ck, per.name, per.email, per.token, per.last_visit
  from per
  where per.consent
    and per.email is not null
    and not per.has_future
    and per.last_visit is not null
    and not exists (
      select 1 from public.marketing_optouts o where o.salon_id = p_salon_id and o.customer_key = per.ck
    );
$$;

revoke execute on function public.marketing_audience(uuid) from public, anon;
grant execute on function public.marketing_audience(uuid) to authenticated;

-- 20. Richieste di recensione: chi è venuto in un certo giorno -------------
-- Solo appuntamenti completati, con email, di clienti che hanno dato il
-- consenso ai messaggi promozionali e non si sono disiscritti.

create function public.review_candidates(p_salon_id uuid, p_day date)
returns table (appointment_id uuid, customer_name text, customer_email text, token uuid)
language sql stable security invoker
set search_path = ''
as $$
  with sl as (select s.timezone from public.salons s where s.id = p_salon_id),
  consenting as (
    select distinct public.customer_key(ap.customer_phone, ap.customer_name) as ck
    from public.appointments ap
    where ap.salon_id = p_salon_id and ap.marketing_consent_at is not null
  )
  select a.id, a.customer_name, a.customer_email, a.manage_token
  from public.appointments a
  cross join sl
  where a.salon_id = p_salon_id
    and a.status = 'completed'
    and a.customer_email is not null
    and a.starts_at >= (p_day::timestamp at time zone sl.timezone)
    and a.starts_at < ((p_day + 1)::timestamp at time zone sl.timezone)
    and public.customer_key(a.customer_phone, a.customer_name) in (select c.ck from consenting c)
    and not exists (
      select 1 from public.marketing_optouts o
      where o.salon_id = p_salon_id and o.customer_key = public.customer_key(a.customer_phone, a.customer_name)
    );
$$;

-- Usata solo dal server (attività giornaliera)
revoke execute on function public.review_candidates(uuid, date) from public, anon, authenticated;
grant execute on function public.review_candidates(uuid, date) to service_role;
grant execute on function public.marketing_audience(uuid) to service_role;

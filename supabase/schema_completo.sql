-- SCHEMA COMPLETO DI SMARTBOOKING AI
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

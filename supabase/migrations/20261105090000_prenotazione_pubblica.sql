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

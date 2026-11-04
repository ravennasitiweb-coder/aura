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

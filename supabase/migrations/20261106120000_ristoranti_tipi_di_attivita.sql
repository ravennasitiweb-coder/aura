-- Ristoranti: si prenota un tavolo per N persone.
-- Ogni tavolo è una riga di "staff" con il numero di posti (seats):
-- così il vincolo appointments_no_overlap impedisce già di dare
-- lo stesso tavolo a due prenotazioni sovrapposte.

-- 1. Nuovi tipi di attività (elenco generato da src/lib/business-types.ts)
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.salons'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%business_type%'
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
    'dog_walker',
    'ristorante',
    'pizzeria',
    'trattoria',
    'agriturismo'
  ));

-- 2. Tavoli: posti e posizione nella pianta (centimetri dall'angolo in alto a sinistra)
alter table public.staff
  add column seats smallint check (seats between 1 and 40),
  add column plan jsonb check (plan is null or jsonb_typeof(plan) = 'object');

alter table public.appointments
  add column party_size smallint check (party_size between 1 and 40);

-- 3. Pianta della sala: misure ed eventuale foto (ridotta dal browser, max ~500 KB)
create table public.floor_plans (
  salon_id uuid primary key references public.salons (id) on delete cascade,
  width_cm integer not null default 1000 check (width_cm between 200 and 10000),
  depth_cm integer not null default 800 check (depth_cm between 200 and 10000),
  photo text check (photo is null or (photo like 'data:image/jpeg;base64,%' and char_length(photo) <= 700000)),
  updated_at timestamptz not null default now()
);

alter table public.floor_plans enable row level security;
revoke all on public.floor_plans from anon;
create policy "I membri leggono" on public.floor_plans for select to authenticated using (public.is_salon_member(salon_id));
create policy "Il titolare aggiunge" on public.floor_plans for insert to authenticated with check (public.has_salon_role(salon_id, 'owner'));
create policy "Il titolare modifica" on public.floor_plans for update to authenticated using (public.has_salon_role(salon_id, 'owner')) with check (public.has_salon_role(salon_id, 'owner'));

-- 4. La pagina pubblica conosce i posti di ogni tavolo
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
        'seats', st.seats,
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

-- 5. Prenotazione di un tavolo: il database sceglie il tavolo più piccolo
-- libero con abbastanza posti. Il visitatore non sceglie il tavolo.
create function public.public_book_table(
  p_slug text,
  p_service_id uuid,
  p_party integer,
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
  v_salon_id uuid;
  v_table record;
  v_problem text;
  v_result jsonb;
begin
  if p_party is null or p_party not between 1 and 40 then
    raise exception 'Numero di persone non valido' using errcode = 'SB030';
  end if;
  select sl.id into v_salon_id from public.salons sl where sl.slug = lower(p_slug);
  if v_salon_id is null then raise exception 'Attività non trovata' using errcode = 'SB020'; end if;

  for v_table in
    select st.id from public.staff st
    join public.staff_services ss on ss.staff_id = st.id and ss.service_id = p_service_id
    where st.salon_id = v_salon_id and st.active and st.seats >= p_party
    order by st.seats, st.created_at
  loop
    v_problem := public.slot_problem(v_salon_id, p_service_id, v_table.id, p_date, p_time);
    -- Problemi che non dipendono dal tavolo: inutile provare gli altri
    if v_problem in ('SB001', 'SB021', 'SB022') then
      raise exception 'Orario non prenotabile' using errcode = v_problem;
    end if;
    continue when v_problem is not null;
    begin
      v_result := public.public_book(p_slug, p_service_id, v_table.id, p_date, p_time, p_name, p_phone, p_email, p_privacy, p_marketing);
    exception when exclusion_violation then
      continue; -- tavolo già preso: si prova il successivo
    end;
    update public.appointments a set party_size = p_party where a.id = (v_result ->> 'id')::uuid;
    return v_result || jsonb_build_object('party_size', p_party);
  end loop;

  raise exception 'Nessun tavolo libero' using errcode = 'SB031';
end;
$$;

revoke execute on function public.public_book_table(text, uuid, integer, date, time, text, text, text, boolean, boolean) from public;
grant execute on function public.public_book_table(text, uuid, integer, date, time, text, text, text, boolean, boolean) to anon, authenticated;

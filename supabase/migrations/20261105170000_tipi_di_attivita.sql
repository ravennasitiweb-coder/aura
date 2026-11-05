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

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

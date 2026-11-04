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

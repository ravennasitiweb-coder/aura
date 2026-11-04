-- Test degli appuntamenti: niente doppie prenotazioni, fuso orario
-- corretto e isolamento tra saloni.
-- Come gli altri test: risultato in rosso, dati di prova annullati.

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  salon_a uuid;
  salon_b uuid;
  giulia uuid;
  marco uuid;
  taglio uuid;
  colore uuid;
  appt uuid;
  r record;
  n int;
begin
  insert into auth.users (id, aud, role, email) values
    (user_a, 'authenticated', 'authenticated', 'titolare-a@test.invalid'),
    (user_b, 'authenticated', 'authenticated', 'titolare-b@test.invalid');

  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select id into salon_a from public.create_salon('Salone di prova A', 'test-a-' || left(user_a::text, 8));
  insert into public.staff (salon_id, name) values (salon_a, 'Giulia') returning id into giulia;
  insert into public.staff (salon_id, name) values (salon_a, 'Marco') returning id into marco;
  insert into public.services (salon_id, name, duration_min) values (salon_a, 'Taglio', 30) returning id into taglio;
  insert into public.services (salon_id, name, duration_min) values (salon_a, 'Colore', 90) returning id into colore;
  insert into public.staff_services (salon_id, staff_id, service_id) values
    (salon_a, giulia, taglio), (salon_a, giulia, colore), (salon_a, marco, taglio);

  -- 1. Un appuntamento normale: colore con Giulia alle 10:00 (finisce alle 11:30)
  appt := public.create_appointment(salon_a, giulia, colore, '2026-12-01', '10:00', 'Elena Rossi', '333 1234567');

  -- 2. Fuso orario: il 1 dicembre a Roma è UTC+1, quindi 10:00 locali = 09:00 UTC
  select * into r from public.agenda_day(salon_a, '2026-12-01') where id = appt;
  if r.start_min <> 600 or r.end_min <> 690 then
    raise exception 'TEST FALLITO: orari locali sbagliati (% - %)', r.start_min, r.end_min;
  end if;
  if (select starts_at from public.appointments where id = appt) <> '2026-12-01 09:00:00+00' then
    raise exception 'TEST FALLITO: conversione del fuso orario sbagliata';
  end if;
  -- e d'estate (UTC+2)
  perform public.create_appointment(salon_a, giulia, taglio, '2026-07-01', '10:00', 'Estate');
  if (select starts_at from public.appointments where customer_name = 'Estate') <> '2026-07-01 08:00:00+00' then
    raise exception 'TEST FALLITO: ora legale non gestita';
  end if;

  -- 3. Doppia prenotazione: taglio con Giulia alle 11:00 (si sovrappone al colore)
  begin
    perform public.create_appointment(salon_a, giulia, taglio, '2026-12-01', '11:00', 'Doppione');
    raise exception 'TEST FALLITO: accettata una doppia prenotazione';
  exception when exclusion_violation then null;
  end;

  -- 4. Subito dopo va bene: 11:30, quando il colore è finito
  perform public.create_appointment(salon_a, giulia, taglio, '2026-12-01', '11:30', 'Subito dopo');

  -- 5. Stesso orario ma con Marco: va bene, è un'altra persona
  perform public.create_appointment(salon_a, marco, taglio, '2026-12-01', '10:00', 'Con Marco');

  -- 6. Marco non fa il colore
  begin
    perform public.create_appointment(salon_a, marco, colore, '2026-12-01', '15:00', 'Servizio sbagliato');
    raise exception 'TEST FALLITO: Marco ha ricevuto un servizio che non fa';
  exception when sqlstate 'SB002' then null;
  end;

  -- 7. Annullando il colore, l'orario si libera
  update public.appointments set status = 'cancelled' where id = appt;
  perform public.create_appointment(salon_a, giulia, taglio, '2026-12-01', '10:30', 'Dopo annullamento');

  -- 8. Non si può eliminare un servizio con appuntamenti
  begin
    delete from public.services where id = taglio;
    raise exception 'TEST FALLITO: eliminato un servizio con appuntamenti';
  exception when foreign_key_violation then null;
  end;
  reset role;

  -- 9. Il titolare B non vede né tocca l'agenda di A
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon_b from public.create_salon('Salone di prova B', 'test-b-' || left(user_b::text, 8));

  select count(*) into n from public.appointments;
  if n <> 0 then raise exception 'TEST FALLITO: B vede % appuntamenti di A', n; end if;
  select count(*) into n from public.agenda_day(salon_a, '2026-12-01');
  if n <> 0 then raise exception 'TEST FALLITO: B legge l''agenda di A'; end if;

  update public.appointments set status = 'cancelled' where salon_id = salon_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FALLITO: B ha annullato appuntamenti di A'; end if;

  begin
    perform public.create_appointment(salon_a, giulia, taglio, '2026-12-02', '10:00', 'Intruso');
    raise exception 'TEST FALLITO: B ha inserito un appuntamento nel salone di A';
  exception when insufficient_privilege or sqlstate 'SB001' then null;
  end;

  reset role;
  raise exception 'TEST SUPERATO: niente doppie prenotazioni, fuso orario corretto, agenda isolata. Dati di prova annullati.';
end;
$$;

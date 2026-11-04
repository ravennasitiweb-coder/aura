-- Test di modifica e spostamento degli appuntamenti.
-- Come gli altri test: risultato in rosso, dati di prova annullati.

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  salon_a uuid;
  giulia uuid;
  marco uuid;
  taglio uuid;
  colore uuid;
  appt uuid;
  other uuid;
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

  appt := public.create_appointment(salon_a, giulia, taglio, '2026-12-01', '10:00', 'Elena');
  other := public.create_appointment(salon_a, giulia, taglio, '2026-12-01', '11:00', 'Paolo');

  -- 1. Spostamento di 15 minuti dentro la propria fascia: deve funzionare
  perform public.update_appointment(appt, giulia, taglio, '2026-12-01', '10:15', 'Elena', '333 000', 'nota');
  select * into r from public.agenda_day(salon_a, '2026-12-01') where id = appt;
  if r.start_min <> 615 or r.end_min <> 645 or r.customer_phone <> '333 000' then
    raise exception 'TEST FALLITO: spostamento di 15 minuti non salvato correttamente';
  end if;

  -- 2. Spostamento su un orario occupato: bloccato
  begin
    perform public.update_appointment(appt, giulia, taglio, '2026-12-01', '11:15', 'Elena');
    raise exception 'TEST FALLITO: spostato su un orario occupato';
  exception when exclusion_violation then null;
  end;

  -- 3. Cambio servizio: la fine si ricalcola (colore 90 min dalle 9:00 finisce alle 10:30)
  perform public.update_appointment(appt, giulia, colore, '2026-12-01', '09:00', 'Elena');
  select * into r from public.agenda_day(salon_a, '2026-12-01') where id = appt;
  if r.end_min <> 630 then raise exception 'TEST FALLITO: durata non ricalcolata (fine %)', r.end_min; end if;

  -- 4. Colore allungato che finirebbe dentro l'appuntamento di Paolo: bloccato
  begin
    perform public.update_appointment(appt, giulia, colore, '2026-12-01', '10:00', 'Elena');
    raise exception 'TEST FALLITO: accettata una sovrapposizione dovuta al cambio di servizio';
  exception when exclusion_violation then null;
  end;

  -- 5. Passaggio a un collaboratore che non fa il servizio: bloccato
  begin
    perform public.update_appointment(appt, marco, colore, '2026-12-01', '15:00', 'Elena');
    raise exception 'TEST FALLITO: assegnato un servizio a chi non lo fa';
  exception when sqlstate 'SB002' then null;
  end;

  -- 6. Spostamento a un altro giorno e a Marco
  perform public.update_appointment(appt, marco, taglio, '2026-12-02', '16:00', 'Elena');
  select count(*) into n from public.agenda_day(salon_a, '2026-12-02') where id = appt and staff_id = marco;
  if n <> 1 then raise exception 'TEST FALLITO: spostamento a un altro giorno non riuscito'; end if;
  reset role;

  -- 7. Un altro titolare non può spostare gli appuntamenti di A
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    perform public.update_appointment(other, giulia, taglio, '2026-12-03', '10:00', 'Rubato');
    raise exception 'TEST FALLITO: B ha spostato un appuntamento di A';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select count(*) into n from public.appointments where id = other and customer_name = 'Paolo';
  if n <> 1 then raise exception 'TEST FALLITO: l''appuntamento di A è stato modificato da B'; end if;

  raise exception 'TEST SUPERATO: spostamenti e modifiche rispettano tutte le regole. Dati di prova annullati.';
end;
$$;

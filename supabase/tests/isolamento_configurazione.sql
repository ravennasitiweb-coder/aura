-- Test di isolamento per servizi, collaboratori e orari.
-- Come il test precedente: il risultato compare come messaggio rosso
-- e tutti i dati di prova vengono annullati.

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  salon_a uuid;
  salon_b uuid;
  service_b uuid;
  staff_a uuid;
  n int;
begin
  insert into auth.users (id, aud, role, email) values
    (user_a, 'authenticated', 'authenticated', 'titolare-a@test.invalid'),
    (user_b, 'authenticated', 'authenticated', 'titolare-b@test.invalid');

  -- B prepara il suo salone con un servizio e un orario
  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon_b from public.create_salon('Salone di prova B', 'test-b-' || left(user_b::text, 8));
  insert into public.services (salon_id, name, duration_min) values (salon_b, 'Taglio B', 30) returning id into service_b;
  perform public.set_opening_hours(salon_b, '[{"weekday": 2, "opens_at": "09:00", "closes_at": "19:00"}]');
  reset role;

  -- A prepara il suo salone con un collaboratore
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon_a from public.create_salon('Salone di prova A', 'test-a-' || left(user_a::text, 8));
  insert into public.staff (salon_id, name) values (salon_a, 'Giulia A') returning id into staff_a;

  -- 1. A non vede i servizi né gli orari di B
  select count(*) into n from public.services;
  if n <> 0 then raise exception 'TEST FALLITO: A vede % servizi di B', n; end if;
  select count(*) into n from public.opening_hours;
  if n <> 0 then raise exception 'TEST FALLITO: A vede gli orari di B'; end if;

  -- 2. A non può aggiungere servizi nel salone di B
  begin
    insert into public.services (salon_id, name, duration_min) values (salon_b, 'Intruso', 30);
    raise exception 'TEST FALLITO: A ha aggiunto un servizio nel salone di B';
  exception when insufficient_privilege then null;
  end;

  -- 3. A non può modificare né eliminare il servizio di B
  update public.services set price_cents = 1 where id = service_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FALLITO: A ha modificato un servizio di B'; end if;
  delete from public.services where id = service_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FALLITO: A ha eliminato un servizio di B'; end if;

  -- 4. A non può cambiare gli orari di B
  begin
    perform public.set_opening_hours(salon_b, '[]');
    raise exception 'TEST FALLITO: A ha cambiato gli orari di B';
  exception when insufficient_privilege then null;
  end;

  -- 5. A non può collegare il proprio collaboratore a un servizio di B
  --    (né dichiarando il proprio salone, né quello di B)
  begin
    insert into public.staff_services (salon_id, staff_id, service_id) values (salon_a, staff_a, service_b);
    raise exception 'TEST FALLITO: collegamento tra saloni diversi accettato';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;
  begin
    insert into public.staff_services (salon_id, staff_id, service_id) values (salon_b, staff_a, service_b);
    raise exception 'TEST FALLITO: collegamento nel salone di B accettato';
  exception when foreign_key_violation or insufficient_privilege then null;
  end;

  -- 6. A gestisce normalmente il proprio salone
  insert into public.services (salon_id, name, duration_min, price_cents) values (salon_a, 'Piega A', 45, 2500);
  perform public.set_opening_hours(salon_a, '[{"weekday": 3, "opens_at": "09:00", "closes_at": "13:00"}, {"weekday": 3, "opens_at": "15:00", "closes_at": "19:00"}]');
  select count(*) into n from public.opening_hours;
  if n <> 2 then raise exception 'TEST FALLITO: A non riesce a salvare i propri orari'; end if;

  reset role;
  -- 7. Gli orari di B sono rimasti intatti
  select count(*) into n from public.opening_hours where salon_id = salon_b;
  if n <> 1 then raise exception 'TEST FALLITO: gli orari di B sono cambiati'; end if;

  raise exception 'TEST SUPERATO: tutti i controlli su servizi, collaboratori e orari sono andati bene. Dati di prova annullati.';
end;
$$;

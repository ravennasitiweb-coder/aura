-- Test della prenotazione pubblica, dal punto di vista di un visitatore anonimo.
-- Come gli altri test: risultato in rosso, dati di prova annullati.

do $$
declare
  owner uuid := gen_random_uuid();
  salon uuid;
  slug text := 'test-pubblico-' || left(gen_random_uuid()::text, 8);
  giulia uuid;
  sara uuid;
  taglio uuid;
  manicure uuid;
  bozza uuid;
  info jsonb;
  day jsonb;
  -- Un martedì futuro (giorno aperto nel test)
  d date := (current_date + 7) + ((9 - extract(isodow from current_date + 7)::integer) % 7);
  n int;
begin
  insert into auth.users (id, aud, role, email) values (owner, 'authenticated', 'authenticated', 'titolare@test.invalid');

  -- Il titolare prepara il salone
  perform set_config('request.jwt.claims', json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon from public.create_salon('Salone pubblico', slug);
  insert into public.staff (salon_id, name) values (salon, 'Giulia') returning id into giulia;
  insert into public.staff (salon_id, name, active) values (salon, 'Sara', false) returning id into sara;
  insert into public.services (salon_id, name, duration_min, price_cents) values (salon, 'Taglio', 30, 2000) returning id into taglio;
  insert into public.services (salon_id, name, duration_min) values (salon, 'Manicure', 45) returning id into manicure;
  insert into public.services (salon_id, name, duration_min, active) values (salon, 'Bozza', 30, false) returning id into bozza;
  insert into public.staff_services (salon_id, staff_id, service_id) values
    (salon, giulia, taglio), (salon, giulia, bozza), (salon, sara, manicure);
  perform public.set_opening_hours(salon, '[{"weekday": 2, "opens_at": "09:00", "closes_at": "13:00"}]');
  perform public.create_appointment(salon, giulia, taglio, d, '09:00', 'Cliente Riservata', '3330000000', 'nota privata');
  reset role;

  -- Da qui agisce un visitatore anonimo
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;

  -- 1. Le tabelle restano chiuse
  begin
    perform 1 from public.appointments limit 1;
    raise exception 'TEST FALLITO: il visitatore legge la tabella appuntamenti';
  exception when insufficient_privilege then null;
  end;

  -- 2. Info del salone: solo il necessario
  info := public.public_salon_info(slug);
  if jsonb_array_length(info -> 'services') <> 1 then
    raise exception 'TEST FALLITO: servizi pubblici attesi 1 (solo Taglio), trovati %', jsonb_array_length(info -> 'services');
  end if;
  if jsonb_array_length(info -> 'staff') <> 1 then
    raise exception 'TEST FALLITO: è visibile un collaboratore disattivato';
  end if;
  if info::text ~* 'Riservata|3330000000|nota privata|titolare@' then
    raise exception 'TEST FALLITO: le info pubbliche contengono dati privati';
  end if;

  -- 3. Orari occupati senza dati dei clienti
  day := public.public_day(slug, d);
  if jsonb_array_length(day -> 'busy') <> 1 or day::text ~* 'Riservata|3330000000' then
    raise exception 'TEST FALLITO: il giorno pubblico espone dati dei clienti o occupati sbagliati';
  end if;

  -- 4. Prenotazione valida
  perform public.public_book(slug, taglio, giulia, d, '10:00', 'Mario Bianchi', '+39 333 111 2222', 'mario@esempio.it', true);

  -- 5. Regole che devono bloccare
  begin perform public.public_book(slug, taglio, giulia, d, '10:15', 'Doppione', '3331112223', null, true);
    raise exception 'TEST FALLITO: doppia prenotazione accettata';
  exception when exclusion_violation then null; end;

  begin perform public.public_book(slug, taglio, giulia, d, '11:00', 'Senza consenso', '3331112224', null, false);
    raise exception 'TEST FALLITO: prenotazione senza consenso privacy';
  exception when sqlstate 'SB010' then null; end;

  begin perform public.public_book(slug, taglio, giulia, d, '12:45', 'Sfora chiusura', '3331112225', null, true);
    raise exception 'TEST FALLITO: accettato un orario che sfora la chiusura';
  exception when sqlstate 'SB023' then null; end;

  begin perform public.public_book(slug, taglio, giulia, d + 1, '10:00', 'Giorno chiuso', '3331112226', null, true);
    raise exception 'TEST FALLITO: accettato un giorno di chiusura';
  exception when sqlstate 'SB023' then null; end;

  begin perform public.public_book(slug, taglio, giulia, current_date - 1, '10:00', 'Passato', '3331112227', null, true);
    raise exception 'TEST FALLITO: accettato un giorno passato';
  exception when sqlstate 'SB021' then null; end;

  begin perform public.public_book(slug, bozza, giulia, d, '11:00', 'Servizio spento', '3331112228', null, true);
    raise exception 'TEST FALLITO: prenotato un servizio non attivo';
  exception when sqlstate 'SB001' then null; end;

  begin perform public.public_book(slug, manicure, sara, d, '11:00', 'Operatore spento', '3331112229', null, true);
    raise exception 'TEST FALLITO: prenotato un collaboratore disattivato';
  exception when sqlstate 'SB002' then null; end;

  begin perform public.public_book(slug, taglio, giulia, d, '11:00', 'Email rotta', '3331112230', 'non-una-email', true);
    raise exception 'TEST FALLITO: accettata un''email non valida';
  exception when sqlstate 'SB013' then null; end;

  -- 6. Anti-abuso: la quarta prenotazione con lo stesso telefono viene bloccata
  perform public.public_book(slug, taglio, giulia, d, '11:00', 'Mario Bianchi', '333 111 2222', null, true);
  perform public.public_book(slug, taglio, giulia, d, '11:30', 'Mario Bianchi', '3331112222', null, true);
  begin perform public.public_book(slug, taglio, giulia, d, '12:00', 'Mario Bianchi', '+39 333 111 2222', null, true);
    raise exception 'TEST FALLITO: superato il limite di 3 prenotazioni per telefono';
  exception when sqlstate 'SB024' then null; end;

  reset role;

  -- 7. La prenotazione online è arrivata in agenda con origine e consenso
  select count(*) into n from public.appointments
  where salon_id = salon and source = 'online' and privacy_consent_at is not null;
  if n <> 3 then raise exception 'TEST FALLITO: attese 3 prenotazioni online, trovate %', n; end if;

  raise exception 'TEST SUPERATO: la prenotazione pubblica rispetta tutte le regole e non espone dati privati. Dati di prova annullati.';
end;
$$;

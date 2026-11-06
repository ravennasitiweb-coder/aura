-- Test dei ristoranti: tavoli per numero di persone.
-- Come gli altri test: risultato in rosso, dati di prova annullati.

do $$
declare
  owner_a uuid := gen_random_uuid();
  salon_a uuid;
  v_slug text := 'test-risto-' || left(owner_a::text, 8);
  svc uuid;
  t2 uuid;
  t4 uuid;
  t6 uuid;
  v_day date;
  r jsonb;
begin
  insert into auth.users (id, aud, role, email) values (owner_a, 'authenticated', 'authenticated', 'risto@test.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select id into salon_a from public.create_salon('Da Gino', v_slug, 'Ravenna', 'ristorante');
  insert into public.services (salon_id, name, duration_min) values (salon_a, 'Cena', 120) returning id into svc;
  insert into public.staff (salon_id, name, seats) values (salon_a, 'Tavolo 1', 2) returning id into t2;
  insert into public.staff (salon_id, name, seats) values (salon_a, 'Tavolo 2', 4) returning id into t4;
  insert into public.staff (salon_id, name, seats) values (salon_a, 'Tavolo 3', 6) returning id into t6;
  insert into public.staff_services (salon_id, staff_id, service_id) select salon_a, x, svc from unnest(array[t2, t4, t6]) as x;
  -- Aperto tutti i giorni 19-23
  perform public.set_opening_hours(salon_a, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens_at', '19:00', 'closes_at', '23:00')) from generate_series(1, 7) d));
  insert into public.floor_plans (salon_id, width_cm, depth_cm) values (salon_a, 1200, 900);
  update public.staff set plan = '{"x": 100, "y": 200, "shape": "round"}' where id = t4;

  reset role;
  set local role anon;
  v_day := (now() at time zone 'Europe/Rome')::date + 2;

  -- 1. In 3 persone: il tavolo più piccolo adatto è quello da 4
  r := public.public_book_table(v_slug, svc, 3, v_day, '20:00', 'Mario Rossi', '3331112222', null, true);
  reset role;
  if (select staff_id from public.appointments where id = (r ->> 'id')::uuid) <> t4 then raise exception 'TEST FALLITO: non ha scelto il tavolo da 4'; end if;
  if (select party_size from public.appointments where id = (r ->> 'id')::uuid) <> 3 then raise exception 'TEST FALLITO: coperti non salvati'; end if;

  -- 2. Altre 3 persone alla stessa ora: il 4 è preso, va sul 6
  set local role anon;
  r := public.public_book_table(v_slug, svc, 3, v_day, '20:30', 'Anna Bianchi', '3334445555', null, true);
  reset role;
  if (select staff_id from public.appointments where id = (r ->> 'id')::uuid) <> t6 then raise exception 'TEST FALLITO: non ha usato il tavolo da 6'; end if;

  -- 3. Terze 3 persone: restano solo tavoli da 2, nessun posto
  set local role anon;
  begin
    perform public.public_book_table(v_slug, svc, 3, v_day, '20:00', 'Luca Verdi', '3337778888', null, true);
    raise exception 'TEST FALLITO: ha messo 3 persone su un tavolo da 2';
  exception when sqlstate 'SB031' then null;
  end;

  -- 4. Numero di persone assurdo
  begin
    perform public.public_book_table(v_slug, svc, 0, v_day, '20:00', 'Luca Verdi', '3337778888', null, true);
    raise exception 'TEST FALLITO: accettate 0 persone';
  exception when sqlstate 'SB030' then null;
  end;

  -- 5. I visitatori vedono i posti, non la pianta
  if (select count(*) from jsonb_array_elements(public.public_salon_info(v_slug) -> 'staff') e where (e ->> 'seats')::int = 6) <> 1 then
    raise exception 'TEST FALLITO: posti dei tavoli non visibili nella pagina pubblica';
  end if;
  begin
    perform 1 from public.floor_plans;
    raise exception 'TEST FALLITO: un visitatore legge la pianta';
  exception when insufficient_privilege then null;
  end;

  raise exception 'TEST SUPERATO: i tavoli si assegnano per numero di persone, senza doppie prenotazioni. Dati di prova annullati.';
end;
$$;

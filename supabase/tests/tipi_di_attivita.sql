-- Test dei tipi di attività.
-- Come gli altri test: risultato in rosso, dati di prova annullati.

do $$
declare
  owner_a uuid := gen_random_uuid();
  staff_a uuid := gen_random_uuid();
  salon_a uuid;
  salon_b uuid;
  t text;
  info jsonb;
begin
  insert into auth.users (id, aud, role, email) values
    (owner_a, 'authenticated', 'authenticated', 'titolare@test.invalid'),
    (staff_a, 'authenticated', 'authenticated', 'collaboratore@test.invalid');

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Senza tipo si crea un parrucchiere (come prima)
  select id into salon_a from public.create_salon('Salone di prova', 'test-tipo-a-' || left(owner_a::text, 8));
  select business_type into t from public.salons where id = salon_a;
  if t <> 'parrucchiere' then raise exception 'TEST FALLITO: tipo predefinito %, atteso parrucchiere', t; end if;

  -- 2. Con il tipo indicato
  select id into salon_b from public.create_salon('Inkwell', 'test-tipo-b-' || left(owner_a::text, 8), 'Ravenna', 'tatuatore');
  select business_type into t from public.salons where id = salon_b;
  if t <> 'tatuatore' then raise exception 'TEST FALLITO: tipo salvato %, atteso tatuatore', t; end if;

  -- 3. Un tipo inventato viene rifiutato, sia in creazione sia in modifica
  begin
    perform public.create_salon('Ristorante', 'test-tipo-c-' || left(owner_a::text, 8), null, 'ristorante');
    raise exception 'TEST FALLITO: accettato un tipo inesistente in creazione';
  exception when check_violation then null;
  end;
  begin
    update public.salons set business_type = 'ristorante' where id = salon_a;
    raise exception 'TEST FALLITO: accettato un tipo inesistente in modifica';
  exception when check_violation then null;
  end;

  -- 4. Il titolare cambia il tipo della propria attività
  update public.salons set business_type = 'barbiere' where id = salon_a;
  select business_type into t from public.salons where id = salon_a;
  if t <> 'barbiere' then raise exception 'TEST FALLITO: il titolare non riesce a cambiare il tipo'; end if;
  reset role;

  -- 5. La pagina pubblica riceve il tipo
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  info := public.public_salon_info('test-tipo-b-' || left(owner_a::text, 8));
  if info -> 'salon' ->> 'business_type' <> 'tatuatore' then
    raise exception 'TEST FALLITO: la pagina pubblica non riceve il tipo di attività';
  end if;
  reset role;

  -- 6. Un collaboratore non può cambiare il tipo
  insert into public.salon_members (salon_id, user_id, role) values (salon_a, staff_a, 'staff');
  perform set_config('request.jwt.claims', json_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  update public.salons set business_type = 'massaggi' where id = salon_a;
  reset role;
  select business_type into t from public.salons where id = salon_a;
  if t <> 'barbiere' then raise exception 'TEST FALLITO: un collaboratore ha cambiato il tipo di attività'; end if;

  raise exception 'TEST SUPERATO: i tipi di attività funzionano e solo il titolare può cambiarli. Dati di prova annullati.';
end;
$$;

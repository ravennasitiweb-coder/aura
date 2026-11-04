-- Test di vista settimana, clienti e abbonamenti.
-- Come gli altri test: risultato in rosso, dati di prova annullati.

do $$
declare
  owner_a uuid := gen_random_uuid();
  staff_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  salon_a uuid;
  salon_b uuid;
  giulia uuid;
  taglio uuid;
  n int;
  k text;
  r record;
begin
  insert into auth.users (id, aud, role, email) values
    (owner_a, 'authenticated', 'authenticated', 'titolare-a@test.invalid'),
    (staff_a, 'authenticated', 'authenticated', 'collaboratore-a@test.invalid'),
    (owner_b, 'authenticated', 'authenticated', 'titolare-b@test.invalid');

  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon_a from public.create_salon('Salone di prova A', 'test-a-' || left(owner_a::text, 8));
  insert into public.staff (salon_id, name) values (salon_a, 'Giulia') returning id into giulia;
  insert into public.services (salon_id, name, duration_min) values (salon_a, 'Taglio', 30) returning id into taglio;
  insert into public.staff_services (salon_id, staff_id, service_id) values (salon_a, giulia, taglio);

  -- Lo stesso cliente scrive il numero in tre modi diversi
  perform public.create_appointment(salon_a, giulia, taglio, '2026-12-01', '10:00', 'Mario Rossi', '+39 333 111 2222');
  perform public.create_appointment(salon_a, giulia, taglio, '2026-12-03', '10:00', 'Mario', '333 1112222');
  perform public.create_appointment(salon_a, giulia, taglio, '2026-12-05', '10:00', 'Mario R.', '0039 3331112222', 'preferisce la sfumatura');
  -- Un altro cliente senza telefono
  perform public.create_appointment(salon_a, giulia, taglio, '2026-12-02', '15:00', 'Laura Bianchi');
  update public.appointments set status = 'completed' where customer_name = 'Mario Rossi';
  update public.appointments set status = 'no_show' where customer_name = 'Mario';
  reset role;

  -- Un collaboratore (non titolare) nel salone A
  insert into public.salon_members (salon_id, user_id, role) values (salon_a, staff_a, 'staff');

  -- Il titolare B con il suo salone
  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon_b from public.create_salon('Salone di prova B', 'test-b-' || left(owner_b::text, 8));
  reset role;

  -- Abbonamento scritto come farebbe il webhook (con permessi di amministratore)
  insert into public.subscriptions (salon_id, plan, status) values (salon_a, 'salone', 'active');

  -- Da qui agisce il titolare A
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. Vista settimana: 4 appuntamenti tra il 30 novembre e il 6 dicembre, orari locali
  select count(*) into n from public.agenda_range(salon_a, '2026-11-30', '2026-12-06');
  if n <> 4 then raise exception 'TEST FALLITO: la settimana mostra % appuntamenti invece di 4', n; end if;
  select * into r from public.agenda_range(salon_a, '2026-11-30', '2026-12-06') where customer_name = 'Laura Bianchi';
  if r.day <> '2026-12-02' or r.start_min <> 900 or r.end_min <> 930 then
    raise exception 'TEST FALLITO: giorno o orari della settimana sbagliati';
  end if;
  begin
    perform public.agenda_range(salon_a, '2026-11-01', '2026-12-31');
    raise exception 'TEST FALLITO: accettato un intervallo troppo lungo';
  exception when invalid_parameter_value then null;
  end;

  -- 2. Clienti: Mario è uno solo, nonostante i tre modi di scrivere il numero
  select count(*) into n from public.customer_list(salon_a);
  if n <> 2 then raise exception 'TEST FALLITO: attesi 2 clienti, trovati %', n; end if;
  select * into r from public.customer_list(salon_a, '333') limit 1;
  if r.customer_key <> '3331112222' or r.visits <> 1 or r.no_shows <> 1 or r.name <> 'Mario R.' then
    raise exception 'TEST FALLITO: cliente raggruppato male (chiave %, visite %, assenze %, nome %)', r.customer_key, r.visits, r.no_shows, r.name;
  end if;
  select count(*) into n from public.customer_list(salon_a, 'laura');
  if n <> 1 then raise exception 'TEST FALLITO: la ricerca per nome non funziona'; end if;

  -- 3. Storico di Mario: 3 appuntamenti
  select count(*) into n from public.customer_history(salon_a, '3331112222');
  if n <> 3 then raise exception 'TEST FALLITO: lo storico ha % appuntamenti invece di 3', n; end if;

  -- 4. L'abbonamento si legge ma non si modifica dall'app
  select count(*) into n from public.subscriptions;
  if n <> 1 then raise exception 'TEST FALLITO: il titolare non vede il proprio abbonamento'; end if;
  begin
    update public.subscriptions set status = 'active', plan = 'studio' where salon_id = salon_a;
    raise exception 'TEST FALLITO: un utente ha modificato il proprio abbonamento';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.subscriptions (salon_id, plan, status) values (salon_a, 'studio', 'active');
    raise exception 'TEST FALLITO: un utente si è creato un abbonamento';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 5. Il collaboratore vede i clienti ma non può cancellarli
  perform set_config('request.jwt.claims', json_build_object('sub', staff_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.customer_list(salon_a);
  if n <> 2 then raise exception 'TEST FALLITO: il collaboratore non vede i clienti'; end if;
  begin
    perform public.forget_customer(salon_a, '3331112222');
    raise exception 'TEST FALLITO: un collaboratore ha cancellato un cliente';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 6. Il titolare B non vede nulla del salone A
  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.customer_list(salon_a);
  if n <> 0 then raise exception 'TEST FALLITO: B vede i clienti di A'; end if;
  select count(*) into n from public.customer_history(salon_a, '3331112222');
  if n <> 0 then raise exception 'TEST FALLITO: B vede lo storico di un cliente di A'; end if;
  select count(*) into n from public.agenda_range(salon_a, '2026-11-30', '2026-12-06');
  if n <> 0 then raise exception 'TEST FALLITO: B vede la settimana di A'; end if;
  select count(*) into n from public.subscriptions;
  if n <> 0 then raise exception 'TEST FALLITO: B vede l''abbonamento di A'; end if;
  begin
    perform public.forget_customer(salon_a, '3331112222');
    raise exception 'TEST FALLITO: B ha cancellato un cliente di A';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- 7. Diritto all'oblio: il titolare A cancella i dati di Mario
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  n := public.forget_customer(salon_a, '3331112222');
  if n <> 3 then raise exception 'TEST FALLITO: cancellati % appuntamenti invece di 3', n; end if;
  select count(*) into n from public.appointments
  where salon_id = salon_a and (customer_phone like '%1112222%' or customer_name like 'Mario%' or notes is not null);
  if n <> 0 then raise exception 'TEST FALLITO: restano dati personali di Mario'; end if;
  select count(*) into n from public.appointments where salon_id = salon_a;
  if n <> 4 then raise exception 'TEST FALLITO: la cancellazione ha eliminato appuntamenti invece di anonimizzarli'; end if;
  reset role;

  raise exception 'TEST SUPERATO: settimana, clienti, cancellazione dati e abbonamenti rispettano tutte le regole. Dati di prova annullati.';
end;
$$;

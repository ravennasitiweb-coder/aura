-- Test del "salto di qualità". Come gli altri test: risultato in rosso,
-- tutti i dati di prova annullati.

do $$
declare
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  collab uuid := gen_random_uuid();
  salon_a uuid;
  salon_b uuid;
  slug text := 'test-salto-' || left(gen_random_uuid()::text, 8);
  giulia uuid;
  marco uuid;
  taglio uuid;
  -- Un martedì tra 1 e 2 settimane (giorno aperto nel test)
  d date := (current_date + 7) + ((9 - extract(isodow from current_date + 7)::integer) % 7);
  r jsonb;
  t uuid;
  t_soon uuid;
  appt uuid;
  invite_token uuid;
  n int;
  ok boolean;
  v text;
begin
  insert into auth.users (id, aud, role, email) values
    (owner_a, 'authenticated', 'authenticated', 'titolare-a@test.invalid'),
    (owner_b, 'authenticated', 'authenticated', 'titolare-b@test.invalid'),
    (collab, 'authenticated', 'authenticated', 'giulia@test.invalid');

  -- Il titolare A prepara l'attività -------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated', 'email', 'titolare-a@test.invalid')::text, true);
  set local role authenticated;
  select id into salon_a from public.create_salon('Salone di prova A', slug);
  insert into public.staff (salon_id, name) values (salon_a, 'Giulia') returning id into giulia;
  insert into public.staff (salon_id, name) values (salon_a, 'Marco') returning id into marco;
  insert into public.services (salon_id, name, duration_min, price_cents) values (salon_a, 'Taglio', 30, 2000) returning id into taglio;
  insert into public.staff_services (salon_id, staff_id, service_id) values (salon_a, giulia, taglio), (salon_a, marco, taglio);
  perform public.set_opening_hours(salon_a, '[{"weekday": 2, "opens_at": "09:00", "closes_at": "19:00"}]');

  -- 1. Orari personali: Marco il martedì lavora solo 15–19
  perform public.set_staff_hours(marco, '[{"weekday": 2, "opens_at": "15:00", "closes_at": "19:00"}]');
  -- 2. Assenza: Giulia ferma dalle 10 alle 12 di quel martedì
  perform public.add_time_off(giulia, (d + time '10:00')::timestamp, (d + time '12:00')::timestamp, 'Visita');

  -- 3. Un cliente con consenso marketing, venuto in passato
  appt := public.create_appointment(salon_a, giulia, taglio, current_date - 40, '10:00', 'Lucia Verdi', '3401234567', null, 'lucia@test.invalid', true);
  update public.appointments set status = 'completed' where id = appt;
  -- Un cliente senza consenso
  appt := public.create_appointment(salon_a, giulia, taglio, current_date - 30, '11:00', 'Paolo Neri', '3409876543', null, 'paolo@test.invalid', false);
  update public.appointments set status = 'completed' where id = appt;
  reset role;

  -- Da qui un visitatore anonimo ----------------------------------------
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;

  -- 4. Giorno pubblico: orari personali e assenza compaiono
  r := public.public_day(slug, d);
  if jsonb_array_length(r -> 'staff_ranges') <> 1 or not (r -> 'staff_with_hours') ? marco::text then
    raise exception 'TEST FALLITO: il giorno pubblico non riporta gli orari personali';
  end if;
  if jsonb_array_length(r -> 'busy') <> 1 or (r -> 'busy' -> 0 ->> 'start')::int <> 600 then
    raise exception 'TEST FALLITO: l''assenza non risulta occupata nel giorno pubblico';
  end if;

  -- 5. Marco al mattino: rifiutato (fuori dai suoi orari)
  begin
    perform public.public_book(slug, taglio, marco, d, '10:00', 'Cliente', '3330000001', null, true);
    raise exception 'TEST FALLITO: prenotato Marco fuori dai suoi orari';
  exception when sqlstate 'SB023' then null;
  end;
  -- 6. Giulia durante l'assenza: rifiutata
  begin
    perform public.public_book(slug, taglio, giulia, d, '10:30', 'Cliente', '3330000002', null, true);
    raise exception 'TEST FALLITO: prenotata Giulia durante un''assenza';
  exception when sqlstate 'SB025' then null;
  end;
  -- 7. Prenotazioni valide, una con consenso marketing
  r := public.public_book(slug, taglio, marco, d, '15:00', 'Anna Blu', '3331112233', 'anna@test.invalid', true, true);
  t := (r ->> 'manage_token')::uuid;
  if t is null then raise exception 'TEST FALLITO: la prenotazione non restituisce il link personale'; end if;

  -- 8. Link personale: dettagli, conferma
  r := public.public_appointment(t);
  if r ->> 'staff_name' <> 'Marco' or (r ->> 'can_change')::boolean is not true then
    raise exception 'TEST FALLITO: dettagli del link personale sbagliati';
  end if;
  ok := public.public_confirm(t);
  if not ok or (public.public_appointment(t) ->> 'confirmed')::boolean is not true then
    raise exception 'TEST FALLITO: conferma del cliente non registrata';
  end if;

  -- 9. Spostamento dal cliente: su orario valido sì, fuori orario no
  r := public.public_reschedule(t, d, '16:00');
  begin
    perform public.public_reschedule(t, d, '09:00');
    raise exception 'TEST FALLITO: spostato fuori dagli orari di Marco';
  exception when sqlstate 'SB023' then null;
  end;
  -- Un altro cliente occupa le 17:00: spostarsi lì è vietato
  perform public.public_book(slug, taglio, marco, d, '17:00', 'Carlo', '3331112244', null, true);
  begin
    perform public.public_reschedule(t, d, '17:00');
    raise exception 'TEST FALLITO: spostato su un orario occupato';
  exception when exclusion_violation then null;
  end;

  -- 10. Lista d'attesa: iscrizione sì, lettura della tabella no
  ok := public.public_join_waitlist(slug, taglio, null, d, 'Rita', '3335556677', 'rita@test.invalid', true);
  begin
    perform 1 from public.waitlist limit 1;
    raise exception 'TEST FALLITO: un visitatore legge la lista d''attesa';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.public_join_waitlist(slug, taglio, null, d, 'Rita', '3335556677', 'non-email', true);
    raise exception 'TEST FALLITO: lista d''attesa accettata senza email valida';
  exception when sqlstate 'SB013' then null;
  end;

  -- 11. Annullamento dal cliente: lontano sì; troppo vicino no
  ok := public.public_cancel(t);
  if (public.public_appointment(t) ->> 'status') <> 'cancelled' then raise exception 'TEST FALLITO: annullamento non registrato'; end if;
  reset role;
  -- Appuntamento tra 2 ore (inserito direttamente): dentro le 24 ore di preavviso
  insert into public.appointments (salon_id, staff_id, service_id, customer_name, starts_at, ends_at)
  values (salon_a, giulia, taglio, 'Last minute', now() + interval '2 hours', now() + interval '2 hours 30 minutes')
  returning manage_token into t_soon;
  set local role anon;
  begin
    perform public.public_cancel(t_soon);
    raise exception 'TEST FALLITO: annullato online dentro il preavviso';
  exception when sqlstate 'SB026' then null;
  end;
  if (public.public_appointment(t_soon) ->> 'can_change')::boolean then
    raise exception 'TEST FALLITO: il link dice modificabile dentro il preavviso';
  end if;

  -- 12. Il visitatore non può usare il controllo interno né le funzioni dell'app
  begin
    perform public.slot_problem(salon_a, taglio, marco, d, '15:00');
    raise exception 'TEST FALLITO: un visitatore usa slot_problem';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.marketing_audience(salon_a);
    raise exception 'TEST FALLITO: un visitatore legge il pubblico marketing';
  exception when insufficient_privilege then null;
  end;
  reset role;

  -- Di nuovo il titolare A ----------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated', 'email', 'titolare-a@test.invalid')::text, true);
  set local role authenticated;

  -- 13. Pubblico marketing: Lucia sì (consenso), Paolo no (niente consenso)
  select count(*) into n from public.marketing_audience(salon_a) m where m.customer_email = 'lucia@test.invalid';
  if n <> 1 then raise exception 'TEST FALLITO: Lucia (con consenso) non è nel pubblico'; end if;
  select count(*) into n from public.marketing_audience(salon_a) m where m.customer_email = 'paolo@test.invalid';
  if n <> 0 then raise exception 'TEST FALLITO: Paolo (senza consenso) è nel pubblico'; end if;

  -- 14. Il registro messaggi non si scrive dall'app
  begin
    insert into public.message_log (salon_id, kind, ref) values (salon_a, 'test', 'x');
    raise exception 'TEST FALLITO: un utente scrive nel registro messaggi';
  exception when insufficient_privilege then null;
  end;

  -- 15. Scheda tecnica cliente
  insert into public.customer_notes (salon_id, customer_key, notes) values (salon_a, '3401234567', 'Colore 6.3');

  -- 16. Statistiche: almeno i 2 completati e l'incasso
  r := public.salon_stats(salon_a, current_date - 60, current_date);
  if (r ->> 'completed')::int <> 2 or (r ->> 'revenue_cents')::int <> 4000 then
    raise exception 'TEST FALLITO: statistiche sbagliate (%)', r;
  end if;

  -- 17. Invito al collaboratore
  insert into public.salon_invites (salon_id, staff_id, email) values (salon_a, giulia, 'giulia@test.invalid') returning token into invite_token;
  reset role;

  -- 18. Disiscrizione dal link dell'email: Lucia esce dal pubblico.
  -- Il link si legge prima, con i permessi pieni: un visitatore non può leggere gli appuntamenti.
  select a.manage_token into t from public.appointments a where a.salon_id = salon_a and a.customer_name = 'Lucia Verdi' limit 1;
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  set local role anon;
  ok := public.public_unsubscribe(t);
  if not ok then raise exception 'TEST FALLITO: disiscrizione non riuscita'; end if;
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated', 'email', 'titolare-a@test.invalid')::text, true);
  set local role authenticated;
  select count(*) into n from public.marketing_audience(salon_a) m where m.customer_email = 'lucia@test.invalid';
  if n <> 0 then raise exception 'TEST FALLITO: Lucia disiscritta riceve ancora messaggi'; end if;
  reset role;

  -- 19. Il titolare B: non vede note, inviti, lista d'attesa, orari, assenze di A
  perform set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated', 'email', 'titolare-b@test.invalid')::text, true);
  set local role authenticated;
  select id into salon_b from public.create_salon('Salone di prova B', 'test-salto-b-' || left(owner_b::text, 8));
  select (select count(*) from public.customer_notes) + (select count(*) from public.salon_invites)
       + (select count(*) from public.waitlist) + (select count(*) from public.staff_hours)
       + (select count(*) from public.staff_time_off) into n;
  if n <> 0 then raise exception 'TEST FALLITO: B vede % righe dei dati di A', n; end if;
  begin
    perform public.set_staff_hours(marco, '[]');
    raise exception 'TEST FALLITO: B ha cambiato gli orari di un collaboratore di A';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.accept_invite(invite_token);
    raise exception 'TEST FALLITO: B ha accettato un invito non suo';
  exception when sqlstate 'SB031' then null;
  end;
  reset role;

  -- 20. Giulia accetta l'invito e diventa collaboratrice
  perform set_config('request.jwt.claims', json_build_object('sub', collab, 'role', 'authenticated', 'email', 'giulia@test.invalid')::text, true);
  set local role authenticated;
  if public.accept_invite(invite_token) <> salon_a then raise exception 'TEST FALLITO: invito non accettato'; end if;
  -- Vede l'agenda e la scheda tecnica...
  select count(*) into n from public.appointments where salon_id = salon_a;
  if n = 0 then raise exception 'TEST FALLITO: la collaboratrice non vede l''agenda'; end if;
  select count(*) into n from public.customer_notes where salon_id = salon_a;
  if n <> 1 then raise exception 'TEST FALLITO: la collaboratrice non vede le note'; end if;
  -- ...ma non può fare cose da titolare
  begin
    insert into public.salon_invites (salon_id, email) values (salon_a, 'altro@test.invalid');
    raise exception 'TEST FALLITO: una collaboratrice crea inviti';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.set_staff_hours(giulia, '[]');
    raise exception 'TEST FALLITO: una collaboratrice cambia gli orari';
  exception when insufficient_privilege then null;
  end;
  reset role;

  select count(*) into n from public.staff where id = giulia and user_id = collab;
  if n <> 1 then raise exception 'TEST FALLITO: account non collegato al collaboratore'; end if;

  -- 21. Il titolare toglie l'accesso; non può togliere sé stesso come titolare
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated', 'email', 'titolare-a@test.invalid')::text, true);
  set local role authenticated;
  delete from public.salon_members where salon_id = salon_a and user_id = collab;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FALLITO: il titolare non riesce a togliere l''accesso'; end if;
  delete from public.salon_members where salon_id = salon_a and user_id = owner_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FALLITO: è stato rimosso un titolare'; end if;

  -- 22. Diritto all'oblio: cancella anche la scheda tecnica
  perform public.forget_customer(salon_a, '3401234567');
  select count(*) into n from public.customer_notes where salon_id = salon_a;
  if n <> 0 then raise exception 'TEST FALLITO: la scheda tecnica resta dopo la cancellazione'; end if;
  reset role;

  raise exception 'TEST SUPERATO: orari personali, assenze, link del cliente, lista d''attesa, inviti, consensi e statistiche funzionano. Dati di prova annullati.';
end;
$$;

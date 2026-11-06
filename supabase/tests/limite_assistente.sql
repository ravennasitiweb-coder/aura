-- Test del limite dell'assistente AI. Risultato in rosso, dati annullati.
do $$
declare
  owner_a uuid := gen_random_uuid();
  other uuid := gen_random_uuid();
  salon_a uuid;
  i integer;
begin
  insert into auth.users (id, aud, role, email) values
    (owner_a, 'authenticated', 'authenticated', 'ai-a@test.invalid'),
    (other, 'authenticated', 'authenticated', 'ai-b@test.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon_a from public.create_salon('Prova AI', 'test-ai-' || left(owner_a::text, 8));

  for i in 1..10 loop
    if not public.use_ai_request(salon_a) then raise exception 'TEST FALLITO: bloccata la richiesta %', i; end if;
  end loop;
  if public.use_ai_request(salon_a) then raise exception 'TEST FALLITO: concessa l''undicesima richiesta'; end if;
  if public.use_ai_request(salon_a, 1000) then raise exception 'TEST FALLITO: il limite si può alzare dal browser'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  begin
    perform public.use_ai_request(salon_a);
    raise exception 'TEST FALLITO: un estraneo usa le richieste di un''altra attività';
  exception when insufficient_privilege then null;
  end;

  raise exception 'TEST SUPERATO: massimo 10 richieste al giorno per attività, solo il titolare. Dati di prova annullati.';
end;
$$;

-- Test di isolamento tra saloni (Row Level Security).
-- Da eseguire nel SQL Editor di Supabase.
--
-- Simula due titolari, A e B, ognuno con il suo salone, e verifica che
-- nessuno dei due possa vedere o modificare il salone dell'altro.
-- Alla fine lo script ANNULLA TUTTO di proposito: per questo il risultato
-- compare come messaggio di errore rosso.
--   "TEST SUPERATO ..." = tutto bene
--   "TEST FALLITO ..."  = c'è un problema di sicurezza da correggere

do $$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  salon_a uuid;
  salon_b uuid;
  n int;
begin
  insert into auth.users (id, aud, role, email) values
    (user_a, 'authenticated', 'authenticated', 'titolare-a@test.invalid'),
    (user_b, 'authenticated', 'authenticated', 'titolare-b@test.invalid');

  -- Ognuno crea il proprio salone, come farebbe dall'app
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon_a from public.create_salon('Salone di prova A', 'test-a-' || left(user_a::text, 8));
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', user_b, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select id into salon_b from public.create_salon('Salone di prova B', 'test-b-' || left(user_b::text, 8));

  -- B vede solo il suo salone
  select count(*) into n from public.salons;
  if n <> 1 then raise exception 'TEST FALLITO: B vede % saloni invece di 1', n; end if;
  reset role;

  -- Da qui agisce A
  perform set_config('request.jwt.claims', json_build_object('sub', user_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. A vede solo il suo salone
  select count(*) into n from public.salons;
  if n <> 1 then raise exception 'TEST FALLITO: A vede % saloni invece di 1', n; end if;

  -- 2. A non trova il salone di B nemmeno cercandolo per id
  select count(*) into n from public.salons where id = salon_b;
  if n <> 0 then raise exception 'TEST FALLITO: A può leggere il salone di B'; end if;

  -- 3. A non può modificare il salone di B
  update public.salons set name = 'Modificato da A' where id = salon_b;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'TEST FALLITO: A ha modificato il salone di B'; end if;

  -- 4. A non vede i membri del salone di B
  select count(*) into n from public.salon_members where salon_id = salon_b;
  if n <> 0 then raise exception 'TEST FALLITO: A vede i membri del salone di B'; end if;

  -- 5. A non può aggiungersi da solo al salone di B
  begin
    insert into public.salon_members (salon_id, user_id, role) values (salon_b, user_a, 'owner');
    raise exception 'TEST FALLITO: A si è aggiunto come titolare al salone di B';
  exception
    when insufficient_privilege then null; -- bloccato: corretto
  end;

  -- 6. A può invece modificare il proprio salone
  update public.salons set city = 'Bologna' where id = salon_a;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'TEST FALLITO: A non riesce a modificare il proprio salone'; end if;

  reset role;
  raise exception 'TEST SUPERATO: tutti i 7 controlli sono andati bene. I dati di prova sono stati annullati.';
end;
$$;

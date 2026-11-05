-- Test del nuovo elenco di tipi di attività.
-- Come gli altri test: risultato in rosso, dati di prova annullati.

do $$
declare
  owner_a uuid := gen_random_uuid();
  salon_id uuid;
  n int;
  t text;
begin
  insert into auth.users (id, aud, role, email) values (owner_a, 'authenticated', 'authenticated', 'titolare@test.invalid');
  perform set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1. I nuovi tipi sono accettati
  select id into salon_id from public.create_salon('Lash Studio', 'test-lash-' || left(owner_a::text, 8), null, 'lash_maker');
  update public.salons set business_type = 'immobiliare' where id = salon_id;
  update public.salons set business_type = 'dog_walker' where id = salon_id;

  -- 2. I tipi di prima funzionano ancora
  update public.salons set business_type = 'parrucchiere' where id = salon_id;
  select business_type into t from public.salons where id = salon_id;
  if t <> 'parrucchiere' then raise exception 'TEST FALLITO: i tipi precedenti non funzionano più'; end if;

  -- 3. Tipi esclusi o inventati vengono ancora rifiutati
  begin
    update public.salons set business_type = 'fisioterapista' where id = salon_id;
    raise exception 'TEST FALLITO: accettata un''attività sanitaria esclusa';
  exception when check_violation then null;
  end;
  begin
    update public.salons set business_type = 'ristorante' where id = salon_id;
    raise exception 'TEST FALLITO: accettato un tipo inesistente';
  exception when check_violation then null;
  end;
  reset role;

  -- 4. Esiste un solo vincolo sul tipo (quello vecchio è stato tolto)
  select count(*) into n from pg_constraint
  where conrelid = 'public.salons'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%business_type%';
  if n <> 1 then raise exception 'TEST FALLITO: trovati % vincoli sul tipo invece di 1', n; end if;

  -- 5. L'elenco ammesso contiene 47 tipi.
  -- Postgres lo riscrive come 'parrucchiere'::text, 'barbiere'::text, ...:
  -- si conta quante volte compare "::text"
  select (length(def) - length(replace(def, '::text', ''))) / length('::text') into n
  from (
    select pg_get_constraintdef(oid) as def from pg_constraint
    where conrelid = 'public.salons'::regclass and conname = 'salons_business_type_check'
  ) as c;
  if n <> 47 then raise exception 'TEST FALLITO: il vincolo ammette % tipi invece di 47', n; end if;

  raise exception 'TEST SUPERATO: tutte le 47 attività sono accettate e quelle escluse no. Dati di prova annullati.';
end;
$$;

-- Altri tipi di attività: tutte quelle "semplici" (un cliente, un
-- professionista, un servizio a durata fissa). L'elenco è generato da
-- src/lib/business-types.ts: il test business-types.test.ts lo confronta.
-- Le attività già registrate non cambiano.

-- Toglie il vincolo precedente, qualunque nome abbia ricevuto
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.salons'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%business_type%'
  loop
    execute format('alter table public.salons drop constraint %I', c.conname);
  end loop;
end;
$$;

alter table public.salons
  add constraint salons_business_type_check
  check (business_type in (
    'parrucchiere',
    'barbiere',
    'estetista',
    'onicotecnica',
    'tatuatore',
    'lash_maker',
    'brow_specialist',
    'make_up_artist',
    'parrucchiere_domicilio',
    'solarium',
    'piercing',
    'trucco_semipermanente',
    'massaggi',
    'riflessologia',
    'shiatsu_reiki',
    'consulente_immagine',
    'personal_trainer',
    'pilates',
    'yoga',
    'tennis_padel',
    'nuoto',
    'scuola_guida',
    'sci',
    'musica',
    'ripetizioni',
    'lingue',
    'informatica',
    'coaching',
    'lezioni_fotografia',
    'consulenza',
    'fotografo',
    'avvocato',
    'notaio',
    'immobiliare',
    'architetto',
    'wedding_planner',
    'sartoria',
    'calzolaio',
    'riparazioni_tech',
    'gommista',
    'autolavaggio',
    'officina',
    'interventi_domicilio',
    'toelettatura',
    'addestramento_cani',
    'pet_sitter',
    'dog_walker'
  ));

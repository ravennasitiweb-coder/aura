-- Fase 1: saloni e membri, con isolamento tra saloni (multi-tenant).
--
-- Regola generale: ogni dato appartiene a un salone (salon_id) e la
-- Row Level Security (RLS) lascia vedere a un utente solo i saloni
-- di cui è membro. Anche un errore nel codice dell'app non può
-- esporre i dati di un altro salone.

create type public.member_role as enum ('owner', 'staff');

-- Saloni ---------------------------------------------------------------

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  -- Indirizzo pubblico della pagina di prenotazione, es. /p/salone-aurora
  slug text not null unique
    check (char_length(slug) between 3 and 60 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  city text check (char_length(city) <= 80),
  timezone text not null default 'Europe/Rome',
  created_at timestamptz not null default now()
);

-- Membri: chi lavora in quale salone e con che ruolo -------------------

create table public.salon_members (
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'staff',
  created_at timestamptz not null default now(),
  primary key (salon_id, user_id)
);

create index salon_members_user_id_idx on public.salon_members (user_id);

-- Funzioni di controllo usate dalle regole RLS -------------------------
-- "security definer" permette di leggere salon_members senza far
-- scattare di nuovo le sue stesse regole (eviterebbe un ciclo infinito).

create function public.is_salon_member(p_salon_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id and user_id = (select auth.uid())
  );
$$;

create function public.has_salon_role(p_salon_id uuid, p_role public.member_role)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.salon_members
    where salon_id = p_salon_id and user_id = (select auth.uid()) and role = p_role
  );
$$;

-- Creazione salone: crea il salone e rende titolare chi lo crea,
-- in un'unica operazione (o tutto o niente).

create function public.create_salon(p_name text, p_slug text, p_city text default null)
returns public.salons
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_salon public.salons;
begin
  if v_user_id is null then
    raise exception 'Accesso richiesto' using errcode = '28000';
  end if;

  insert into public.salons (name, slug, city)
  values (trim(p_name), lower(trim(p_slug)), nullif(trim(p_city), ''))
  returning * into v_salon;

  insert into public.salon_members (salon_id, user_id, role)
  values (v_salon.id, v_user_id, 'owner');

  return v_salon;
end;
$$;

-- Permessi -------------------------------------------------------------
-- Gli utenti non loggati (anon) non toccano queste tabelle.
-- La pagina pubblica del salone avrà più avanti un accesso dedicato e limitato.

revoke all on public.salons, public.salon_members from anon;
revoke execute on function public.is_salon_member(uuid) from public, anon;
revoke execute on function public.has_salon_role(uuid, public.member_role) from public, anon;
revoke execute on function public.create_salon(text, text, text) from public, anon;
grant execute on function public.is_salon_member(uuid) to authenticated;
grant execute on function public.has_salon_role(uuid, public.member_role) to authenticated;
grant execute on function public.create_salon(text, text, text) to authenticated;

-- Row Level Security ---------------------------------------------------

alter table public.salons enable row level security;
alter table public.salon_members enable row level security;

create policy "I membri vedono il proprio salone"
  on public.salons for select to authenticated
  using (public.is_salon_member(id));

create policy "Il titolare modifica il proprio salone"
  on public.salons for update to authenticated
  using (public.has_salon_role(id, 'owner'))
  with check (public.has_salon_role(id, 'owner'));

create policy "I membri vedono i colleghi dello stesso salone"
  on public.salon_members for select to authenticated
  using (public.is_salon_member(salon_id));

-- Nessuna regola di insert/update/delete diretta: i saloni si creano solo
-- con create_salon(), e gli inviti ai collaboratori arriveranno in seguito.

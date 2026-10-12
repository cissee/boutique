-- =============================================================================
-- BoutikDëkk — Sécurité : privilèges, helpers d'appartenance et politiques RLS
--
-- Principes :
--   * anon n'a accès à rien ;
--   * authenticated n'a que les privilèges listés explicitement (par colonne) ;
--   * l'appartenance est toujours déduite de auth.uid() via shop_members,
--     jamais d'un shop_id fourni par le navigateur ;
--   * le registre financier n'est accessible en écriture que via les fonctions
--     de 20261012000300_ledger_functions.sql.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers d'appartenance (SECURITY DEFINER pour éviter la récursion RLS)
-- -----------------------------------------------------------------------------
create function private.current_user_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select shop_id from public.shop_members where user_id = auth.uid();
$$;

create function private.is_shop_member(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id and user_id = auth.uid()
  );
$$;

create function private.is_shop_owner(p_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id and user_id = auth.uid() and role = 'owner'
  );
$$;

-- Utilisateurs partageant au moins une boutique avec l'utilisateur courant.
create function private.coworker_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct m.user_id
  from public.shop_members m
  where m.shop_id in (select shop_id from public.shop_members where user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- Privilèges : on part de zéro, puis on accorde le strict nécessaire
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on schema private from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

-- Les politiques RLS appellent ces helpers avec les droits de l'utilisateur.
grant usage on schema private to authenticated;
grant execute on function private.current_user_shop_ids() to authenticated;
grant execute on function private.is_shop_member(uuid) to authenticated;
grant execute on function private.is_shop_owner(uuid) to authenticated;
grant execute on function private.coworker_ids() to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

grant select on public.shops to authenticated;
grant update (name, phone, address) on public.shops to authenticated;

grant select, delete on public.shop_members to authenticated;

grant select on public.customers to authenticated;
grant insert (shop_id, name, phone, notes) on public.customers to authenticated;
grant update (name, phone, notes, archived_at) on public.customers to authenticated;

grant select on public.ledger_transactions to authenticated;
grant select on public.customer_balances to authenticated;

-- -----------------------------------------------------------------------------
-- RLS sur toutes les tables exposées
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_members enable row level security;
alter table public.customers enable row level security;
alter table public.ledger_transactions enable row level security;

-- profiles ---------------------------------------------------------------------
create policy "profiles: lecture de soi et des collègues"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or id in (select private.coworker_ids())
  );

create policy "profiles: modification de soi"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- shops ------------------------------------------------------------------------
create policy "shops: lecture par les membres"
  on public.shops for select to authenticated
  using (id in (select private.current_user_shop_ids()));

create policy "shops: modification par le propriétaire"
  on public.shops for update to authenticated
  using ((select private.is_shop_owner(id)))
  with check ((select private.is_shop_owner(id)));

-- La création passe par public.create_shop() (boutique + propriétaire atomiques).

-- shop_members -----------------------------------------------------------------
create policy "shop_members: lecture par les membres"
  on public.shop_members for select to authenticated
  using (shop_id in (select private.current_user_shop_ids()));

create policy "shop_members: retrait d'un vendeur"
  on public.shop_members for delete to authenticated
  using (
    role = 'seller'
    and (
      (select private.is_shop_owner(shop_id))   -- le propriétaire retire un vendeur
      or user_id = (select auth.uid())          -- un vendeur quitte la boutique
    )
  );

-- L'ajout de vendeurs passera par une fonction d'invitation dédiée.

-- customers --------------------------------------------------------------------
create policy "customers: lecture par les membres"
  on public.customers for select to authenticated
  using (shop_id in (select private.current_user_shop_ids()));

create policy "customers: création par les membres"
  on public.customers for insert to authenticated
  with check (
    shop_id in (select private.current_user_shop_ids())
    and created_by = (select auth.uid())
  );

create policy "customers: modification par les membres"
  on public.customers for update to authenticated
  using (shop_id in (select private.current_user_shop_ids()))
  with check (shop_id in (select private.current_user_shop_ids()));

-- Pas de DELETE : un client est archivé, jamais supprimé.

-- ledger_transactions ----------------------------------------------------------
create policy "ledger: lecture par les membres"
  on public.ledger_transactions for select to authenticated
  using (shop_id in (select private.current_user_shop_ids()));

-- Aucune politique INSERT/UPDATE/DELETE : écriture via fonctions uniquement.

-- -----------------------------------------------------------------------------
-- Gardes métier
-- -----------------------------------------------------------------------------

-- Archivage d'un client : propriétaire uniquement, et solde nul obligatoire.
create function private.customers_guard_archive()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.archived_at is distinct from old.archived_at and auth.uid() is not null then
    if not private.is_shop_owner(new.shop_id) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if new.archived_at is not null
       and (select coalesce(sum(balance_effect), 0)
            from public.ledger_transactions
            where customer_id = new.id) <> 0 then
      raise exception 'customer_has_balance' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger customers_guard_archive
  before update on public.customers
  for each row execute function private.customers_guard_archive();

-- Une boutique garde toujours au moins un propriétaire.
create function private.shop_members_keep_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.shop_members
       where shop_id = old.shop_id and role = 'owner' and id <> old.id
     ) then
    raise exception 'last_owner' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger shop_members_keep_owner
  before update or delete on public.shop_members
  for each row execute function private.shop_members_keep_owner();

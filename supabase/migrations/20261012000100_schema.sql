-- =============================================================================
-- BoutikDëkk — Schéma de base
-- Montants : franc CFA (XOF), sans subdivision -> NUMERIC(14,0).
-- Le registre (ledger_transactions) est en ajout seul : le solde d'un client
-- est toujours recalculable par SUM(balance_effect).
-- =============================================================================

create extension if not exists pg_trgm with schema extensions;

-- Schéma non exposé par l'API REST : fonctions internes (helpers RLS, triggers).
create schema if not exists private;

create type public.shop_role as enum ('owner', 'seller');
create type public.transaction_type as enum ('DEBT', 'REPAYMENT', 'REVERSAL');

-- -----------------------------------------------------------------------------
-- Fonctions utilitaires
-- -----------------------------------------------------------------------------
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles : un profil par utilisateur Supabase Auth
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default ''
              check (char_length(full_name) <= 100),
  phone       text check (phone ~ '^\+[0-9]{8,15}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Création automatique du profil à l'inscription.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text := left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100);
  v_phone text := new.raw_user_meta_data ->> 'phone';
begin
  if v_phone is not null and v_phone !~ '^\+[0-9]{8,15}$' then
    v_phone := null;
  end if;
  insert into public.profiles (id, full_name, phone) values (new.id, v_name, v_phone);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- -----------------------------------------------------------------------------
-- shops
-- -----------------------------------------------------------------------------
create table public.shops (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  owner_id     uuid not null references auth.users (id) on delete restrict,
  phone        text check (phone ~ '^\+[0-9]{8,15}$'),
  address      text check (char_length(address) <= 200),
  currency     text not null default 'XOF' check (currency = 'XOF'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz
);

create index shops_owner_id_idx on public.shops (owner_id);

create trigger shops_set_updated_at
  before update on public.shops
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- shop_members : appartenance d'un utilisateur à une boutique, avec un rôle
-- -----------------------------------------------------------------------------
create table public.shop_members (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        public.shop_role not null,
  created_at  timestamptz not null default now(),
  unique (shop_id, user_id)
);

create index shop_members_user_id_idx on public.shop_members (user_id);

-- -----------------------------------------------------------------------------
-- customers : jamais supprimés, seulement archivés (archived_at)
-- -----------------------------------------------------------------------------
create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete restrict,
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  phone        text check (phone ~ '^\+[0-9]{8,15}$'),
  notes        text check (char_length(notes) <= 1000),
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  archived_at  timestamptz,
  -- Cible de la clé étrangère composite du registre (garantit shop_id cohérent).
  unique (id, shop_id)
);

create index customers_shop_name_idx on public.customers (shop_id, name);
create index customers_shop_phone_idx on public.customers (shop_id, phone) where phone is not null;
create index customers_name_trgm_idx on public.customers using gin (name extensions.gin_trgm_ops);
create index customers_phone_trgm_idx on public.customers using gin (phone extensions.gin_trgm_ops);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- ledger_transactions : registre financier en ajout seul
--
-- balance_effect = effet signé sur le solde du client :
--   DEBT      -> +amount
--   REPAYMENT -> -amount
--   REVERSAL  -> -(balance_effect de la transaction annulée)
-- -----------------------------------------------------------------------------
create table public.ledger_transactions (
  id                       uuid primary key default gen_random_uuid(),
  shop_id                  uuid not null,
  customer_id              uuid not null,
  type                     public.transaction_type not null,
  amount                   numeric(14, 0) not null check (amount > 0),
  balance_effect           numeric(14, 0) not null,
  description              text check (char_length(description) <= 500),
  payment_method           text check (payment_method in (
                             'CASH', 'WAVE', 'ORANGE_MONEY', 'OTHER_MOBILE_MONEY', 'BANK', 'OTHER')),
  occurred_at              timestamptz not null default now(),
  created_by               uuid not null references auth.users (id) on delete restrict,
  created_at               timestamptz not null default now(),
  reversed_transaction_id  uuid unique references public.ledger_transactions (id) on delete restrict,
  -- Identifiant idempotent généré par le client : un renvoi ne crée pas de doublon.
  client_request_id        uuid not null,

  foreign key (customer_id, shop_id)
    references public.customers (id, shop_id) on delete restrict,
  unique (shop_id, client_request_id),

  constraint ledger_balance_effect_matches_type check (
       (type = 'DEBT'      and balance_effect = amount)
    or (type = 'REPAYMENT' and balance_effect = -amount)
    or (type = 'REVERSAL'  and abs(balance_effect) = amount)
  ),
  constraint ledger_reversal_link check (
    (type = 'REVERSAL') = (reversed_transaction_id is not null)
  ),
  constraint ledger_reversal_has_reason check (
    type <> 'REVERSAL' or char_length(btrim(coalesce(description, ''))) > 0
  ),
  constraint ledger_payment_method_only_for_repayment check (
    payment_method is null or type = 'REPAYMENT'
  )
);

create index ledger_shop_occurred_idx on public.ledger_transactions (shop_id, occurred_at desc);
create index ledger_customer_occurred_idx on public.ledger_transactions (customer_id, occurred_at desc);
create index ledger_shop_created_idx on public.ledger_transactions (shop_id, created_at desc);

-- Ajout seul : aucune modification ni suppression, même par erreur.
-- Réutilisé pour toute table en ajout seul (registre, journal d'audit).
create function private.forbid_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '%_is_append_only', tg_table_name
    using errcode = '42501',
          hint = 'Les corrections passent par une nouvelle écriture (REVERSAL).';
end;
$$;

create trigger ledger_no_update
  before update on public.ledger_transactions
  for each row execute function private.forbid_mutation();

create trigger ledger_no_delete
  before delete on public.ledger_transactions
  for each row execute function private.forbid_mutation();

create trigger ledger_no_truncate
  before truncate on public.ledger_transactions
  for each statement execute function private.forbid_mutation();

-- Défense en profondeur : cohérence d'une annulation avec la transaction d'origine.
create function private.ledger_validate_reversal()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_original public.ledger_transactions;
begin
  if new.type <> 'REVERSAL' then
    return new;
  end if;

  select * into v_original
  from public.ledger_transactions
  where id = new.reversed_transaction_id;

  if not found
     or v_original.type = 'REVERSAL'
     or v_original.shop_id <> new.shop_id
     or v_original.customer_id <> new.customer_id
     or v_original.amount <> new.amount
     or new.balance_effect <> -v_original.balance_effect then
    raise exception 'invalid_reversal' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger ledger_validate_reversal
  before insert on public.ledger_transactions
  for each row execute function private.ledger_validate_reversal();

-- Défense en profondeur : un solde client ne devient jamais négatif.
create function private.ledger_check_balance()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select coalesce(sum(balance_effect), 0)
      from public.ledger_transactions
      where customer_id = new.customer_id) < 0 then
    raise exception 'negative_balance' using errcode = '23514';
  end if;
  return null;
end;
$$;

create trigger ledger_check_balance
  after insert on public.ledger_transactions
  for each row execute function private.ledger_check_balance();

-- -----------------------------------------------------------------------------
-- Vue des soldes, calculée depuis le registre (respecte la RLS de l'appelant)
-- -----------------------------------------------------------------------------
create view public.customer_balances
with (security_invoker = true)
as
select
  c.id                                   as customer_id,
  c.shop_id,
  c.name,
  c.phone,
  c.archived_at,
  coalesce(sum(l.balance_effect), 0)::numeric(14, 0) as balance,
  count(l.id)                            as transaction_count,
  max(l.occurred_at)                     as last_transaction_at
from public.customers c
left join public.ledger_transactions l on l.customer_id = c.id
group by c.id;

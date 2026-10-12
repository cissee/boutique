-- =============================================================================
-- BoutikDëkk — Opérations atomiques (RPC appelées par l'application)
--
-- Chaque fonction :
--   1. identifie l'utilisateur via auth.uid() ;
--   2. déduit la boutique de la ligne client en base (jamais du navigateur) ;
--   3. vérifie l'appartenance / le rôle ;
--   4. verrouille la ligne du client (FOR UPDATE) pour sérialiser les opérations
--      concurrentes sur un même client ;
--   5. applique la règle métier puis insère dans le registre ;
--   6. est idempotente : un même client_request_id renvoie la transaction déjà créée.
--
-- Codes d'erreur (champ message) traduits par l'interface :
--   not_authenticated, forbidden, customer_not_found, transaction_not_found,
--   customer_archived, invalid_amount, invalid_date, invalid_payment_method,
--   invalid_input, amount_exceeds_balance, already_reversed,
--   cannot_reverse_reversal, reversal_would_make_negative_balance,
--   idempotency_conflict
-- =============================================================================

-- Montant maximal d'une transaction : 1 milliard FCFA (identique au frontend).
create function private.assert_valid_amount(p_amount numeric)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount) or p_amount > 1000000000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
end;
$$;

-- Date d'opération : pas dans le futur (marge d'un jour), pas plus de 10 ans en arrière
-- (reprise des anciens cahiers).
create function private.assert_valid_occurred_at(p_occurred_at timestamptz)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_occurred_at is null
     or p_occurred_at > now() + interval '1 day'
     or p_occurred_at < now() - interval '10 years' then
    raise exception 'invalid_date' using errcode = '22023';
  end if;
end;
$$;

-- Utilisateur courant, sinon erreur.
create function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return v_uid;
end;
$$;

-- Verrouille un client actif de la boutique de l'utilisateur.
-- Un client d'une autre boutique est traité comme inexistant (pas de fuite d'information).
create function private.lock_customer(p_customer_id uuid)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer public.customers;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;

  if not found or not private.is_shop_member(v_customer.shop_id) then
    raise exception 'customer_not_found' using errcode = 'P0002';
  end if;
  return v_customer;
end;
$$;

create function private.customer_balance(p_customer_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(balance_effect), 0)
  from public.ledger_transactions
  where customer_id = p_customer_id;
$$;

-- Transaction déjà enregistrée pour cette clé d'idempotence, si elle existe.
-- Une même clé réutilisée pour une opération différente est une erreur.
create function private.find_idempotent(
  p_shop_id uuid,
  p_client_request_id uuid,
  p_type public.transaction_type,
  p_customer_id uuid,
  p_amount numeric
)
returns public.ledger_transactions
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_existing public.ledger_transactions;
begin
  if p_client_request_id is null then
    raise exception 'invalid_input' using errcode = '22023', detail = 'client_request_id';
  end if;

  select * into v_existing
  from public.ledger_transactions
  where shop_id = p_shop_id and client_request_id = p_client_request_id;

  if found and (
       v_existing.type <> p_type
    or v_existing.customer_id <> p_customer_id
    or (p_amount is not null and v_existing.amount <> p_amount)
  ) then
    raise exception 'idempotency_conflict' using errcode = 'P0001';
  end if;

  return v_existing; -- NULL si absente
end;
$$;

-- -----------------------------------------------------------------------------
-- create_shop : crée une boutique et en fait l'utilisateur propriétaire
-- -----------------------------------------------------------------------------
create function public.create_shop(
  p_name text,
  p_phone text default null,
  p_address text default null
)
returns public.shops
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_shop public.shops;
begin
  insert into public.shops (name, owner_id, phone, address)
  values (btrim(p_name), v_uid, nullif(btrim(p_phone), ''), nullif(btrim(p_address), ''))
  returning * into v_shop;

  insert into public.shop_members (shop_id, user_id, role)
  values (v_shop.id, v_uid, 'owner');

  return v_shop;
end;
$$;

-- -----------------------------------------------------------------------------
-- record_debt : ajoute une dette (augmente le solde)
-- -----------------------------------------------------------------------------
create function public.record_debt(
  p_customer_id uuid,
  p_amount numeric,
  p_client_request_id uuid,
  p_description text default null,
  p_occurred_at timestamptz default now()
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_customer public.customers;
  v_tx       public.ledger_transactions;
begin
  perform private.assert_valid_amount(p_amount);
  perform private.assert_valid_occurred_at(p_occurred_at);

  v_customer := private.lock_customer(p_customer_id);

  v_tx := private.find_idempotent(v_customer.shop_id, p_client_request_id, 'DEBT', p_customer_id, p_amount);
  if v_tx.id is not null then
    return v_tx;
  end if;

  if v_customer.archived_at is not null then
    raise exception 'customer_archived' using errcode = 'P0001';
  end if;

  insert into public.ledger_transactions (
    shop_id, customer_id, type, amount, balance_effect,
    description, occurred_at, created_by, client_request_id
  ) values (
    v_customer.shop_id, v_customer.id, 'DEBT', p_amount, p_amount,
    nullif(btrim(p_description), ''), p_occurred_at, v_uid, p_client_request_id
  )
  returning * into v_tx;

  return v_tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- record_repayment : enregistre un remboursement (diminue le solde)
-- Refusé s'il dépasse le solde courant.
-- -----------------------------------------------------------------------------
create function public.record_repayment(
  p_customer_id uuid,
  p_amount numeric,
  p_client_request_id uuid,
  p_payment_method text default null,
  p_comment text default null,
  p_occurred_at timestamptz default now()
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_customer public.customers;
  v_balance  numeric;
  v_tx       public.ledger_transactions;
begin
  perform private.assert_valid_amount(p_amount);
  perform private.assert_valid_occurred_at(p_occurred_at);

  if p_payment_method is not null and p_payment_method not in (
    'CASH', 'WAVE', 'ORANGE_MONEY', 'OTHER_MOBILE_MONEY', 'BANK', 'OTHER'
  ) then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  v_customer := private.lock_customer(p_customer_id);

  v_tx := private.find_idempotent(v_customer.shop_id, p_client_request_id, 'REPAYMENT', p_customer_id, p_amount);
  if v_tx.id is not null then
    return v_tx;
  end if;

  if v_customer.archived_at is not null then
    raise exception 'customer_archived' using errcode = 'P0001';
  end if;

  -- Calcul fait après le verrou : aucun autre paiement ne peut s'intercaler.
  v_balance := private.customer_balance(v_customer.id);
  if p_amount > v_balance then
    raise exception 'amount_exceeds_balance'
      using errcode = 'P0001', detail = v_balance::text;
  end if;

  insert into public.ledger_transactions (
    shop_id, customer_id, type, amount, balance_effect,
    description, payment_method, occurred_at, created_by, client_request_id
  ) values (
    v_customer.shop_id, v_customer.id, 'REPAYMENT', p_amount, -p_amount,
    nullif(btrim(p_comment), ''), p_payment_method, p_occurred_at, v_uid, p_client_request_id
  )
  returning * into v_tx;

  return v_tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- reverse_transaction : annule une dette ou un remboursement (propriétaire)
-- La transaction d'origine reste intacte ; une écriture inverse est ajoutée.
-- -----------------------------------------------------------------------------
create function public.reverse_transaction(
  p_transaction_id uuid,
  p_reason text,
  p_client_request_id uuid
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := private.require_user();
  v_original public.ledger_transactions;
  v_customer public.customers;
  v_tx       public.ledger_transactions;
begin
  if char_length(btrim(coalesce(p_reason, ''))) = 0 then
    raise exception 'invalid_input' using errcode = '22023', detail = 'reason';
  end if;

  select * into v_original
  from public.ledger_transactions
  where id = p_transaction_id;

  if not found or not private.is_shop_member(v_original.shop_id) then
    raise exception 'transaction_not_found' using errcode = 'P0002';
  end if;

  if not private.is_shop_owner(v_original.shop_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_customer := private.lock_customer(v_original.customer_id);

  v_tx := private.find_idempotent(v_original.shop_id, p_client_request_id, 'REVERSAL', v_original.customer_id, null);
  if v_tx.id is not null then
    if v_tx.reversed_transaction_id <> p_transaction_id then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    return v_tx;
  end if;

  if v_original.type = 'REVERSAL' then
    raise exception 'cannot_reverse_reversal' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.ledger_transactions where reversed_transaction_id = p_transaction_id) then
    raise exception 'already_reversed' using errcode = 'P0001';
  end if;

  -- Annuler une dette déjà remboursée rendrait le solde négatif :
  -- il faut d'abord annuler le remboursement correspondant.
  if private.customer_balance(v_customer.id) - v_original.balance_effect < 0 then
    raise exception 'reversal_would_make_negative_balance' using errcode = 'P0001';
  end if;

  insert into public.ledger_transactions (
    shop_id, customer_id, type, amount, balance_effect,
    description, occurred_at, created_by, reversed_transaction_id, client_request_id
  ) values (
    v_original.shop_id, v_original.customer_id, 'REVERSAL', v_original.amount, -v_original.balance_effect,
    btrim(p_reason), now(), v_uid, v_original.id, p_client_request_id
  )
  returning * into v_tx;

  return v_tx;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privilèges : seules les RPC publiques sont appelables, et uniquement connecté
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.current_user_shop_ids() to authenticated;
grant execute on function private.is_shop_member(uuid) to authenticated;
grant execute on function private.is_shop_owner(uuid) to authenticated;
grant execute on function private.coworker_ids() to authenticated;

revoke execute on function public.create_shop(text, text, text) from public, anon;
revoke execute on function public.record_debt(uuid, numeric, uuid, text, timestamptz) from public, anon;
revoke execute on function public.record_repayment(uuid, numeric, uuid, text, text, timestamptz) from public, anon;
revoke execute on function public.reverse_transaction(uuid, text, uuid) from public, anon;

grant execute on function public.create_shop(text, text, text) to authenticated;
grant execute on function public.record_debt(uuid, numeric, uuid, text, timestamptz) to authenticated;
grant execute on function public.record_repayment(uuid, numeric, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.reverse_transaction(uuid, text, uuid) to authenticated;

-- =============================================================================
-- BoutikDëkk — Correction du montant d'une opération
--
-- Le registre reste en ajout seul : corriger = annuler l'opération d'origine ET
-- enregistrer la nouvelle, dans une seule transaction PostgreSQL. La nouvelle
-- opération pointe vers celle qu'elle remplace (replaces_transaction_id).
--
-- Droits : le propriétaire, toujours ; l'auteur de la saisie, pendant 30 minutes.
-- =============================================================================

alter table public.ledger_transactions
  add column replaces_transaction_id uuid references public.ledger_transactions (id) on delete restrict;

alter table public.ledger_transactions
  add constraint ledger_replacement_type check (
    replaces_transaction_id is null or type in ('DEBT', 'REPAYMENT')
  );

-- Une opération n'est remplacée qu'une seule fois.
create unique index ledger_replaces_unique
  on public.ledger_transactions (replaces_transaction_id)
  where replaces_transaction_id is not null;

create function public.correct_transaction(
  p_transaction_id uuid,
  p_new_amount numeric,
  p_client_request_id uuid,
  p_reason text default null
)
returns public.ledger_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := private.require_user();
  v_original  public.ledger_transactions;
  v_customer  public.customers;
  v_existing  public.ledger_transactions;
  v_new       public.ledger_transactions;
  v_reason    text := coalesce(nullif(btrim(p_reason), ''), 'Correction du montant');
  -- Clé d'idempotence de l'annulation, dérivée de celle de la correction (rejouable).
  v_reversal_request uuid := md5(p_client_request_id::text || ':reversal')::uuid;
  v_balance   numeric;
begin
  perform private.assert_valid_amount(p_new_amount);

  select * into v_original from public.ledger_transactions where id = p_transaction_id;
  if not found or not private.is_shop_member(v_original.shop_id) then
    raise exception 'transaction_not_found' using errcode = 'P0002';
  end if;

  if not private.is_shop_owner(v_original.shop_id)
     and not (v_original.created_by = v_uid and v_original.created_at > now() - interval '30 minutes') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_customer := private.lock_customer(v_original.customer_id);

  -- Rejeu de la même correction : on renvoie la nouvelle opération déjà créée.
  v_existing := private.find_idempotent(v_original.shop_id, p_client_request_id, v_original.type, v_original.customer_id, p_new_amount);
  if v_existing.id is not null then
    if v_existing.replaces_transaction_id is distinct from p_transaction_id then
      raise exception 'idempotency_conflict' using errcode = 'P0001';
    end if;
    return v_existing;
  end if;

  if v_original.type = 'REVERSAL' then
    raise exception 'cannot_reverse_reversal' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.ledger_transactions where reversed_transaction_id = p_transaction_id) then
    raise exception 'already_reversed' using errcode = 'P0001';
  end if;
  if v_customer.archived_at is not null then
    raise exception 'customer_archived' using errcode = 'P0001';
  end if;
  if p_new_amount = v_original.amount then
    raise exception 'same_amount' using errcode = 'P0001';
  end if;

  -- Solde après correction = solde actuel - effet d'origine + nouvel effet.
  v_balance := private.customer_balance(v_customer.id) - v_original.balance_effect
               + case when v_original.type = 'DEBT' then p_new_amount else -p_new_amount end;
  if v_balance < 0 then
    raise exception 'correction_would_make_negative_balance' using errcode = 'P0001';
  end if;

  -- Ordre d'insertion choisi pour que le solde ne passe jamais sous zéro entre les deux écritures
  -- (un trigger le vérifie après chaque ligne) : dette -> nouvelle d'abord ; remboursement -> annulation d'abord.
  if v_original.type = 'REPAYMENT' then
    insert into public.ledger_transactions (
      shop_id, customer_id, type, amount, balance_effect, description, occurred_at,
      created_by, reversed_transaction_id, client_request_id
    ) values (
      v_original.shop_id, v_original.customer_id, 'REVERSAL', v_original.amount, -v_original.balance_effect,
      v_reason, now(), v_uid, v_original.id, v_reversal_request
    );
  end if;

  insert into public.ledger_transactions (
    shop_id, customer_id, type, amount, balance_effect, description, payment_method,
    occurred_at, created_by, client_request_id, replaces_transaction_id
  ) values (
    v_original.shop_id, v_original.customer_id, v_original.type, p_new_amount,
    case when v_original.type = 'DEBT' then p_new_amount else -p_new_amount end,
    v_original.description, v_original.payment_method,
    v_original.occurred_at, v_uid, p_client_request_id, v_original.id
  )
  returning * into v_new;

  if v_original.type = 'DEBT' then
    insert into public.ledger_transactions (
      shop_id, customer_id, type, amount, balance_effect, description, occurred_at,
      created_by, reversed_transaction_id, client_request_id
    ) values (
      v_original.shop_id, v_original.customer_id, 'REVERSAL', v_original.amount, -v_original.balance_effect,
      v_reason, now(), v_uid, v_original.id, v_reversal_request
    );
  end if;

  return v_new;
end;
$$;

revoke execute on function public.correct_transaction(uuid, numeric, uuid, text) from public, anon;
grant execute on function public.correct_transaction(uuid, numeric, uuid, text) to authenticated;

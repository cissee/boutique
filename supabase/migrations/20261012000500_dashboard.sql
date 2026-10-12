-- =============================================================================
-- BoutikDëkk — Indicateurs du tableau de bord
-- SECURITY INVOKER : la fonction s'exécute avec les droits de l'appelant, donc la RLS
-- s'applique. Un utilisateur qui n'est pas membre de la boutique n'obtient que des zéros.
-- "Aujourd'hui" = journée calendaire à Dakar. Les opérations annulées sont exclues.
-- =============================================================================

create function public.shop_dashboard(p_shop_id uuid)
returns table (
  total_outstanding       numeric,
  debtor_count            bigint,
  customer_count          bigint,
  repayments_today        numeric,
  repayments_today_count  bigint,
  debts_today             numeric,
  debts_today_count       bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with balances as (
    select c.id, coalesce(sum(l.balance_effect), 0) as balance
    from public.customers c
    left join public.ledger_transactions l on l.customer_id = c.id
    where c.shop_id = p_shop_id
      and c.archived_at is null
    group by c.id
  ),
  today as (
    select l.type, l.amount
    from public.ledger_transactions l
    where l.shop_id = p_shop_id
      and l.occurred_at >= (date_trunc('day', now() at time zone 'Africa/Dakar') at time zone 'Africa/Dakar')
      and l.type in ('DEBT', 'REPAYMENT')
      and not exists (
        select 1 from public.ledger_transactions r where r.reversed_transaction_id = l.id
      )
  )
  select
    (select coalesce(sum(balance), 0) from balances)::numeric(14, 0),
    (select count(*) from balances where balance > 0),
    (select count(*) from balances),
    (select coalesce(sum(amount), 0) from today where type = 'REPAYMENT')::numeric(14, 0),
    (select count(*) from today where type = 'REPAYMENT'),
    (select coalesce(sum(amount), 0) from today where type = 'DEBT')::numeric(14, 0),
    (select count(*) from today where type = 'DEBT');
$$;

revoke execute on function public.shop_dashboard(uuid) from public, anon;
grant execute on function public.shop_dashboard(uuid) to authenticated;

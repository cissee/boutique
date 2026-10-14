-- =============================================================================
-- BoutikDëkk — Rapport d'activité sur une période
-- SECURITY INVOKER : la RLS s'applique (un non-membre n'obtient que des zéros).
-- Bornes : du p_from 00:00 au p_to 23:59:59 à Dakar, incluses.
-- Les dettes et remboursements annulés ne sont pas comptés.
-- =============================================================================

create function public.shop_report(p_shop_id uuid, p_from date, p_to date)
returns table (
  debts_total           numeric,
  debts_count           bigint,
  repayments_total      numeric,
  repayments_count      bigint,
  repayments_by_method  jsonb,
  reversals_count       bigint,
  new_customers         bigint,
  outstanding_end       numeric
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end   timestamptz;
begin
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'invalid_date' using errcode = '22023';
  end if;

  v_start := p_from::timestamp at time zone 'Africa/Dakar';
  v_end   := (p_to + 1)::timestamp at time zone 'Africa/Dakar';

  return query
  with period as (
    select l.type, l.amount, coalesce(l.payment_method, 'NONE') as method
    from public.ledger_transactions l
    where l.shop_id = p_shop_id
      and l.occurred_at >= v_start and l.occurred_at < v_end
      and l.type in ('DEBT', 'REPAYMENT')
      and not exists (
        select 1 from public.ledger_transactions r where r.reversed_transaction_id = l.id
      )
  ),
  by_method as (
    select jsonb_object_agg(method, total) as data
    from (
      select method, sum(amount) as total
      from period
      where type = 'REPAYMENT'
      group by method
    ) m
  )
  select
    (select coalesce(sum(amount), 0) from period where type = 'DEBT')::numeric(14, 0),
    (select count(*) from period where type = 'DEBT'),
    (select coalesce(sum(amount), 0) from period where type = 'REPAYMENT')::numeric(14, 0),
    (select count(*) from period where type = 'REPAYMENT'),
    coalesce((select data from by_method), '{}'::jsonb),
    (select count(*) from public.ledger_transactions l
       where l.shop_id = p_shop_id and l.type = 'REVERSAL'
         and l.created_at >= v_start and l.created_at < v_end),
    (select count(*) from public.customers c
       where c.shop_id = p_shop_id and c.created_at >= v_start and c.created_at < v_end),
    (select coalesce(sum(l.balance_effect), 0) from public.ledger_transactions l
       where l.shop_id = p_shop_id and l.occurred_at < v_end)::numeric(14, 0);
end;
$$;

revoke execute on function public.shop_report(uuid, date, date) from public, anon;
grant execute on function public.shop_report(uuid, date, date) to authenticated;

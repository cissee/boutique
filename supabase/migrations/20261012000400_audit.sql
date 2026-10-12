-- =============================================================================
-- BoutikDëkk — Journal d'audit des opérations sensibles
-- Alimenté uniquement par des triggers ; en ajout seul ; lisible par le propriétaire.
-- =============================================================================

create table public.audit_log (
  id          bigint generated always as identity primary key,
  -- Pas de clé étrangère : le journal ne doit jamais bloquer ni disparaître.
  shop_id     uuid,
  actor_id    uuid,
  action      text not null,          -- ex. "ledger_transactions.insert"
  record_id   uuid,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_shop_created_idx on public.audit_log (shop_id, created_at desc);

create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function private.forbid_mutation();

create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function private.forbid_mutation();

create trigger audit_log_no_truncate
  before truncate on public.audit_log
  for each statement execute function private.forbid_mutation();

alter table public.audit_log enable row level security;

revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

create policy "audit_log: lecture par le propriétaire"
  on public.audit_log for select to authenticated
  using ((select private.is_shop_owner(shop_id)));

-- -----------------------------------------------------------------------------
-- Trigger générique
-- -----------------------------------------------------------------------------
create function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row     jsonb := to_jsonb(coalesce(new, old));
  v_shop_id uuid;
begin
  v_shop_id := case
    when tg_table_name = 'shops' then (v_row ->> 'id')::uuid
    else (v_row ->> 'shop_id')::uuid
  end;

  insert into public.audit_log (shop_id, actor_id, action, record_id, old_data, new_data)
  values (
    v_shop_id,
    auth.uid(),
    tg_table_name || '.' || lower(tg_op),
    (v_row ->> 'id')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end;
$$;

revoke execute on function private.audit_row() from public, anon, authenticated;

create trigger shops_audit
  after insert or update or delete on public.shops
  for each row execute function private.audit_row();

create trigger shop_members_audit
  after insert or update or delete on public.shop_members
  for each row execute function private.audit_row();

create trigger customers_audit
  after insert or update or delete on public.customers
  for each row execute function private.audit_row();

create trigger ledger_transactions_audit
  after insert on public.ledger_transactions
  for each row execute function private.audit_row();

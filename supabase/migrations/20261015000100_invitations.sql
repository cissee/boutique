-- =============================================================================
-- BoutikDëkk — Invitations de vendeurs
-- Le propriétaire génère un code à usage unique (valable 7 jours) qu'il transmet
-- au vendeur (WhatsApp…). Le vendeur, connecté, l'utilise pour rejoindre la boutique.
-- =============================================================================

create table public.shop_invitations (
  id           uuid primary key default gen_random_uuid(),
  shop_id      uuid not null references public.shops (id) on delete cascade,
  code         text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  role         public.shop_role not null default 'seller' check (role = 'seller'),
  created_by   uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  accepted_by  uuid references auth.users (id) on delete set null,
  accepted_at  timestamptz,
  revoked_at   timestamptz,
  constraint invitation_accept_consistent check ((accepted_by is null) = (accepted_at is null))
);

create index shop_invitations_shop_idx on public.shop_invitations (shop_id, created_at desc);

alter table public.shop_invitations enable row level security;

revoke all on public.shop_invitations from anon, authenticated;
grant select on public.shop_invitations to authenticated;
grant update (revoked_at) on public.shop_invitations to authenticated;

create policy "shop_invitations: lecture par le propriétaire"
  on public.shop_invitations for select to authenticated
  using ((select private.is_shop_owner(shop_id)));

create policy "shop_invitations: révocation par le propriétaire"
  on public.shop_invitations for update to authenticated
  using ((select private.is_shop_owner(shop_id)))
  with check ((select private.is_shop_owner(shop_id)));

create trigger shop_invitations_audit
  after insert or update on public.shop_invitations
  for each row execute function private.audit_row();

-- -----------------------------------------------------------------------------
-- Code lisible : 8 caractères sans ambiguïté (pas de 0/O, 1/I/L), tirés de
-- gen_random_uuid() (générateur cryptographique de PostgreSQL).
-- -----------------------------------------------------------------------------
create function private.new_invitation_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  v_code  text := '';
begin
  for i in 0..7 loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, i) % length(v_alphabet)) + 1, 1);
  end loop;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_shop_invitation : propriétaire uniquement, 10 invitations actives au plus
-- -----------------------------------------------------------------------------
create function public.create_shop_invitation(p_shop_id uuid)
returns public.shop_invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_user();
  v_inv public.shop_invitations;
begin
  if not private.is_shop_owner(p_shop_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if (select count(*) from public.shop_invitations
      where shop_id = p_shop_id and accepted_at is null and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'too_many_invitations' using errcode = 'P0001';
  end if;

  -- Collision de code improbable (31^8 possibilités) : on réessaie.
  for attempt in 1..5 loop
    begin
      insert into public.shop_invitations (shop_id, code, created_by)
      values (p_shop_id, private.new_invitation_code(), v_uid)
      returning * into v_inv;
      return v_inv;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;
  return v_inv;
end;
$$;

-- -----------------------------------------------------------------------------
-- accept_shop_invitation : l'utilisateur connecté rejoint la boutique comme vendeur
-- Le code est insensible à la casse, aux espaces et aux tirets.
-- -----------------------------------------------------------------------------
create function public.accept_shop_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[\s-]', '', 'g'));
  v_inv  public.shop_invitations;
begin
  select * into v_inv
  from public.shop_invitations
  where code = v_code
  for update;

  if not found or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  end if;

  -- Rejouer son propre code déjà utilisé : on renvoie simplement la boutique.
  if v_inv.accepted_by = v_uid then
    return v_inv.shop_id;
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invalid_invitation' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.shop_members where shop_id = v_inv.shop_id and user_id = v_uid) then
    raise exception 'already_member' using errcode = 'P0001';
  end if;

  insert into public.shop_members (shop_id, user_id, role) values (v_inv.shop_id, v_uid, v_inv.role);

  update public.shop_invitations
  set accepted_by = v_uid, accepted_at = now()
  where id = v_inv.id;

  return v_inv.shop_id;
end;
$$;

revoke execute on function private.new_invitation_code() from public, anon, authenticated;
revoke execute on function public.create_shop_invitation(uuid) from public, anon;
revoke execute on function public.accept_shop_invitation(text) from public, anon;
grant execute on function public.create_shop_invitation(uuid) to authenticated;
grant execute on function public.accept_shop_invitation(text) to authenticated;

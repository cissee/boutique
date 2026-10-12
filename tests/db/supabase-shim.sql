-- Reproduction minimale de l'environnement Supabase pour exécuter les migrations
-- dans PGlite (PostgreSQL en WebAssembly) sans Docker.
-- Reprend volontairement les privilèges par défaut permissifs de Supabase,
-- afin de vérifier que nos migrations les révoquent bien.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema extensions;
create schema auth;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create table auth.users (
  id                  uuid primary key,
  email               text unique,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now()
);

-- Même logique que auth.uid() de Supabase : lit le "sub" du JWT de la requête.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;

-- Papéis que GoTrue, PostgREST e storage-api esperam (o que a imagem
-- supabase/postgres cria sozinha). Rodar como superusuário no banco do projeto.
-- Uso: psql -v pass=... -v db=... -f init-roles.sql
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select from pg_roles where rolname='anon') then create role anon nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select from pg_roles where rolname='service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select from pg_roles where rolname='authenticator') then create role authenticator login noinherit; end if;
  if not exists (select from pg_roles where rolname='supabase_auth_admin') then create role supabase_auth_admin login noinherit createrole; end if;
  if not exists (select from pg_roles where rolname='supabase_storage_admin') then create role supabase_storage_admin login noinherit createrole; end if;
end $$;
alter role authenticator password :'pass';
alter role supabase_auth_admin password :'pass';
alter role supabase_storage_admin password :'pass';
grant anon, authenticated, service_role to authenticator;
grant anon, authenticated, service_role to supabase_storage_admin;
grant connect, create, temporary on database :"db" to supabase_auth_admin, supabase_storage_admin;
grant connect on database :"db" to authenticator;

create schema if not exists auth authorization supabase_auth_admin;
create schema if not exists storage authorization supabase_storage_admin;
alter role supabase_auth_admin set search_path = auth;
alter role supabase_storage_admin set search_path = storage;
grant usage on schema auth, storage to anon, authenticated, service_role, postgres;
create extension if not exists pgcrypto;

-- Mesmos privilégios padrão do Supabase no schema public.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;

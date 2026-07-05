-- Um owner pode ter mais de um negócio (tenant) — platform_users deixa de
-- usar user_id como PK única e vira uma linha por (user_id, tenant_id).
-- A linha "placeholder" (tenant_id null, criada no signup antes do 1º
-- negócio) continua única por usuário via índice parcial.

alter table public.platform_users drop constraint platform_users_pkey;

alter table public.platform_users add column id uuid primary key default gen_random_uuid();

create unique index platform_users_user_tenant_uidx
  on public.platform_users(user_id, tenant_id);

create unique index platform_users_pending_uidx
  on public.platform_users(user_id)
  where tenant_id is null;

create index platform_users_user_id_idx on public.platform_users(user_id);

-- ============================================================
-- Platform admins (Super Admin da plataforma — "só eu").
-- Identidade de nível plataforma, separada de public.users (que é
-- sempre vinculado a um tenant). Quem está aqui pode operar o painel
-- /superadmin, que escreve em tenants/tenant_settings via service role.
-- ============================================================
create table public.platform_admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS ligado e SEM policies: ninguém lê via anon/authenticated.
-- O acesso é só pelo service-role client (server-side, gate explícito).
alter table public.platform_admins enable row level security;

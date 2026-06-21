-- ============================================================
-- 0002 — Row Level Security
-- Isolamento por tenant. Estratégia (MVP):
--   * Branding (tenants, tenant_settings) = SELECT público (carrega antes do login).
--   * Dados de usuário = derivados de auth.uid() via helper auth_tenant_id().
--   * Staff/admin do tenant enxerga todos os registros do próprio tenant.
-- ============================================================

-- ------------------------------------------------------------
-- Helpers (security definer p/ ler public.users sem recursão de RLS)
-- ------------------------------------------------------------

-- tenant_id do usuário autenticado
create or replace function public.auth_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.users where id = auth.uid();
$$;

-- role do usuário autenticado
create or replace function public.auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- usuário autenticado é staff/admin do próprio tenant?
create or replace function public.auth_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role in ('staff','tenant_admin','super_admin')
       from public.users where id = auth.uid()),
    false
  );
$$;

-- ------------------------------------------------------------
-- Habilita RLS em todas as tabelas
-- ------------------------------------------------------------
alter table public.tenants               enable row level security;
alter table public.tenant_settings       enable row level security;
alter table public.users                 enable row level security;
alter table public.business_plans        enable row level security;
alter table public.memberships           enable row level security;
alter table public.missions              enable row level security;
alter table public.mission_completions   enable row level security;
alter table public.checkins              enable row level security;
alter table public.reward_redemptions    enable row level security;
alter table public.chat_conversations    enable row level security;
alter table public.chat_messages         enable row level security;
alter table public.profile_fields        enable row level security;
alter table public.profile_field_values  enable row level security;

-- ------------------------------------------------------------
-- tenants / tenant_settings — branding é público (read-only)
-- ------------------------------------------------------------
create policy "tenants_public_read" on public.tenants
  for select using (true);

create policy "tenant_settings_public_read" on public.tenant_settings
  for select using (true);

-- ------------------------------------------------------------
-- users — cada um vê a própria linha; staff vê o tenant inteiro
-- ------------------------------------------------------------
create policy "users_self_read" on public.users
  for select using (id = auth.uid());

create policy "users_staff_read" on public.users
  for select using (
    tenant_id = public.auth_tenant_id() and public.auth_is_staff()
  );

-- ------------------------------------------------------------
-- business_plans / missions — catálogo do tenant, legível por
-- qualquer usuário autenticado do mesmo tenant
-- ------------------------------------------------------------
create policy "business_plans_tenant_read" on public.business_plans
  for select using (tenant_id = public.auth_tenant_id());

create policy "missions_tenant_read" on public.missions
  for select using (tenant_id = public.auth_tenant_id());

-- ------------------------------------------------------------
-- Macro p/ tabelas "do usuário": cliente vê o próprio user_id,
-- staff vê todos do tenant.
-- ------------------------------------------------------------

-- memberships
create policy "memberships_self_read" on public.memberships
  for select using (
    tenant_id = public.auth_tenant_id()
    and (user_id = auth.uid() or public.auth_is_staff())
  );

-- mission_completions
create policy "mission_completions_self_read" on public.mission_completions
  for select using (
    tenant_id = public.auth_tenant_id()
    and (user_id = auth.uid() or public.auth_is_staff())
  );
create policy "mission_completions_self_write" on public.mission_completions
  for insert with check (
    tenant_id = public.auth_tenant_id() and user_id = auth.uid()
  );

-- checkins
create policy "checkins_self_read" on public.checkins
  for select using (
    tenant_id = public.auth_tenant_id()
    and (user_id = auth.uid() or public.auth_is_staff())
  );

-- reward_redemptions
create policy "reward_redemptions_self_read" on public.reward_redemptions
  for select using (
    tenant_id = public.auth_tenant_id()
    and (user_id = auth.uid() or public.auth_is_staff())
  );
create policy "reward_redemptions_self_write" on public.reward_redemptions
  for insert with check (
    tenant_id = public.auth_tenant_id() and user_id = auth.uid()
  );

-- chat_conversations
create policy "chat_conversations_self_all" on public.chat_conversations
  for all using (
    tenant_id = public.auth_tenant_id() and user_id = auth.uid()
  ) with check (
    tenant_id = public.auth_tenant_id() and user_id = auth.uid()
  );

-- chat_messages (via conversa do próprio usuário)
create policy "chat_messages_self_all" on public.chat_messages
  for all using (
    tenant_id = public.auth_tenant_id()
    and exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id and c.user_id = auth.uid()
    )
  ) with check (
    tenant_id = public.auth_tenant_id()
    and exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id and c.user_id = auth.uid()
    )
  );

-- profile_fields — definição do tenant, legível por todos do tenant
create policy "profile_fields_tenant_read" on public.profile_fields
  for select using (tenant_id = public.auth_tenant_id());

-- profile_field_values — cliente vê/edita os próprios; staff lê todos
create policy "profile_field_values_self_read" on public.profile_field_values
  for select using (
    tenant_id = public.auth_tenant_id()
    and (user_id = auth.uid() or public.auth_is_staff())
  );
create policy "profile_field_values_self_write" on public.profile_field_values
  for all using (
    tenant_id = public.auth_tenant_id() and user_id = auth.uid()
  ) with check (
    tenant_id = public.auth_tenant_id() and user_id = auth.uid()
  );

-- Nota: mutações de staff/admin (validar resgates, criar missões, etc.)
-- serão feitas via service-role no server (contexto confiável) ou cobertas
-- por policies de escrita específicas quando o painel admin entrar.

-- ============================================================
-- 0001 — Core schema (multi-tenant)
-- Plataforma de Fidelização White-Label
-- Todas as tabelas de negócio carregam tenant_id (isolamento via RLS em 0002).
-- ============================================================

-- Helper genérico de updated_at (caso precise depois)
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tenant (empresa contratante)
-- ------------------------------------------------------------
create table public.tenants (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,            -- subdomínio
  custom_domain    text unique,                     -- domínio próprio
  segment_template text not null default 'generico',-- 'odonto' | 'academia' | 'barbearia' | 'restaurante' | 'generico'
  saas_plan        text not null default 'starter', -- 'starter' | 'pro' | 'premium'
  status           text not null default 'trial',   -- 'trial' | 'active' | 'suspended'
  created_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Configurações visuais e funcionais do tenant
-- ------------------------------------------------------------
create table public.tenant_settings (
  tenant_id                  uuid primary key references public.tenants(id) on delete cascade,
  -- Visual
  logo_url                   text,
  favicon_url                text,
  primary_color              text not null default '#2563eb',
  secondary_color            text not null default '#1e40af',
  theme_mode                 text not null default 'light',     -- 'dark' | 'light'
  -- Persona IA
  ai_name                    text not null default 'Assistente',
  ai_welcome_message         text,
  ai_tone                    text not null default 'amigavel',  -- 'formal' | 'casual' | 'amigavel'
  -- Nomenclatura (labels por segmento)
  label_client               text not null default 'Cliente',     -- 'Paciente' | 'Aluno' | 'Cliente'
  label_appointment          text not null default 'Agendamento',  -- 'Consulta' | 'Aula' | ...
  -- Rodapé
  footer_address             text,
  footer_phone               text,
  footer_whatsapp            text,
  footer_website             text,
  -- Módulos ativos
  modules_enabled            jsonb not null default '{}'::jsonb,
  -- Fidelidade
  loyalty_goal               int not null default 6,
  loyalty_frequency          text not null default 'monthly',   -- 'monthly' | 'weekly' | 'per_visit'
  loyalty_points_per_checkin int not null default 1,
  loyalty_streak_reset       boolean not null default false,
  -- Recompensa principal
  reward_name                text,
  reward_description         text
);

-- ------------------------------------------------------------
-- Usuários (clientes finais + staff + admins)
-- id = mesmo id do Supabase Auth (auth.users)
-- ------------------------------------------------------------
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  role       text not null default 'client',  -- 'client' | 'staff' | 'tenant_admin' | 'super_admin'
  full_name  text,
  email      text,
  created_at timestamptz not null default now()
);
create index users_tenant_id_idx on public.users(tenant_id);

-- ------------------------------------------------------------
-- Planos/assinaturas vendidos pelo negócio (vitrine)
-- ------------------------------------------------------------
create table public.business_plans (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  name                text not null,
  price_month         numeric(10,2) not null default 0,
  benefits            text[] not null default '{}',
  is_popular          boolean not null default false,
  upgrade_discount_pct int not null default 0,
  display_order       int not null default 0
);
create index business_plans_tenant_id_idx on public.business_plans(tenant_id);

-- ------------------------------------------------------------
-- Membership do cliente final
-- ------------------------------------------------------------
create table public.memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  plan_id     uuid references public.business_plans(id) on delete set null,
  modality    text not null default 'titular',  -- 'titular' | 'dependente'
  titular_id  uuid references public.memberships(id) on delete set null,
  status      text not null default 'active',   -- 'active' | 'expired' | 'suspended'
  member_code text not null unique,             -- código da carteirinha
  valid_until date,
  points_total int not null default 0,
  created_at  timestamptz not null default now()
);
create index memberships_tenant_id_idx on public.memberships(tenant_id);
create index memberships_user_id_idx on public.memberships(user_id);

-- ------------------------------------------------------------
-- Missões de engajamento
-- ------------------------------------------------------------
create table public.missions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  title               text not null,
  description         text,
  icon                text,
  type                text not null default 'custom', -- 'social_follow' | 'review' | 'referral' | 'checkin' | 'custom'
  external_url        text,
  points              int not null default 0,
  requires_validation boolean not null default false,
  is_active           boolean not null default true,
  display_order       int not null default 0
);
create index missions_tenant_id_idx on public.missions(tenant_id);

-- ------------------------------------------------------------
-- Conclusão de missões pelo cliente
-- ------------------------------------------------------------
create table public.mission_completions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  mission_id   uuid not null references public.missions(id) on delete cascade,
  status       text not null default 'completed', -- 'pending_validation' | 'completed'
  completed_at timestamptz,
  validated_by uuid references public.users(id) on delete set null
);
create index mission_completions_tenant_id_idx on public.mission_completions(tenant_id);
create index mission_completions_user_id_idx on public.mission_completions(user_id);

-- ------------------------------------------------------------
-- Check-ins de fidelidade
-- ------------------------------------------------------------
create table public.checkins (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  period_ref    text not null,                  -- '2026-06' (mensal) | '2026-W24' (semanal)
  points_earned int not null default 0,
  method        text not null default 'qr_code',-- 'qr_code' | 'staff' | 'self'
  validated_by  uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  -- Regra de negócio: um check-in por período por usuário
  unique (tenant_id, user_id, period_ref)
);
create index checkins_tenant_id_idx on public.checkins(tenant_id);
create index checkins_user_id_idx on public.checkins(user_id);

-- ------------------------------------------------------------
-- Resgates de recompensa
-- ------------------------------------------------------------
create table public.reward_redemptions (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  reward_name  text not null,
  status       text not null default 'pending', -- 'pending' | 'redeemed'
  redeemed_at  timestamptz,
  redeemed_by  uuid references public.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index reward_redemptions_tenant_id_idx on public.reward_redemptions(tenant_id);
create index reward_redemptions_user_id_idx on public.reward_redemptions(user_id);

-- ------------------------------------------------------------
-- Chat com IA
-- ------------------------------------------------------------
create table public.chat_conversations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index chat_conversations_tenant_id_idx on public.chat_conversations(tenant_id);
create index chat_conversations_user_id_idx on public.chat_conversations(user_id);

create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  role            text not null,  -- 'user' | 'assistant'
  content         text not null,
  created_at      timestamptz not null default now()
);
create index chat_messages_conversation_id_idx on public.chat_messages(conversation_id);
create index chat_messages_tenant_id_idx on public.chat_messages(tenant_id);

-- ------------------------------------------------------------
-- Campos customizados do perfil (por tenant)
-- ------------------------------------------------------------
create table public.profile_fields (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  label         text not null,
  field_key     text not null,
  field_type    text not null default 'text', -- 'text' | 'date' | 'select' | 'textarea'
  options       jsonb,                         -- para select
  required      boolean not null default false,
  display_order int not null default 0,
  unique (tenant_id, field_key)
);
create index profile_fields_tenant_id_idx on public.profile_fields(tenant_id);

create table public.profile_field_values (
  id        uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  field_id  uuid not null references public.profile_fields(id) on delete cascade,
  value     text,
  unique (field_id, user_id)
);
create index profile_field_values_tenant_id_idx on public.profile_field_values(tenant_id);
create index profile_field_values_user_id_idx on public.profile_field_values(user_id);

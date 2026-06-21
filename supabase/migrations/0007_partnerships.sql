-- ============================================================
-- 0007 — Parcerias & Convênios
-- ============================================================

create table public.partnerships (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  description   text,
  logo_url      text,
  discount_text text,
  website_url   text,
  is_active     boolean not null default true,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

create index partnerships_tenant_id_idx on public.partnerships(tenant_id);

-- RLS: qualquer usuário do mesmo tenant pode ler parcerias ativas.
alter table public.partnerships enable row level security;

create policy "partnerships: tenant members can read active"
  on public.partnerships for select
  using (
    is_active = true
    and tenant_id = public.auth_tenant_id()
  );

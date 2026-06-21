-- ============================================================
-- Loja de Resgate: catálogo de recompensas por tenant. O cliente acumula
-- pontos (missões + check-ins) e troca por itens desta loja. A redenção passa
-- a referenciar o item e registrar quantos pontos foram gastos.
-- ============================================================
create table public.rewards (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  description   text,
  points_cost   int not null default 0,
  image_url     text,
  stock         int,                              -- null = ilimitado
  is_active     boolean not null default true,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.rewards enable row level security;

-- Catálogo legível por qualquer usuário autenticado do mesmo tenant.
create policy "rewards_tenant_read" on public.rewards
  for select using (tenant_id = public.auth_tenant_id());

-- Vincula a redenção ao item do catálogo e guarda os pontos gastos.
alter table public.reward_redemptions
  add column reward_id    uuid references public.rewards(id) on delete set null,
  add column points_spent int not null default 0;

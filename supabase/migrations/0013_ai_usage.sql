-- Rastreio de tokens de IA por tenant por mês.
create table public.tenant_ai_usage (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  year_month  text not null,            -- 'YYYY-MM'
  tokens_used bigint not null default 0,
  unique(tenant_id, year_month)
);

alter table public.tenant_ai_usage enable row level security;

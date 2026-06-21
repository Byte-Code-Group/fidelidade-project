-- ============================================================
-- 0010 — Planos de acompanhamento (Tratamentos)
-- ============================================================

create table public.care_plans (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'active', -- active | completed | paused
  started_at  timestamptz not null default now(),
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);

create index care_plans_tenant_id_idx on public.care_plans(tenant_id);
create index care_plans_user_id_idx on public.care_plans(user_id);

create table public.care_plan_steps (
  id            uuid primary key default gen_random_uuid(),
  care_plan_id  uuid not null references public.care_plans(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  title         text not null,
  notes         text,
  done          boolean not null default false,
  done_at       timestamptz,
  display_order int not null default 0
);

create index care_plan_steps_plan_id_idx on public.care_plan_steps(care_plan_id);

-- RLS: clientes veem seus próprios planos e etapas.
alter table public.care_plans enable row level security;
alter table public.care_plan_steps enable row level security;

create policy "care_plans: user sees own"
  on public.care_plans for select
  using (user_id = auth.uid() and tenant_id = public.auth_tenant_id());

create policy "care_plan_steps: user sees own plan steps"
  on public.care_plan_steps for select
  using (
    tenant_id = public.auth_tenant_id()
    and exists (
      select 1 from public.care_plans cp
      where cp.id = care_plan_id and cp.user_id = auth.uid()
    )
  );

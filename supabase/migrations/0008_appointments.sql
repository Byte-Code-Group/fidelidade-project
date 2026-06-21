-- ============================================================
-- 0008 — Agendamentos
-- ============================================================

create table public.appointments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  title         text not null,
  scheduled_at  timestamptz not null,
  notes         text,
  status        text not null default 'scheduled', -- scheduled | completed | cancelled
  created_by    uuid references public.users(id),
  created_at    timestamptz not null default now()
);

create index appointments_tenant_id_idx on public.appointments(tenant_id);
create index appointments_user_id_idx on public.appointments(user_id);
create index appointments_scheduled_at_idx on public.appointments(scheduled_at);

alter table public.appointments enable row level security;

-- Clientes veem somente os próprios agendamentos.
create policy "appointments: user sees own"
  on public.appointments for select
  using (user_id = auth.uid() and tenant_id = public.auth_tenant_id());

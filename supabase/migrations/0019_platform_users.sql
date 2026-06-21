-- Donos de tenants que se cadastraram via self-service
create table if not exists public.platform_users (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_users enable row level security;

-- Cada usuário lê/escreve apenas o próprio registro
create policy "platform_users_self"
  on public.platform_users for all
  using (auth.uid() = user_id);

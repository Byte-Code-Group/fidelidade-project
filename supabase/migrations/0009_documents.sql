-- ============================================================
-- 0009 — Documentos do cliente
-- ============================================================

create table public.documents (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  category    text not null default 'documentos', -- documentos | termos | receituarios
  title       text not null,
  file_url    text not null,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);

create index documents_tenant_id_idx on public.documents(tenant_id);
create index documents_user_id_idx on public.documents(user_id);

alter table public.documents enable row level security;

-- Clientes veem somente os próprios documentos.
create policy "documents: user sees own"
  on public.documents for select
  using (user_id = auth.uid() and tenant_id = public.auth_tenant_id());

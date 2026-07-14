-- ============================================================
-- 0028 — Modelos de documento pra IA gerar (contrato, atestado, termo...)
-- ============================================================

create table public.document_templates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  content       text not null,
  display_order int not null default 0,
  created_at    timestamptz not null default now()
);

create index document_templates_tenant_id_idx on public.document_templates(tenant_id);

alter table public.document_templates enable row level security;

create policy "document_templates_tenant_read" on public.document_templates
  for select using (tenant_id = public.auth_tenant_id());

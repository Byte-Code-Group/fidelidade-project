-- Leads do formulário de interesse da landing page.
create table public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  business    text not null,
  segment     text not null,
  phone       text,
  created_at  timestamptz not null default now()
);

-- Apenas service_role pode ler/escrever (sem RLS por tenant — tabela global).
alter table public.leads enable row level security;

-- ============================================================
-- 0035 — Conta Asaas do próprio negócio (recebimento das assinaturas)
--
-- Até aqui o Asaas era só da plataforma pro dono do negócio (0015): uma
-- ASAAS_API_KEY única no env cobrando a mensalidade de cada tenant. Os planos
-- que o tenant vende aos clientes dele (business_plans) não cobravam nada —
-- "assinar" só gravava memberships.plan_id.
--
-- Agora cada negócio conecta a PRÓPRIA conta Asaas e o dinheiro do cliente
-- final cai direto lá; a plataforma não intermedeia.
--
-- A credencial NÃO pode ficar em public.tenants: essa tabela tem
-- "tenants_public_read" (branding é público). Vai em tabela própria, com RLS
-- ligada e nenhuma policy — só a service role enxerga.
-- ============================================================

create table public.tenant_payment_accounts (
  tenant_id      uuid primary key references public.tenants(id) on delete cascade,
  provider       text not null default 'asaas',
  -- Chave cifrada em AES-256-GCM (ver lib/crypto.ts). Nunca em texto puro.
  api_key_enc    text not null,
  environment    text not null default 'production'
                   check (environment in ('sandbox', 'production')),
  -- Nome/e-mail da conta Asaas, só pra mostrar "conectado como…" no painel.
  account_name   text,
  account_email  text,
  -- Identifica o webhook que criamos lá e valida o que chega de volta.
  webhook_id     text,
  webhook_token  text,
  connected_at   timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.tenant_payment_accounts enable row level security;
-- Sem policy de propósito: leitura/escrita só via service role (painel do dono
-- e webhook), nunca direto do browser.

-- ------------------------------------------------------------
-- Assinatura do CLIENTE FINAL no Asaas do negócio.
-- memberships já é a carteirinha dele; aqui entra o vínculo da cobrança.
-- ------------------------------------------------------------
alter table public.memberships
  add column if not exists asaas_customer_id     text,
  add column if not exists asaas_subscription_id text,
  -- pending = criada, esperando o primeiro pagamento; active = pago em dia;
  -- overdue = venceu; canceled = cancelada. Null = plano sem cobrança.
  add column if not exists subscription_status   text
    check (subscription_status in ('pending', 'active', 'overdue', 'canceled')),
  add column if not exists subscription_updated_at timestamptz;

create index if not exists memberships_asaas_subscription_idx
  on public.memberships(asaas_subscription_id)
  where asaas_subscription_id is not null;

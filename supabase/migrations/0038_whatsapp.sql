-- ============================================================
-- 0038 — WhatsApp Cloud API + campanhas
--
-- Cada negócio conecta o PRÓPRIO número no WhatsApp Cloud API (Meta) e dispara
-- campanhas pros clientes dele. A plataforma não intermedeia: guarda o token
-- cifrado e chama a API em nome do negócio — mesmo desenho do Asaas (0035).
--
-- Custo: template de marketing é COBRADO por mensagem pela Meta, na conta do
-- próprio negócio. Template utility dentro da janela de 24h (cliente falou com
-- o número há menos de 24h) sai de graça. Por isso guardamos
-- users.wa_last_inbound_at: é o que diz quem está na janela livre.
-- ============================================================

-- ------------------------------------------------------------
-- Telefone e consentimento do cliente final
-- ------------------------------------------------------------
alter table public.users
  -- E.164 sem "+", como a Meta exige no envio (ex: 5531999998888).
  add column if not exists phone                text,
  -- Descadastro: chegou "SAIR"/"PARAR" no WhatsApp, ou o dono marcou na mão.
  -- Nenhuma campanha inclui quem está aqui — é opt-out permanente.
  add column if not exists whatsapp_opt_out     boolean not null default false,
  -- Última mensagem RECEBIDA desse cliente. Define a janela de 24h.
  add column if not exists wa_last_inbound_at   timestamptz;

create index if not exists users_tenant_phone_idx
  on public.users(tenant_id, phone)
  where phone is not null;

-- ------------------------------------------------------------
-- Conexão do número do negócio com o WhatsApp Cloud API
--
-- Igual a tenant_payment_accounts: RLS ligada e NENHUMA policy. Só a service
-- role enxerga — o token nunca pode vazar pro browser.
-- ------------------------------------------------------------
create table public.tenant_whatsapp_accounts (
  tenant_id          uuid primary key references public.tenants(id) on delete cascade,
  -- Token permanente do System User da Meta, cifrado em AES-256-GCM
  -- (lib/crypto.ts). Nunca em texto puro.
  access_token_enc   text not null,
  -- Ids da Meta: o número que envia e a conta comercial que tem os templates.
  phone_number_id    text not null,
  waba_id            text not null,
  -- Só pra mostrar "conectado como…" no painel.
  display_phone      text,
  verified_name      text,
  -- Segredo que a Meta devolve em cada chamada do webhook desse negócio.
  verify_token       text not null,
  -- Versão da Graph API usada nas chamadas — fixada por conexão pra uma
  -- depreciação da Meta não derrubar todos os negócios de uma vez.
  api_version        text not null default 'v22.0',
  connected_at       timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.tenant_whatsapp_accounts enable row level security;
-- Sem policy de propósito.

-- ------------------------------------------------------------
-- Campanhas
-- ------------------------------------------------------------
create table public.whatsapp_campaigns (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  name              text not null,
  -- Template aprovado na Meta. Fora da janela de 24h só dá pra enviar template.
  template_name     text not null,
  template_language text not null default 'pt_BR',
  -- 'MARKETING' (cobrado sempre) | 'UTILITY' (grátis na janela de 24h)
  -- | 'AUTHENTICATION'. Vem da própria Meta junto com o template.
  template_category text not null default 'MARKETING',
  -- Corpo do template com {{1}}, {{2}}… — só pra pré-visualizar no painel.
  template_body     text,
  -- Origem de cada variável do corpo, em ordem: [{"source":"first_name"},
  -- {"source":"literal","value":"20%"}]. Ver lib/campaigns.ts.
  variables         jsonb not null default '[]'::jsonb,
  -- Filtros do público (status, plano, faixa de pontos, dias parado).
  audience          jsonb not null default '{}'::jsonb,
  -- draft = rascunho; sending = fila montada, disparo em andamento;
  -- sent = fila toda processada; canceled = interrompida pelo dono.
  status            text not null default 'draft'
                      check (status in ('draft', 'sending', 'sent', 'canceled')),
  created_at        timestamptz not null default now(),
  started_at        timestamptz,
  finished_at       timestamptz
);
create index whatsapp_campaigns_tenant_id_idx
  on public.whatsapp_campaigns(tenant_id, created_at desc);

-- ------------------------------------------------------------
-- Uma linha por destinatário. É a fila do disparo e o histórico de entrega.
-- ------------------------------------------------------------
create table public.whatsapp_messages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  campaign_id   uuid not null references public.whatsapp_campaigns(id) on delete cascade,
  user_id       uuid references public.users(id) on delete set null,
  phone         text not null,
  -- queued = na fila; sent/delivered/read = confirmado pela Meta via webhook;
  -- failed = a Meta recusou (motivo em error).
  status        text not null default 'queued'
                  check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  -- Id da mensagem na Meta (wamid…) — é por ele que o webhook casa o status.
  wa_message_id text,
  error         text,
  -- true = cliente estava na janela de 24h no momento do envio; com template
  -- utility isso significa mensagem sem custo.
  free_window   boolean not null default false,
  sent_at       timestamptz,
  updated_at    timestamptz not null default now()
);

-- O mesmo cliente não entra duas vezes na mesma campanha (garante que um
-- reenvio da fila não cobre a Meta de novo pelo mesmo destinatário).
create unique index whatsapp_messages_campaign_phone_key
  on public.whatsapp_messages(campaign_id, phone);
create index whatsapp_messages_tenant_id_idx on public.whatsapp_messages(tenant_id);
create index whatsapp_messages_wa_id_idx
  on public.whatsapp_messages(wa_message_id)
  where wa_message_id is not null;
-- Usado pelo disparo em lotes: pega as próximas N da fila.
create index whatsapp_messages_fila_idx
  on public.whatsapp_messages(campaign_id, status);

alter table public.whatsapp_campaigns enable row level security;
alter table public.whatsapp_messages enable row level security;
-- Sem policy: painel do dono e webhook falam via service role.

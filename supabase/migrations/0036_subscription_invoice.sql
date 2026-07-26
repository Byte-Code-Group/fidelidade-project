-- ============================================================
-- 0036 — Fatura pendente do cliente e aviso de callback bloqueado
--
-- Sem guardar a fatura, cada clique em "Assinar" criava OUTRA assinatura no
-- Asaas e mandava o cliente pra uma cobrança nova — quem pagava voltava pro
-- portal e via "Assinar" de novo, em loop.
--
-- callback_bloqueado registra o que o Asaas respondeu de verdade: a conta do
-- negócio não tem site cadastrado, então ele recusa o successUrl e o cliente
-- não é redirecionado de volta depois de pagar (ver lib/member-subscriptions).
-- ============================================================

alter table public.memberships
  add column if not exists asaas_invoice_url text;

alter table public.tenant_payment_accounts
  add column if not exists callback_bloqueado boolean not null default false;

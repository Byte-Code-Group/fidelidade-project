-- Downgrade não derruba o plano na hora: fica agendado pro fim do período já
-- pago (próx. vencimento no Asaas). pending_keep_tenant_ids guarda a escolha
-- de quais negócios continuam ativos, caso o downgrade reduza o limite.
alter table public.tenants
  add column pending_plan text,
  add column pending_plan_effective_at timestamptz,
  add column pending_keep_tenant_ids uuid[];

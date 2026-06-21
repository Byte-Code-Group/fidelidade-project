-- Integração Asaas: IDs de cliente e assinatura por tenant.
alter table public.tenants
  add column if not exists asaas_customer_id    text,
  add column if not exists asaas_subscription_id text;

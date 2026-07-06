-- Remove o conceito de trial gratuito: produto passa a ser só pago.
-- Tenants que ainda estivessem em "trial" (default antigo da coluna, nunca
-- de fato bloqueado por falta de trial_ends_at) viram "active" — já usavam
-- o produto, não faz sentido cobrar retroativamente nem bloquear.
update public.tenants set status = 'active' where status = 'trial';

alter table public.tenants alter column status set default 'pending';

-- Estilo Netflix/Spotify pra troca de plano do cliente final: upgrade vale
-- na hora, downgrade fica agendado pro fim do período vigente
-- (memberships.valid_until). Sem cobrança automática nenhuma envolvida.
alter table public.memberships
  add column pending_plan_id uuid references public.business_plans(id) on delete set null,
  add column pending_plan_effective_at date;

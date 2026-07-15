-- ============================================================
-- Instruções extras de comportamento da IA, definidas pelo dono do
-- tenant e injetadas no system prompt (app/api/chat/route.ts) por
-- cima das regras imutáveis (GUARDRAILS), nunca por baixo delas.
-- ============================================================
alter table public.tenant_settings
  add column ai_behavior text;

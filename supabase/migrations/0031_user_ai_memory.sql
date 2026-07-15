-- ============================================================
-- Memória da IA por cliente — persiste entre conversas (cada "Nova
-- Conversa" começa um chat_conversations novo, mas a memória segue).
-- Uma linha por (tenant, usuário); a IA reescreve o conteúdo inteiro
-- via tool quando aprende algo relevante (lib/ai/tools.ts: remember_about_user).
-- ============================================================
create table public.user_ai_memory (
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  content    text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

alter table public.user_ai_memory enable row level security;

create policy "user_ai_memory: user sees own"
  on public.user_ai_memory for select
  using (user_id = auth.uid() and tenant_id = public.auth_tenant_id());

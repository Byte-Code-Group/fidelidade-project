-- ============================================================
-- 0032 — Isolamento do Storage por tenant (e por cliente, nos arquivos
-- pessoais) + documentos gerados pela IA.
--
-- Convenção de path, agora válida para TODOS os buckets:
--
--   branding/{tenant_id}/logo-*.ext              público  (carrega pré-login)
--   rewards/{tenant_id}/*.ext                    público  (vitrine da loja)
--   document-templates/{tenant_id}/*.ext         PRIVADO  (modelo do negócio)
--   documents/{tenant_id}/{user_id}/*.ext        PRIVADO  (arquivo do cliente)
--
-- O primeiro segmento do path é SEMPRE o tenant_id; nos documentos pessoais o
-- segundo é SEMPRE o user_id. As policies abaixo passam a impor isso no banco,
-- em vez de depender só do código montar o path certo.
-- ============================================================

-- ---------- 1. document-templates deixa de ser público ----------
-- Modelos de contrato/atestado são documento interno do negócio: estavam
-- legíveis por qualquer um que soubesse (ou adivinhasse) a URL.

update storage.buckets set public = false where id = 'document-templates';

drop policy if exists "document_templates_public_read" on storage.objects;

-- Os file_url gravados até aqui são URLs públicas completas
-- (".../object/public/document-templates/{path}"). Sem bucket público essas
-- URLs param de resolver, então converte para path relativo — que é o formato
-- que o código passa a usar para gerar signed URL.
update public.document_templates
set file_url = regexp_replace(
      file_url,
      '^.*/storage/v1/object/public/document-templates/',
      ''
    )
where file_url like '%/storage/v1/object/public/document-templates/%';

-- ---------- 2. Origem do documento (upload manual x gerado pela IA) ----------
-- O documento da IA vai direto pro cliente, mas o negócio precisa conseguir
-- distinguir o que foi escrito por uma pessoa do que foi gerado pelo
-- assistente — inclusive para auditar depois.

alter table public.documents
  add column if not exists source text not null default 'upload'
    check (source in ('upload', 'ia'));

comment on column public.documents.source is
  'upload = enviado por uma pessoa do negócio; ia = gerado pelo assistente.';

-- ---------- 3. RLS no storage.objects ----------
-- Hoje todo acesso passa por service role (que ignora RLS), então isto é
-- defesa em profundidade: se algum path vazar ou uma consulta passar a usar o
-- client anon/autenticado, o banco ainda barra o acesso cross-tenant.

-- Helper: primeiro segmento do path = tenant_id do objeto.
create or replace function public.storage_object_tenant(name text)
returns uuid
language sql
immutable
as $$
  select nullif((storage.foldername(name))[1], '')::uuid;
$$;

-- Helper: segundo segmento do path = user_id dono do objeto (só documentos).
create or replace function public.storage_object_user(name text)
returns uuid
language sql
immutable
as $$
  select nullif((storage.foldername(name))[2], '')::uuid;
$$;

-- documents: o cliente autenticado só enxerga o que está sob a pasta
-- {seu tenant}/{ele mesmo}/.
drop policy if exists "documents_own_read" on storage.objects;
create policy "documents_own_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.storage_object_tenant(name) = public.auth_tenant_id()
    and public.storage_object_user(name) = auth.uid()
  );

-- document-templates: sem policy de leitura para usuário comum. O dono do
-- negócio acessa pelo painel, que gera signed URL via service role.

-- branding e rewards seguem públicos (a policy de leitura já existe nas
-- migrations 0005 e 0023) — são assets de marca, exibidos antes do login.

-- Nenhum bucket recebe policy de INSERT/UPDATE/DELETE: toda escrita continua
-- server-side via service role, depois de checar a autorização na action.

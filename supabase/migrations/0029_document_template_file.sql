-- ============================================================
-- Modelo de documento por upload de arquivo (PDF/DOCX) — o texto é extraído
-- e vira o "content" que a IA usa; o arquivo original fica guardado pro
-- dono conferir/baixar depois.
-- ============================================================
alter table public.document_templates
  add column file_url  text,
  add column file_name text;

insert into storage.buckets (id, name, public)
values ('document-templates', 'document-templates', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'document_templates_public_read'
  ) then
    create policy "document_templates_public_read" on storage.objects
      for select using (bucket_id = 'document-templates');
  end if;
end $$;

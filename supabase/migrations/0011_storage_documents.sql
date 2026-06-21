-- ============================================================
-- Bucket privado para documentos dos clientes (receituários, termos, etc.).
-- Upload via service role (admin). Leitura via signed URL gerada server-side.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

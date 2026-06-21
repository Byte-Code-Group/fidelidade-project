-- ============================================================
-- Bucket de branding (logos das empresas). Público para leitura — a URL do logo
-- precisa carregar no portal antes do login, igual ao restante do branding.
-- Upload é feito server-side via service role (bypassa RLS), então não há
-- policy de escrita para usuários comuns.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do nothing;

-- Leitura pública dos objetos do bucket (defensivo; bucket público já serve via
-- endpoint público, mas deixa explícito para clientes autenticados também).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'branding_public_read'
  ) then
    create policy "branding_public_read" on storage.objects
      for select using (bucket_id = 'branding');
  end if;
end $$;

-- ============================================================
-- Bucket de imagens de prêmios da Loja. Público para leitura — a imagem
-- precisa carregar na Loja de Resgate do portal do cliente.
-- Upload é feito server-side via service role (bypassa RLS), então não há
-- policy de escrita para usuários comuns.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('rewards', 'rewards', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'rewards_public_read'
  ) then
    create policy "rewards_public_read" on storage.objects
      for select using (bucket_id = 'rewards');
  end if;
end $$;

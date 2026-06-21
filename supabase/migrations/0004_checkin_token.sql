-- ============================================================
-- Token de check-in por tenant. O QR Code do tenant codifica a URL
--   https://{slug}.{dominio}/checkin?token={checkin_token}
-- Só quem escaneia o QR físico (presente no local) consegue o token,
-- evitando check-in remoto. Rotaciona trocando o valor.
-- ============================================================
alter table public.tenants
  add column checkin_token uuid not null default gen_random_uuid();

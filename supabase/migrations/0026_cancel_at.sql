-- Cancelamento estilo Netflix/Spotify: cancela a cobrança na hora, mas o
-- acesso continua valendo até o fim do período já pago (cancel_at).
alter table public.tenants
  add column cancel_at timestamptz;

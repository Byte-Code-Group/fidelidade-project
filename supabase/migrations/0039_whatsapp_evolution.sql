-- ============================================================
-- 0039 — Segundo caminho de conexão do WhatsApp: Evolution API
--
-- Até aqui só existia o Cloud API da Meta (0038), que exige do dono do negócio
-- app na Meta, CNPJ verificado e template aprovado — barreira que a maioria dos
-- clientes não vence sozinha.
--
-- O Evolution API conecta por QR code, igual WhatsApp Web: o número continua
-- funcionando no celular e a mensagem é texto livre, sem template. Em troca,
-- é engenharia reversa e viola os Termos do WhatsApp — o número pode ser
-- banido. Por isso os dois convivem: o negócio escolhe o que aceita.
--
-- Desenho: 'provider' diz de onde a conexão veio, e as colunas específicas de
-- cada lado viram opcionais. O resto do fluxo (público, fila, status, webhook)
-- é o mesmo para os dois.
-- ============================================================

-- ------------------------------------------------------------
-- Conexão
-- ------------------------------------------------------------
alter table public.tenant_whatsapp_accounts
  add column if not exists provider text not null default 'meta'
    check (provider in ('meta', 'evolution')),
  -- Nome da instância no servidor Evolution. É o próprio tenant_id: mantém o
  -- isolamento entre negócios sem precisar de um mapa à parte.
  add column if not exists instance_name text;

-- Meta exige os três; Evolution não tem nenhum deles. Sem afrouxar isso, uma
-- conexão por QR code não caberia na tabela.
alter table public.tenant_whatsapp_accounts
  alter column access_token_enc drop not null,
  alter column phone_number_id  drop not null,
  alter column waba_id          drop not null;

-- Uma conexão Evolution sem instância não envia nada; uma conexão Meta sem os
-- ids da conta também não. Melhor barrar no banco do que descobrir no disparo.
alter table public.tenant_whatsapp_accounts
  drop constraint if exists tenant_whatsapp_accounts_provider_campos_check;
alter table public.tenant_whatsapp_accounts
  add constraint tenant_whatsapp_accounts_provider_campos_check check (
    (provider = 'meta'
      and access_token_enc is not null
      and phone_number_id is not null
      and waba_id is not null)
    or
    (provider = 'evolution' and instance_name is not null)
  );

-- ------------------------------------------------------------
-- Campanhas
-- ------------------------------------------------------------
-- A campanha guarda com que provedor ela foi criada. Trocar a conexão do
-- negócio depois não pode reescrever o que já saiu, nem deixar uma campanha
-- de texto livre tentar virar template.
alter table public.whatsapp_campaigns
  add column if not exists provider text not null default 'meta'
    check (provider in ('meta', 'evolution'));

-- Campanha do Evolution não tem template: o texto vive em template_body, que
-- já existe, e template_name fica vazio.
alter table public.whatsapp_campaigns
  alter column template_name drop not null;

alter table public.whatsapp_campaigns
  drop constraint if exists whatsapp_campaigns_provider_campos_check;
alter table public.whatsapp_campaigns
  add constraint whatsapp_campaigns_provider_campos_check check (
    (provider = 'meta' and template_name is not null)
    or
    (provider = 'evolution' and template_body is not null and template_body <> '')
  );

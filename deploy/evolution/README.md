# Evolution API na VM da Oracle (ARM)

Runbook do servidor que atende a conexão de WhatsApp por QR code do painel.
Escrito para **Oracle Cloud Always Free, shape Ampere A1 (aarch64)**.

> **Aviso.** O Evolution conversa com o WhatsApp por engenharia reversa do
> WhatsApp Web. Isso viola os Termos de Serviço do WhatsApp: o número conectado
> pode ser banido sem aviso e sem recurso, e o risco cresce com volume de
> disparo e com denúncia de destinatário. O caminho oficial (Meta Cloud API)
> continua disponível no mesmo painel.

Todas as imagens usadas — Evolution `v2.3.7`, Postgres 15, Redis 7 e Caddy 2 —
publicam `linux/arm64`. O Docker escolhe a arquitetura sozinho; não existe
nenhum passo específico de ARM no compose.

---

## 1. Criar a VM

Console da Oracle → **Compute → Instances → Create instance**.

| Campo | Valor |
| --- | --- |
| Image | Canonical **Ubuntu 24.04** (variante **aarch64**) |
| Shape | **VM.Standard.A1.Flex** |
| OCPUs / memória | 2 OCPU / 12 GB (cabe no Always Free; o teto é 4 OCPU e 24 GB somando todas as A1) |
| Boot volume | 50 GB |
| SSH | adicione sua chave pública |

Anote o **IP público** ao final.

> **"Out of host capacity"** é o erro mais comum ao criar A1 — significa que a
> região está sem estoque de Ampere, não que você fez algo errado. Tente outro
> Availability Domain, tente em horários diferentes, ou mude a conta para *Pay
> As You Go* (a cota Always Free continua gratuita, mas a fila de capacidade
> passa a ser priorizada).

Conecte e confirme a arquitetura:

```bash
ssh ubuntu@SEU-IP
uname -m        # aarch64
```

## 2. Liberar as portas — em DOIS lugares

Tropeço clássico da Oracle: abrir no console não basta, a imagem Ubuntu vem com
o iptables fechado por dentro.

**a) Security List** (console): VCN → Subnet → Security List → *Add Ingress Rules*

- Source `0.0.0.0/0`, IP Protocol TCP, Destination Port **80**
- Source `0.0.0.0/0`, IP Protocol TCP, Destination Port **443**

**b) iptables da VM:**

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

Se `netfilter-persistent` não existir: `sudo apt install -y iptables-persistent`.

## 3. Instalar Docker

O script oficial detecta aarch64 sozinho.

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
docker --version
```

## 4. Copiar os arquivos

Da sua máquina, do diretório do projeto:

```bash
scp deploy/evolution/{docker-compose.yml,Caddyfile,.env.example} ubuntu@SEU-IP:~/evolution/
```

(Crie a pasta antes: `ssh ubuntu@SEU-IP 'mkdir -p ~/evolution'`.)

## 5. Configurar

Na VM:

```bash
cd ~/evolution
cp .env.example .env
openssl rand -hex 32   # AUTHENTICATION_API_KEY
openssl rand -hex 24   # POSTGRES_PASSWORD
```

Edite o `.env` e troque:

- `EVOLUTION_DOMAIN` e `SERVER_URL` → o IP com pontos + `.nip.io`
  (ex.: IP `129.153.10.20` vira `129.153.10.20.nip.io`). O `nip.io` resolve
  qualquer IP sem registrar domínio, e é o que permite ter HTTPS de verdade.
- `AUTHENTICATION_API_KEY` → a primeira chave gerada.
- `POSTGRES_PASSWORD` **e a mesma senha dentro de `DATABASE_CONNECTION_URI`** →
  a segunda chave. Esquecer de trocar nos dois lugares é o erro mais comum, e
  aparece como a API reiniciando em loop com erro de autenticação do Postgres.

## 6. Subir

```bash
docker compose up -d
docker compose ps
docker compose logs -f api
```

O primeiro start roda as migrations do Prisma e demora mais. Espere a linha
indicando que o servidor está ouvindo na porta 8080.

## 7. Conferir

```bash
curl https://SEU-IP.nip.io/
```

Deve responder com a versão da API, já em HTTPS válido.

- **Erro de certificado / conexão recusada**: o Caddy não conseguiu emitir o
  certificado. Quase sempre é a porta 80 fechada (passo 2b) — o Let's Encrypt
  valida por HTTP antes de liberar o HTTPS. Veja `docker compose logs caddy`.
- **Timeout**: falta a regra na Security List (passo 2a).

Teste autenticado:

```bash
curl -H "apikey: SUA_CHAVE" https://SEU-IP.nip.io/instance/fetchInstances
```

Deve devolver `[]` — nenhuma instância ainda, que é o esperado.

## 8. Ligar no painel

Duas variáveis em produção. Enquanto não existirem, o painel só oferece a
conexão oficial da Meta e a opção de QR code nem aparece.

```bash
vercel env add EVOLUTION_API_URL production   # https://SEU-IP.nip.io
vercel env add EVOLUTION_API_KEY production   # a AUTHENTICATION_API_KEY da VM
```

Rode também a migration `supabase/migrations/0039_whatsapp_evolution.sql` no
Supabase de produção **antes** do deploy — sem a coluna `provider` a leitura da
conta quebra.

Depois disso, no painel: **Campanhas → Conectar por QR code**.

## 9. Endpoints que o painel usa

Todos com header `apikey: <AUTHENTICATION_API_KEY>`. Só o servidor da plataforma
chama — nada disso passa pelo browser.

| Ação | Chamada |
| --- | --- |
| Criar instância do negócio | `POST /instance/create` |
| Apontar o webhook | `POST /webhook/set/{instance}` |
| Pegar QR code | `GET /instance/connect/{instance}` |
| Ver se conectou | `GET /instance/connectionState/{instance}` |
| Número e perfil conectados | `GET /instance/fetchInstances` |
| Enviar mensagem | `POST /message/sendText/{instance}` |
| Encerrar sessão | `DELETE /instance/logout/{instance}` |
| Apagar instância | `DELETE /instance/delete/{instance}` |

O nome da instância é o próprio `tenant_id`, mantendo o mesmo isolamento por
negócio que a tabela `tenant_whatsapp_accounts` já faz.

---

## Manutenção

**Manager web.** Não é publicado de propósito: a interface expõe a apikey, que
dá controle de todas as sessões conectadas. Para usar, abra por túnel SSH:

```bash
ssh -L 8080:localhost:8080 ubuntu@SEU-IP
docker compose exec api true   # a API já escuta em 8080 dentro da rede
```

**Backup.** O que importa é o volume `evolution_instances` — são as sessões do
WhatsApp. Se ele sumir, todo cliente precisa ler o QR code de novo.

```bash
docker run --rm -v evolution_instances:/data -v $PWD:/backup alpine \
  tar czf /backup/instances-$(date +%F).tgz -C /data .
```

**Atualizar.** Troque o tag no `docker-compose.yml` (não use `latest`, ele
aponta pra release candidate) e:

```bash
docker compose pull && docker compose up -d
```

**IP mudou.** O `nip.io` embute o IP no nome, então trocar o IP público troca o
domínio: atualize `EVOLUTION_DOMAIN` e `SERVER_URL` no `.env`, suba de novo, e
troque `EVOLUTION_API_URL` na Vercel. Os webhooks das instâncias são
reapontados sozinhos na próxima conexão.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| QR code não aparece | Instância em estado inconsistente. `DELETE /instance/delete/{tenantId}` e conecte de novo |
| QR lido mas volta pra "desconectado" | Versão do WhatsApp Web defasada na imagem — atualize o tag do Evolution |
| Sessão cai sozinha depois de horas | Celular sem internet por muito tempo, ou o dono desconectou em *Dispositivos conectados* |
| Mensagens saem mas status nunca muda | Webhook não chega: confira se `NEXT_PUBLIC_SITE_URL` em produção é a URL pública real |
| API reiniciando em loop | Senha do Postgres diferente entre `POSTGRES_PASSWORD` e `DATABASE_CONNECTION_URI` |

# Evolution API na VM da Oracle

Passo a passo pra subir o serviço que substitui o WhatsApp Cloud API da Meta.

> **Aviso.** O Evolution conversa com o WhatsApp por engenharia reversa do
> WhatsApp Web. Isso viola os Termos de Serviço do WhatsApp e o número do
> cliente pode ser banido sem aviso e sem recurso — o risco cresce com volume
> de disparo e com denúncia de destinatário.

## 1. Criar a VM

Oracle Cloud → Compute → Instances → Create.

- **Shape**: `VM.Standard.A1.Flex` (ARM Ampere, free tier) com 2 OCPU / 12 GB,
  ou `VM.Standard.E2.1.Micro` (x86, 1 GB).
- **Imagem**: Ubuntu 24.04.
- Guarde a chave SSH e o **IP público**.

> A imagem do Evolution nem sempre publica ARM64. Se o container não subir no
> shape A1 com erro de plataforma, use o shape x86 — 1 GB de RAM aguenta uma
> dezena de instâncias, mas fica apertado com Postgres junto.

## 2. Liberar as portas — em DOIS lugares

Esse é o tropeço clássico da Oracle: abrir só no console não basta.

**a) Security List** (console): VCN → Subnet → Security List → Add Ingress Rule
- Source `0.0.0.0/0`, TCP, porta **80**
- Source `0.0.0.0/0`, TCP, porta **443**

**b) iptables da própria VM** (a imagem Ubuntu da Oracle vem fechada):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. Instalar Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER && newgrp docker
```

## 4. Subir

```bash
mkdir -p ~/evolution && cd ~/evolution
# copie docker-compose.yml, Caddyfile e .env.example para cá
cp .env.example .env
```

Edite o `.env`:

```bash
openssl rand -hex 32   # -> AUTHENTICATION_API_KEY
openssl rand -hex 24   # -> POSTGRES_PASSWORD (e dentro do DATABASE_CONNECTION_URI)
```

Troque `SEU-IP-PUBLICO` pelo IP da VM com pontos, ex. `129.153.10.20.nip.io`,
nas duas variáveis (`EVOLUTION_DOMAIN` e `SERVER_URL`).

```bash
docker compose up -d
docker compose logs -f api
```

## 5. Conferir

```bash
curl https://SEU-IP.nip.io/
```

Deve responder com a versão da API. Se o TLS falhar, o Caddy não conseguiu
emitir o certificado — quase sempre é a porta 80 fechada (passo 2b).

Teste autenticado:

```bash
curl -H "apikey: SUA_CHAVE" https://SEU-IP.nip.io/instance/fetchInstances
```

## 6. Ligar no painel

Duas variáveis em produção. Enquanto elas não existirem, o painel só oferece a
conexão oficial da Meta — a opção de QR code nem aparece.

```bash
vercel env add EVOLUTION_API_URL production   # https://SEU-IP.nip.io
vercel env add EVOLUTION_API_KEY production   # a AUTHENTICATION_API_KEY da VM
```

Rode também a migration `0039_whatsapp_evolution.sql` no Supabase antes do
primeiro deploy — sem ela a coluna `provider` não existe e conectar quebra.

## 7. Endpoints que o painel usa

Todos com header `apikey: <AUTHENTICATION_API_KEY>`.

| Ação | Chamada |
| --- | --- |
| Criar instância do tenant | `POST /instance/create` |
| Pegar QR code | `GET /instance/connect/{instance}` |
| Ver se conectou | `GET /instance/connectionState/{instance}` |
| Enviar mensagem | `POST /message/sendText/{instance}` |
| Desconectar | `DELETE /instance/logout/{instance}` |
| Apagar instância | `DELETE /instance/delete/{instance}` |

O nome da instância será o `tenant_id`, mantendo o isolamento que
`tenant_whatsapp_accounts` já faz hoje.

## Manutenção

- **Manager web**: não é publicado de propósito (expõe a apikey na tela). Pra
  usar, abre por túnel: `ssh -L 8080:localhost:8080 ubuntu@IP` e acessa
  `localhost:8080/manager`.
- **Backup**: o que importa é o volume `evolution_instances` (as sessões do
  WhatsApp). Perdeu, todo cliente refaz o QR code.
- **Atualizar**: `docker compose pull && docker compose up -d`.
- **QR não conecta / cai sozinho**: costuma ser versão do WhatsApp Web
  desatualizada na imagem. Atualize a imagem antes de investigar outra coisa.

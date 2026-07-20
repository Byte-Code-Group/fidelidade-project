# Fidelidade

Plataforma SaaS **multi-tenant white-label** de programas de fidelidade. Cada
negócio (tenant) ganha um portal próprio — com a sua marca, suas regras de
pontuação, sua loja de recompensas e um assistente de IA — sem precisar de
código.

Três públicos, três áreas:

| Área | Rota | Quem usa |
| --- | --- | --- |
| **Portal do cliente** | `/` no subdomínio do tenant | cliente final do negócio |
| **Painel do dono** | `/painel` | dono do negócio (tenant) |
| **Superadmin** | `/superadmin` | operação da plataforma |
| **Onboarding/billing** | `/conta` | cadastro, escolha de plano, pagamento |

## Stack

- **Next.js 16** (App Router, Server Components, Server Actions)
- **Supabase** — Postgres + Auth + Storage, com RLS por tenant
- **Tailwind CSS 4**
- **AI SDK** + Google Gemini (assistente do portal)
- **Asaas** — cobrança recorrente das assinaturas dos tenants
- **Resend** — e-mails transacionais
- **Vercel** — deploy e gestão de domínios customizados

## Como o multi-tenant funciona

O tenant da request é resolvido em `proxy.ts` (middleware), por três caminhos,
nesta ordem:

1. **Subdomínio** — `oraldents.meudominio.com` → slug `oraldents`
2. **Path** — `/p/oraldents/...` faz rewrite para `/...` e grava o slug num
   cookie httpOnly (usado em dev e em links diretos)
3. **Domínio customizado** — host que não bate com o `NEXT_PUBLIC_ROOT_DOMAIN`
   vira `@host`, resolvido por `tenants.custom_domain`

O slug resolvido é injetado no header `x-tenant-slug`, e `getCurrentTenant()`
(`lib/tenant.ts`) o converte em `{ tenant, settings }`, cacheado por request.
**Todo acesso a dado de tenant passa por aí.**

No apex (sem subdomínio) o portal cai na landing de marketing.

## Setup local

Pré-requisitos: Node 20+, pnpm, [Supabase CLI](https://supabase.com/docs/guides/cli), Docker.

```bash
pnpm install
supabase start          # sobe Postgres + Auth + Storage locais
pnpm db:reset           # aplica supabase/migrations/ + supabase/seed.sql
pnpm seed:superadmin    # cria o usuário de superadmin
pnpm seed:auth          # cria um tenant + cliente de exemplo
pnpm dev
```

Acesse por **`lvh.me`** (resolve para 127.0.0.1 e permite subdomínios):

- Landing: <http://lvh.me:3000>
- Portal do tenant: <http://oraldents.lvh.me:3000>
- Painel do dono: <http://lvh.me:3000/painel>
- Superadmin: <http://lvh.me:3000/superadmin>

## Variáveis de ambiente

Copie para `.env.local`:

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | sim | endpoint do Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | client Supabase no browser |
| `SUPABASE_SERVICE_ROLE_KEY` | sim | client admin (server-only) |
| `NEXT_PUBLIC_ROOT_DOMAIN` | sim | domínio base do multi-tenant (`lvh.me:3000` em dev) |
| `NEXT_PUBLIC_SITE_URL` | sim | URL canônica (metadata, sitemap, links de e-mail) |
| `SUPABASE_WEBHOOK_SECRET` | sim | valida a assinatura do webhook de e-mail do Auth |
| `RESEND_API_KEY` / `EMAIL_FROM` | sim | envio de e-mails transacionais |
| `GOOGLE_GENERATIVE_AI_API_KEY` | sim | assistente de IA do portal |
| `ASAAS_API_KEY` / `ASAAS_SANDBOX` | sim | cobrança das assinaturas |
| `ASAAS_WEBHOOK_TOKEN` | sim | valida o webhook de pagamento do Asaas |
| `VERCEL_ACCESS_TOKEN` | opcional | registrar domínios customizados via API |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ignora RLS. Só use em módulos com
> `import "server-only"`.

Em produção use `vercel env add` — nunca commite `.env*`.

## Segurança — o que está garantido

- **RLS** habilitado em todas as tabelas com dado de tenant
  (`supabase/migrations/0002_rls.sql` em diante).
- **Server Actions são endpoints públicos**: toda mutation revalida auth +
  autorização no servidor (`requireTenantOwner`, `requirePlatformAdmin`,
  `getAuthUser`), nunca confiando na UI.
- **Webhooks são fail-closed**: `/api/auth/email` valida HMAC do Supabase e
  `/api/webhooks/asaas` valida token — ambos com comparação constant-time.
- **`/api/chat`** confere que o usuário pertence ao tenant da request e que a
  conversa informada é dele, antes de gravar ou consumir cota de IA.

## Banco de dados

Migrations em `supabase/migrations/`, aplicadas em ordem numérica.

```bash
supabase migration new nome_da_mudanca   # cria o arquivo
pnpm db:reset                            # reaplica tudo do zero (destrutivo)
supabase db push                         # aplica no projeto remoto
```

Toda tabela nova com dado de tenant precisa de `tenant_id`, índice nele e
policies de RLS — siga o padrão de uma migration existente.

## Webhooks

| Origem | Rota | Configuração |
| --- | --- | --- |
| Supabase Auth | `/api/auth/email` | envia o e-mail de confirmação com o branding do tenant |
| Asaas | `/api/webhooks/asaas` | ativa/suspende o tenant conforme o pagamento |

Os dois retornam **401** sem credencial válida. Se os e-mails de confirmação ou
a ativação pós-pagamento pararem de funcionar, cheque primeiro se
`SUPABASE_WEBHOOK_SECRET` / `ASAAS_WEBHOOK_TOKEN` batem com o painel de origem.

## Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | servidor de desenvolvimento |
| `pnpm build` | build de produção |
| `pnpm lint` | ESLint |
| `pnpm db:reset` | recria o banco local a partir das migrations |
| `pnpm seed:superadmin` | cria o usuário de superadmin |
| `pnpm seed:auth` | cria tenant + cliente de exemplo |

## Deploy

Projeto ligado à Vercel (`vercel --prod`). Domínios customizados de tenant são
registrados via API em `lib/vercel-domains.ts` e resolvidos por
`tenants.custom_domain`.

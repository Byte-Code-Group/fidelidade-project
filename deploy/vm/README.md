# Fidelidade na VM (sem Supabase na nuvem)

O código continua usando o `supabase-js`, mas tudo roda na VM sobre o Postgres
compartilhado do Bytecode App (database `fidelidade`):

| Peça | Imagem | Faz |
| --- | --- | --- |
| `fidelidade` | `fidelidade:current` (pipeline) | o app Next.js |
| `fidelidade-auth` | `supabase/gotrue` | login, cadastro, sessões, reset de senha (schema `auth`) |
| `fidelidade-rest` | `postgrest/postgrest` | API das tabelas, com o RLS das migrations |
| `fidelidade-storage` | `supabase/storage-api` | uploads (logos, documentos), arquivos no volume `fidelidade_storage` |

O Caddy de borda manda `/auth/v1`, `/rest/v1` e `/storage/v1` para essas peças
(`fidelidade.caddy`), então `NEXT_PUBLIC_SUPABASE_URL` é o próprio domínio do app.

## Arquivos

- `compose.vm.yml` → `~/apps/fidelidade/compose.vm.yml`
- `fidelidade.caddy` → `~/infra/caddy/sites/fidelidade.caddy`
- `init-roles.sql` papéis que GoTrue/PostgREST/storage esperam (uma vez, como superusuário)
- `gerar-chaves.mjs` gera `JWT_SECRET`, `ANON_KEY` e `SERVICE_ROLE_KEY`
- `migrate.sh` aplica as migrations novas de `supabase/migrations`

Segredos só na VM, em `~/apps/fidelidade/`: `.env.vm` (app), `.env.auth`,
`.env.rest`, `.env.storage`.

## Migration nova

Crie o arquivo em `supabase/migrations/` como antes e, depois do push:

```bash
deploy/vm/migrate.sh infisical-vm
```

## Backups

O `backup.sh` das 3h já faz o dump do database `fidelidade` (tabelas e contas de
login). Os arquivos enviados ficam no volume `fidelidade_storage` e **não** entram
nesse backup.

#!/usr/bin/env bash
# Aplica na VM as migrations de supabase/migrations que ainda não rodaram.
# Roda do seu computador, na raiz do repo:
#
#   deploy/vm/migrate.sh infisical-vm
#
# Como superusuário (as migrations criam políticas em storage.objects e
# referenciam auth.users). Cada arquivo roda numa transação e fica anotado
# em public._migrations; os já anotados são pulados.
set -euo pipefail
HOST="${1:?uso: deploy/vm/migrate.sh <host-ssh>}"
DB=fidelidade
psql_vm() { ssh "$HOST" "docker exec -i postgres psql -qAt -v ON_ERROR_STOP=1 -U postgres -d $DB" "$@"; }

echo "create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now());
revoke all on public._migrations from anon, authenticated;" | psql_vm >/dev/null
applied="$(echo "select name from public._migrations" | psql_vm)"

for f in supabase/migrations/*.sql; do
  name="$(basename "$f")"
  grep -qxF "$name" <<<"$applied" && continue
  echo "→ $name"
  { echo "begin;"; cat "$f"; echo; echo "insert into public._migrations (name) values ('$name');"; echo "commit;"; } | psql_vm >/dev/null
done
# PostgREST relê o schema (tabelas/colunas novas).
echo "notify pgrst, 'reload schema';" | psql_vm >/dev/null
echo "✓ migrations em dia"

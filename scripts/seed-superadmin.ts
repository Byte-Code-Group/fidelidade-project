/**
 * Cria o usuário Super Admin da plataforma (auth) + linha em
 * public.platform_admins. Roda DEPOIS do `supabase db reset`.
 *
 *   ./node_modules/.bin/tsx scripts/seed-superadmin.ts
 *
 * Idempotente: reaproveita o usuário se já existir.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const ADMIN_EMAIL = "admin@plataforma.com";
const ADMIN_PASSWORD = "senha123";
const ADMIN_NAME = "Super Admin";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function findUserByEmail(email: string) {
  const { data } = await supabase.auth.admin.listUsers();
  return data.users.find((u) => u.email === email) ?? null;
}

async function main() {
  let authUser = await findUserByEmail(ADMIN_EMAIL);
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    });
    if (error) throw error;
    authUser = data.user;
    console.log("✓ auth user criado:", authUser.email);
  } else {
    console.log("• auth user já existe:", authUser.email);
  }

  const { error } = await supabase
    .from("platform_admins")
    .upsert({ user_id: authUser.id });
  if (error) throw error;
  console.log("✓ platform_admins ok");

  console.log(
    `\nSuper Admin:\n  URL:   http://lvh.me:3000/superadmin\n  email: ${ADMIN_EMAIL}\n  senha: ${ADMIN_PASSWORD}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

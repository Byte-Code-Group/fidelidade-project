/**
 * Cria o usuário demo (auth) + linha em public.users + membership.
 * Precisa rodar DEPOIS do `supabase db reset` (seed.sql já populou o tenant).
 *
 *   pnpm seed:auth
 *
 * Idempotente: se o usuário já existe, reaproveita.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Carrega .env.local manualmente (script roda fora do Next).
function loadEnv() {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}
loadEnv();

const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_EMAIL = "paciente@oraldents.com.br";
const DEMO_PASSWORD = "senha123";
const DEMO_NAME = "Maria Silva";

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
  // 1. Usuário no Auth
  let authUser = await findUserByEmail(DEMO_EMAIL);
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_NAME },
    });
    if (error) throw error;
    authUser = data.user;
    console.log("✓ auth user criado:", authUser.email);
  } else {
    console.log("• auth user já existe:", authUser.email);
  }

  // 2. Linha em public.users
  const { error: uErr } = await supabase.from("users").upsert({
    id: authUser.id,
    tenant_id: TENANT_ID,
    role: "client",
    full_name: DEMO_NAME,
    email: DEMO_EMAIL,
  });
  if (uErr) throw uErr;
  console.log("✓ public.users ok");

  // 3. Membership (carteirinha) — upsert por member_code
  const { error: mErr } = await supabase.from("memberships").upsert(
    {
      tenant_id: TENANT_ID,
      user_id: authUser.id,
      modality: "titular",
      status: "active",
      member_code: "ORAL-0001",
      points_total: 150, // saldo p/ testar a Loja de Resgate
      valid_until: "2026-12-31",
    },
    { onConflict: "member_code" },
  );
  if (mErr) throw mErr;
  console.log("✓ membership ok (ORAL-0001, 4/6 pts)");

  console.log(
    `\nLogin demo:\n  URL:   http://oraldents.lvh.me:3000/login\n  email: ${DEMO_EMAIL}\n  senha: ${DEMO_PASSWORD}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

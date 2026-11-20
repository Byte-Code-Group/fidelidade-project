import { defineConfig } from "cypress";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

// Mesmo loader dos scripts/seed-*.ts: Cypress roda fora do Next.
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

export const TENANT_ID = "00000000-0000-0000-0000-000000000001";

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

async function ensureUser(email: string, password: string, fullName: string) {
  const sb = admin();
  const { data } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const found = data.users.find((u) => u.email === email);
  if (found) return found.id;
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return created.user.id;
}

// TOTP (RFC 6238) do app autenticador, para o teste da verificação em duas etapas.
function totp(secretBase32: string, step: number): string {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secretBase32.replace(/=+$/, "").toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", key).update(msg).digest();
  const o = h[h.length - 1] & 0xf;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

let ultimoStep = 0;

export default defineConfig({
  e2e: {
    baseUrl: "http://lvh.me:3000",
    video: false,
    screenshotOnRunFailure: false,
    defaultCommandTimeout: 10000,
    // next dev fica lento depois de horas no ar; 1 retry só no headless.
    retries: { runMode: 1, openMode: 0 },
    setupNodeEvents(on) {
      on("task", {
        // Dono do tenant demo (oraldents) — os seeds do repo só criam cliente e superadmin.
        async seedOwner() {
          const userId = await ensureUser("dono@oraldents.com.br", "senha123", "Dono Oraldents");
          const sb = admin();
          const { data } = await sb
            .from("platform_users")
            .select("id")
            .eq("user_id", userId)
            .eq("tenant_id", TENANT_ID)
            .maybeSingle();
          if (!data) {
            const { error } = await sb.from("platform_users").insert({ user_id: userId, tenant_id: TENANT_ID });
            if (error) throw error;
          }
          return null;
        },
        // Saldo da carteirinha demo, p/ o teste de resgate não depender de execuções anteriores.
        async setDemoPoints(points: number) {
          const { error } = await admin()
            .from("memberships")
            .update({ points_total: points })
            .eq("member_code", "ORAL-0001");
          if (error) throw error;
          return null;
        },
        // Dono novo a cada execução: o teste liga a verificação em duas etapas nele.
        async createOwner(email: string) {
          const userId = await ensureUser(email, "Senha-E2E-forte-2026", "Dono MFA E2E");
          const { error } = await admin().from("platform_users").insert({ user_id: userId, tenant_id: TENANT_ID });
          if (error) throw error;
          return null;
        },
        // Código do autenticador sempre de uma janela de 30s ainda não usada
        // (o GoTrue não aceita o mesmo código duas vezes).
        async totp(secret: string) {
          let step = Math.floor(Date.now() / 30_000);
          if (step <= ultimoStep) {
            await new Promise((r) => setTimeout(r, (ultimoStep + 1) * 30_000 - Date.now() + 500));
            step = ultimoStep + 1;
          }
          ultimoStep = step;
          return totp(secret, step);
        },
        // Outro negócio ativo, para testar que a conta de um não entra no portal do outro.
        async otherTenantSlug() {
          const { data } = await admin()
            .from("tenants")
            .select("id, slug")
            .neq("id", TENANT_ID)
            .limit(1)
            .maybeSingle();
          if (!data) return null;
          await admin().from("tenants").update({ status: "active" }).eq("id", data.id);
          return data.slug;
        },
        // Primeiro id de uma tabela do tenant demo, p/ visitar rotas dinâmicas.
        async firstId(table: string) {
          const { data } = await admin()
            .from(table)
            .select("id")
            .eq("tenant_id", TENANT_ID)
            .limit(1)
            .maybeSingle();
          return data?.id ?? null;
        },
      });
    },
  },
});

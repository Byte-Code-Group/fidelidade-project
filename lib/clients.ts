import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateProfileFieldValues } from "@/lib/profile-fields";
import { cancelarAssinaturaDoCliente } from "@/lib/member-subscriptions";
import { BUCKETS } from "@/lib/storage";
import { normalizarE164 } from "@/lib/whatsapp";
import { traduzirErro } from "@/lib/error-messages";
import type { ProfileField } from "@/lib/types";

type Db = ReturnType<typeof createAdminClient>;
const EMAIL = /^\S+@\S+\.\S+$/;

/**
 * Campos dinâmicos chegam como field_<uuid> no form. O id vem do navegador,
 * então só vale se for campo DESTE negócio — senão dava pra gravar valor preso
 * a um campo de outro tenant só editando o HTML.
 */
export function collectProfileFieldValues(
  fieldDefs: ProfileField[],
  formData: FormData,
  tenantId: string,
  userId: string,
) {
  const camposDoTenant = new Set(fieldDefs.map((f) => f.id));
  const rows: { tenant_id: string; user_id: string; field_id: string; value: string }[] = [];
  const valuesByField = new Map<string, string>();
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("field_")) continue;
    const fieldId = key.slice("field_".length);
    if (!camposDoTenant.has(fieldId)) continue;
    const value = String(raw);
    valuesByField.set(fieldId, value);
    rows.push({ tenant_id: tenantId, user_id: userId, field_id: fieldId, value });
  }
  return { rows, error: validateProfileFieldValues(fieldDefs, valuesByField) };
}

/**
 * Carteirinha inicial com código único SLUG-XXXXXX. O código é unique no banco,
 * então uma colisão derrubava o insert em silêncio e o cliente ficava sem
 * carteirinha — tenta de novo com outro sufixo.
 */
export async function insertMembership(db: Db, tenantId: string, slug: string, userId: string) {
  let error: { code?: string; message?: string } | null = null;
  let memberCode = "";
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    memberCode = `${slug.toUpperCase().slice(0, 6)}-${randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    ({ error } = await db.from("memberships").insert({
      tenant_id: tenantId,
      user_id: userId,
      modality: "titular",
      status: "active",
      member_code: memberCode,
      points_total: 0,
    }));
    if (!error || error.code !== "23505") break;
  }
  return { error, memberCode };
}

async function loadFields(db: Db, tenantId: string) {
  const { data } = await db.from("profile_fields").select("*").eq("tenant_id", tenantId).returns<ProfileField[]>();
  return data ?? [];
}

// Cliente final deste negócio? (id vem da URL — nunca confiar sem checar o tenant.)
async function isTenantClient(db: Db, tenantId: string, userId: string) {
  const { data } = await db
    .from("users")
    .select("id")
    .eq("id", userId)
    .eq("tenant_id", tenantId)
    .eq("role", "client")
    .maybeSingle();
  return Boolean(data);
}

function readBasics(formData: FormData) {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = phoneRaw ? normalizarE164(phoneRaw) : null;
  if (!fullName) return { error: "Preencha o nome do cliente." };
  if (!EMAIL.test(email)) return { error: "Informe um e-mail válido." };
  if (phoneRaw && !phone) return { error: "Telefone inválido." };
  return { fullName, email, phone };
}

/**
 * Dono cadastra um cliente. A conta nasce com senha aleatória: o cliente entra
 * pelo "Esqueci minha senha" do portal com o próprio e-mail.
 */
export async function createClientByOwner(tenantId: string, formData: FormData): Promise<{ id?: string; error?: string }> {
  const basics = readBasics(formData);
  if ("error" in basics) return { error: basics.error };
  const db = createAdminClient();

  const [fields, { data: tenant }] = await Promise.all([
    loadFields(db, tenantId),
    db.from("tenants").select("slug").eq("id", tenantId).single<{ slug: string }>(),
  ]);
  if (!tenant) return { error: "Negócio não encontrado." };
  // Valida os campos antes de criar a conta (userId provisório só pra montar as linhas).
  const precheck = collectProfileFieldValues(fields, formData, tenantId, "");
  if (precheck.error) return { error: precheck.error };

  const { data: created, error: authErr } = await db.auth.admin.createUser({
    email: basics.email,
    password: randomUUID(),
    email_confirm: true,
    user_metadata: { full_name: basics.fullName },
  });
  if (authErr || !created.user) {
    const msg = authErr?.message ?? "";
    return { error: /already|registered|exists/i.test(msg) ? "Já existe uma conta com esse e-mail." : traduzirErro(msg) };
  }
  const id = created.user.id;

  const { error: uErr } = await db.from("users").insert({
    id,
    tenant_id: tenantId,
    role: "client",
    full_name: basics.fullName,
    email: basics.email,
    phone: basics.phone,
  });
  const mErr = uErr ? null : (await insertMembership(db, tenantId, tenant.slug, id)).error;
  const { rows } = collectProfileFieldValues(fields, formData, tenantId, id);
  const fErr = uErr || mErr || !rows.length ? null : (await db.from("profile_field_values").insert(rows)).error;

  if (uErr || mErr || fErr) {
    console.error("[clients] create", { uErr, mErr, fErr });
    await db.auth.admin.deleteUser(id); // cascata limpa users/carteirinha/campos
    return { error: "Não consegui cadastrar o cliente. Tente de novo." };
  }
  return { id };
}

export async function updateClientByOwner(tenantId: string, userId: string, formData: FormData): Promise<{ error?: string }> {
  const basics = readBasics(formData);
  if ("error" in basics) return { error: basics.error };
  const db = createAdminClient();
  if (!(await isTenantClient(db, tenantId, userId))) return { error: "Cliente não encontrado." };

  const fields = await loadFields(db, tenantId);
  const { rows, error } = collectProfileFieldValues(fields, formData, tenantId, userId);
  if (error) return { error };

  const { data: current } = await db.from("users").select("email").eq("id", userId).single<{ email: string | null }>();
  if (current?.email !== basics.email) {
    const { error: authErr } = await db.auth.admin.updateUserById(userId, { email: basics.email, email_confirm: true });
    if (authErr) {
      return { error: /already|registered|exists/i.test(authErr.message) ? "Já existe uma conta com esse e-mail." : traduzirErro(authErr.message) };
    }
  }

  const { error: uErr } = await db
    .from("users")
    .update({ full_name: basics.fullName, email: basics.email, phone: basics.phone })
    .eq("id", userId)
    .eq("tenant_id", tenantId);
  if (uErr) return { error: traduzirErro(uErr.message) };

  if (rows.length) {
    const { error: fErr } = await db.from("profile_field_values").upsert(rows, { onConflict: "field_id,user_id" });
    if (fErr) return { error: traduzirErro(fErr.message) };
  }
  return {};
}

/**
 * Exclui o cliente de vez: cancela a cobrança recorrente no Asaas (senão ele
 * continuaria sendo cobrado), apaga os arquivos dos documentos e a conta —
 * o resto (carteirinha, pontos, agendamentos...) cai por cascata.
 */
export async function deleteClientByOwner(tenantId: string, userId: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  if (!(await isTenantClient(db, tenantId, userId))) return { error: "Cliente não encontrado." };

  const [{ data: memberships }, { data: docs }] = await Promise.all([
    db.from("memberships").select("id").eq("tenant_id", tenantId).eq("user_id", userId),
    db.from("documents").select("file_url").eq("tenant_id", tenantId).eq("user_id", userId),
  ]);
  for (const m of memberships ?? []) await cancelarAssinaturaDoCliente(tenantId, m.id);

  const { error } = await db.auth.admin.deleteUser(userId);
  if (error) return { error: traduzirErro(error.message) };

  // Arquivos depois da conta: se a exclusão falhasse, o cliente não ficaria sem os documentos.
  const paths = (docs ?? []).map((d) => d.file_url).filter(Boolean);
  if (paths.length) await db.storage.from(BUCKETS.documents).remove(paths);
  return {};
}

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidCpf, isValidPhone } from "@/lib/masks";
import type { ProfileField, ProfileFieldType } from "@/lib/types";
import { traduzirErro } from "@/lib/error-messages";

// Lógica de negócio pura (sem gate de auth) reaproveitada tanto pelo
// Super Admin (app/superadmin/actions.ts) quanto pelo painel do dono
// (app/painel/actions.ts) — cada chamador resolve o próprio gate antes.

const FIELD_TYPES: ProfileFieldType[] = [
  "text",
  "textarea",
  "date",
  "select",
  "cpf",
  "birthdate",
  "address",
  "phone",
];

function profileFieldData(formData: FormData) {
  const optionsRaw = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  const fieldType = String(formData.get("field_type") ?? "text");
  const maxLengthRaw = String(formData.get("max_length") ?? "").trim();

  return {
    label: String(formData.get("label") ?? "").trim(),
    field_type: FIELD_TYPES.includes(fieldType as ProfileFieldType)
      ? (fieldType as ProfileFieldType)
      : "text",
    options: optionsRaw.length > 0 ? optionsRaw : null,
    required: formData.get("required") === "on",
    max_length:
      (fieldType === "text" || fieldType === "textarea") && maxLengthRaw !== ""
        ? Math.max(1, Number(maxLengthRaw))
        : null,
  };
}

// Slugifica o rótulo pra virar a chave interna (usuário não edita mais isso).
function slugify(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "campo";
}

// nome, nome_1, nome_2... incrementa até achar uma chave livre no tenant.
async function uniqueFieldKey(tenantId: string, label: string): Promise<string> {
  const db = createAdminClient();
  const base = slugify(label);
  const { data } = await db
    .from("profile_fields")
    .select("field_key")
    .eq("tenant_id", tenantId);
  const taken = new Set((data ?? []).map((r) => r.field_key));

  if (!taken.has(base)) return base;
  let i = 1;
  while (taken.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export async function insertProfileField(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const fields = profileFieldData(formData);
  if (!fields.label) {
    return { error: "Rótulo é obrigatório." };
  }
  const db = createAdminClient();
  const field_key = await uniqueFieldKey(tenantId, fields.label);
  const { count } = await db
    .from("profile_fields")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { error } = await db
    .from("profile_fields")
    .insert({ tenant_id: tenantId, ...fields, field_key, display_order: count ?? 0 });
  return { error: error ? traduzirErro(error.message) : undefined };
}

// Reordena os campos conforme a posição arrastada no painel do dono.
export async function reorderProfileFields(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("profile_fields")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error ? traduzirErro(failed.error.message) : undefined };
}

export async function applyProfileFieldUpdate(
  tenantId: string,
  fieldId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("profile_fields")
    .update(profileFieldData(formData))
    .eq("id", fieldId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function removeProfileField(
  tenantId: string,
  fieldId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("profile_fields")
    .delete()
    .eq("id", fieldId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

// Valida os valores enviados no form de perfil do cliente contra a
// definição de cada campo (obrigatoriedade, CPF, limite de caracteres).
export function validateProfileFieldValues(
  fields: ProfileField[],
  values: Map<string, string>,
): string | null {
  for (const field of fields) {
    const value = (values.get(field.id) ?? "").trim();

    if (field.required && !value) {
      return `Preencha o campo "${field.label}".`;
    }
    if (!value) continue;

    if (field.field_type === "cpf" && !isValidCpf(value)) {
      return `CPF inválido em "${field.label}".`;
    }
    if (field.field_type === "phone" && !isValidPhone(value)) {
      return `Telefone inválido em "${field.label}".`;
    }
    if (
      (field.field_type === "text" || field.field_type === "textarea") &&
      field.max_length != null &&
      value.length > field.max_length
    ) {
      return `"${field.label}" excede o limite de ${field.max_length} caracteres.`;
    }
  }
  return null;
}

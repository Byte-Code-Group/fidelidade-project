import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

function templateFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    content: String(formData.get("content") ?? "").trim(),
  };
}

export async function insertDocumentTemplate(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const fields = templateFields(formData);
  if (!fields.name) return { error: "Nome é obrigatório." };
  if (!fields.content) return { error: "Conteúdo é obrigatório." };
  const db = createAdminClient();
  const { count } = await db
    .from("document_templates")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { error } = await db
    .from("document_templates")
    .insert({ tenant_id: tenantId, ...fields, display_order: count ?? 0 });
  return { error: error?.message };
}

export async function applyDocumentTemplateUpdate(
  tenantId: string,
  templateId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("document_templates")
    .update(templateFields(formData))
    .eq("id", templateId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

export async function removeDocumentTemplate(
  tenantId: string,
  templateId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("document_templates")
    .delete()
    .eq("id", templateId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

// Reordena conforme a posição arrastada no painel do dono.
export async function reorderDocumentTemplates(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("document_templates")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error?.message };
}

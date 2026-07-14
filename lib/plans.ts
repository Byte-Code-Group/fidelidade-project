import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

function planFields(formData: FormData) {
  const benefits = String(formData.get("benefits") ?? "")
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  return {
    name: String(formData.get("name") ?? "").trim(),
    price_month: Number(formData.get("price_month") ?? 0),
    benefits,
    is_popular: formData.get("is_popular") === "on",
  };
}

export async function insertPlan(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const fields = planFields(formData);
  if (!fields.name) return { error: "Nome é obrigatório." };
  const db = createAdminClient();
  const { count } = await db
    .from("business_plans")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { error } = await db
    .from("business_plans")
    .insert({ tenant_id: tenantId, ...fields, display_order: count ?? 0 });
  return { error: error?.message };
}

export async function applyPlanUpdate(
  tenantId: string,
  planId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("business_plans")
    .update(planFields(formData))
    .eq("id", planId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

export async function removePlan(
  tenantId: string,
  planId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("business_plans")
    .delete()
    .eq("id", planId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

// Reordena conforme a posição arrastada no painel do dono.
export async function reorderPlans(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("business_plans")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error?.message };
}

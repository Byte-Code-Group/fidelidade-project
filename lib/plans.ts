import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export function planFields(formData: FormData) {
  const benefits = String(formData.get("benefits") ?? "")
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  return {
    name: String(formData.get("name") ?? "").trim(),
    price_month: Number(formData.get("price_month") ?? 0),
    benefits,
    is_popular: formData.get("is_popular") === "on",
    upgrade_discount_pct: Number(formData.get("upgrade_discount_pct") ?? 0),
    display_order: Number(formData.get("display_order") ?? 0),
  };
}

export async function insertPlan(tenantId: string, formData: FormData) {
  const fields = planFields(formData);
  if (!fields.name) return;
  const db = createAdminClient();
  await db.from("business_plans").insert({ tenant_id: tenantId, ...fields });
}

export async function applyPlanUpdate(
  tenantId: string,
  planId: string,
  formData: FormData,
) {
  const db = createAdminClient();
  await db
    .from("business_plans")
    .update(planFields(formData))
    .eq("id", planId)
    .eq("tenant_id", tenantId);
}

export async function removePlan(tenantId: string, planId: string) {
  const db = createAdminClient();
  await db
    .from("business_plans")
    .delete()
    .eq("id", planId)
    .eq("tenant_id", tenantId);
}

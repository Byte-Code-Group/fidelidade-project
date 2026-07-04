import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export function rewardFields(formData: FormData) {
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const stockRaw = String(formData.get("stock") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: text("description"),
    points_cost: Number(formData.get("points_cost") ?? 0),
    image_url: text("image_url"),
    stock: stockRaw === "" ? null : Number(stockRaw),
    is_active: formData.get("is_active") === "on",
    display_order: Number(formData.get("display_order") ?? 0),
  };
}

export async function insertReward(tenantId: string, formData: FormData) {
  const fields = rewardFields(formData);
  if (!fields.name) return;
  const db = createAdminClient();
  await db.from("rewards").insert({ tenant_id: tenantId, ...fields });
}

export async function applyRewardUpdate(
  tenantId: string,
  rewardId: string,
  formData: FormData,
) {
  const db = createAdminClient();
  await db
    .from("rewards")
    .update(rewardFields(formData))
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
}

export async function removeReward(tenantId: string, rewardId: string) {
  const db = createAdminClient();
  await db
    .from("rewards")
    .delete()
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
}

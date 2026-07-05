import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

function rewardFields(formData: FormData) {
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
  };
}

export async function insertReward(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const fields = rewardFields(formData);
  if (!fields.name) return { error: "Nome é obrigatório." };
  const db = createAdminClient();
  const { count } = await db
    .from("rewards")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { error } = await db
    .from("rewards")
    .insert({ tenant_id: tenantId, ...fields, display_order: count ?? 0 });
  return { error: error?.message };
}

export async function applyRewardUpdate(
  tenantId: string,
  rewardId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("rewards")
    .update(rewardFields(formData))
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

export async function removeReward(
  tenantId: string,
  rewardId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("rewards")
    .delete()
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

// Reordena conforme a posição arrastada no painel do dono.
export async function reorderRewards(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("rewards")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error?.message };
}

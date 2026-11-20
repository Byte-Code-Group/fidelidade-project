import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { addPoints } from "@/lib/points";

export async function approveRedemption(tenantId: string, redemptionId: string) {
  const db = createAdminClient();
  await db
    .from("reward_redemptions")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
    .eq("id", redemptionId)
    .eq("tenant_id", tenantId);
}

// Cancela o resgate e devolve os pontos gastos ao cliente.
export async function rejectRedemption(tenantId: string, redemptionId: string) {
  const db = createAdminClient();

  const { data: r } = await db
    .from("reward_redemptions")
    .select("user_id, points_spent")
    .eq("id", redemptionId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ user_id: string; points_spent: number }>();

  if (r) {
    const { data: membership } = await db
      .from("memberships")
      .select("id, points_total")
      .eq("tenant_id", tenantId)
      .eq("user_id", r.user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; points_total: number }>();

    if (membership) await addPoints(membership.id, r.points_spent);
  }

  await db
    .from("reward_redemptions")
    .delete()
    .eq("id", redemptionId)
    .eq("tenant_id", tenantId);
}

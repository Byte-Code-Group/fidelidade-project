import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Lógica de negócio pura (sem gate de auth) reaproveitada tanto pelo
// Super Admin quanto pelo painel do dono.

export async function approveCompletion(tenantId: string, completionId: string) {
  const db = createAdminClient();

  const { data: completion } = await db
    .from("mission_completions")
    .select("user_id, mission_id")
    .eq("id", completionId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ user_id: string; mission_id: string }>();
  if (!completion) return;

  await db
    .from("mission_completions")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", completionId);

  const { data: mission } = await db
    .from("missions")
    .select("points")
    .eq("id", completion.mission_id)
    .maybeSingle<{ points: number }>();

  if (mission && mission.points > 0) {
    const { data: membership } = await db
      .from("memberships")
      .select("id, points_total")
      .eq("tenant_id", tenantId)
      .eq("user_id", completion.user_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<{ id: string; points_total: number }>();

    if (membership) {
      await db
        .from("memberships")
        .update({ points_total: membership.points_total + mission.points })
        .eq("id", membership.id);
    }
  }
}

export async function rejectCompletion(tenantId: string, completionId: string) {
  const db = createAdminClient();
  await db
    .from("mission_completions")
    .delete()
    .eq("id", completionId)
    .eq("tenant_id", tenantId);
}

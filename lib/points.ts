import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Soma pontos com compare-and-swap (mesma ideia do débito do resgate): crédito
// e débito simultâneos na mesma carteirinha não sobrescrevem um ao outro.
export async function addPoints(membershipId: string, delta: number): Promise<boolean> {
  const db = createAdminClient();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const { data: m } = await db
      .from("memberships")
      .select("points_total")
      .eq("id", membershipId)
      .maybeSingle<{ points_total: number }>();
    if (!m) return false;
    const { data } = await db
      .from("memberships")
      .update({ points_total: Math.max(0, m.points_total + delta) })
      .eq("id", membershipId)
      .eq("points_total", m.points_total)
      .select("id");
    if (data?.length) return true;
  }
  console.error("[points] não conseguiu creditar após 5 tentativas", { membershipId, delta });
  return false;
}

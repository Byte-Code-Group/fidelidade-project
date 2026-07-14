import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

interface PlanRow {
  id: string;
  price_month: number;
}

// Aplica troca de plano agendada cujo prazo já virou. Sem cobrança
// automática — só sincroniza o estado, chamada sempre que a tela de planos
// carrega (mesma ideia de applyScheduledChanges em lib/tenant-billing.ts).
export async function applyScheduledMembershipChange(membershipId: string) {
  const db = createAdminClient();
  const { data: m } = await db
    .from("memberships")
    .select("pending_plan_id, pending_plan_effective_at")
    .eq("id", membershipId)
    .maybeSingle<{ pending_plan_id: string | null; pending_plan_effective_at: string | null }>();
  if (!m?.pending_plan_id || !m.pending_plan_effective_at) return;
  if (new Date() < new Date(m.pending_plan_effective_at)) return;

  await db
    .from("memberships")
    .update({
      plan_id: m.pending_plan_id,
      pending_plan_id: null,
      pending_plan_effective_at: null,
    })
    .eq("id", membershipId);
}

// Troca o plano do cliente final — estilo Netflix/Spotify, sem cobrança
// automática (não há gateway de pagamento pro cliente final ainda):
//   - Primeira assinatura ou upgrade (plano de preço maior ou igual): vale
//     na hora.
//   - Downgrade (plano mais barato): fica agendado pro fim do período
//     vigente (memberships.valid_until). Sem período vigente definido,
//     aplica na hora também.
export async function changeMembershipPlan(
  tenantId: string,
  userId: string,
  newPlanId: string,
): Promise<{ error?: string; scheduledFor?: string }> {
  const db = createAdminClient();

  const { data: membership } = await db
    .from("memberships")
    .select("id, plan_id, valid_until")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string; plan_id: string | null; valid_until: string | null }>();
  if (!membership) return { error: "Carteirinha não encontrada." };
  if (membership.plan_id === newPlanId) return {};

  const { data: newPlan } = await db
    .from("business_plans")
    .select("id, price_month")
    .eq("id", newPlanId)
    .eq("tenant_id", tenantId)
    .maybeSingle<PlanRow>();
  if (!newPlan) return { error: "Plano não encontrado." };

  const applyNow = async () => {
    await db
      .from("memberships")
      .update({ plan_id: newPlanId, pending_plan_id: null, pending_plan_effective_at: null })
      .eq("id", membership.id);
    return {};
  };

  if (!membership.plan_id) return applyNow();

  const { data: currentPlan } = await db
    .from("business_plans")
    .select("id, price_month")
    .eq("id", membership.plan_id)
    .maybeSingle<PlanRow>();

  const isUpgrade = !currentPlan || newPlan.price_month >= currentPlan.price_month;
  if (isUpgrade || !membership.valid_until) return applyNow();

  await db
    .from("memberships")
    .update({ pending_plan_id: newPlanId, pending_plan_effective_at: membership.valid_until })
    .eq("id", membership.id);
  return { scheduledFor: membership.valid_until };
}

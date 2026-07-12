"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireTenantOwner, ACTIVE_TENANT_COOKIE } from "@/lib/owner";
import { applyTenantSettingsUpdate, applyTenantLogoUpload } from "@/lib/tenant-settings";
import {
  insertMission,
  applyMissionUpdate,
  removeMission,
  reorderMissions,
} from "@/lib/missions";
import { insertReward, applyRewardUpdate, removeReward, reorderRewards } from "@/lib/rewards";
import { insertPlan, applyPlanUpdate, removePlan, reorderPlans } from "@/lib/plans";
import {
  insertProfileField,
  applyProfileFieldUpdate,
  removeProfileField,
  reorderProfileFields,
} from "@/lib/profile-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  changeTenantPlan,
  cancelTenantSubscription,
  checkTenantLimitImpact,
  cancelPendingPlanChange,
} from "@/lib/tenant-billing";
import type { BillingType } from "@/lib/asaas";
import { approveCompletion, rejectCompletion } from "@/lib/mission-validations";
import { approveRedemption, rejectRedemption } from "@/lib/reward-redemptions";
import { isValidCpfCnpj } from "@/lib/masks";
import { SEGMENT_TEMPLATES } from "@/lib/segment-templates";

function redirectBack(path: string, error?: string) {
  revalidatePath(path);
  const qs = error ? `?error=${encodeURIComponent(error)}` : "?saved=1";
  redirect(`${path}${qs}`);
}

// Troca o negócio ativo no painel (switcher no menu). Só aceita um tenant
// que o próprio usuário realmente possui — nunca um id vindo de fora sem checagem.
export async function switchActiveTenant(tenantId: string) {
  const { tenants } = await requireTenantOwner();
  if (!tenants.some((t) => t.id === tenantId)) return;

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  redirect("/painel");
}

// Nenhuma dessas actions aceita tenantId vindo de fora — é sempre resolvido
// aqui via requireTenantOwner(), nunca por bind/argumento de form.

// Dados de identidade do negócio (nome, segmento, CPF/CNPJ) — edição
// dentro do painel, sem passar pelo wizard de onboarding. Não mexe no
// slug (URL do portal já em uso não pode trocar silenciosamente).
export async function ownerUpdateBusinessInfo(formData: FormData) {
  const { tenantId } = await requireTenantOwner();

  const name = String(formData.get("business_name") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim();
  const cpfCnpj = String(formData.get("owner_cpf_cnpj") ?? "").trim();

  if (!name || !segment || !cpfCnpj) {
    redirectBack("/painel/customizacao", "Preencha todos os campos.");
  }
  if (!SEGMENT_TEMPLATES[segment]) {
    redirectBack("/painel/customizacao", "Segmento inválido.");
  }
  if (!isValidCpfCnpj(cpfCnpj)) {
    redirectBack("/painel/customizacao", "CPF/CNPJ inválido.");
  }

  const db = createAdminClient();
  await db
    .from("tenants")
    .update({ name, segment_template: segment, owner_cpf_cnpj: cpfCnpj })
    .eq("id", tenantId);

  redirectBack("/painel/customizacao");
}

export async function ownerUpdateTenantSettings(formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyTenantSettingsUpdate(tenantId, formData);
  redirectBack("/painel/customizacao", error);
}

export async function ownerUploadLogo(formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyTenantLogoUpload(tenantId, formData);
  redirectBack("/painel/customizacao", error);
}

// ---------- Campos do cadastro (perfil do cliente) ----------

export async function ownerCreateProfileField(formData: FormData): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertProfileField(tenantId, formData);
  revalidatePath("/perfil");
  revalidatePath("/painel/customizacao");
  return { error };
}

export async function ownerUpdateProfileField(
  fieldId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyProfileFieldUpdate(tenantId, fieldId, formData);
  revalidatePath("/perfil");
  revalidatePath("/painel/customizacao");
  return { error };
}

export async function ownerDeleteProfileField(fieldId: string): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeProfileField(tenantId, fieldId);
  revalidatePath("/perfil");
  revalidatePath("/painel/customizacao");
  return { error };
}

export async function ownerReorderProfileFields(orderedIds: string[]) {
  const { tenantId } = await requireTenantOwner();
  const { error } = await reorderProfileFields(tenantId, orderedIds);
  revalidatePath("/perfil");
  revalidatePath("/painel/customizacao");
  return { error };
}

// ---------- Missões ----------

export async function ownerCreateMission(formData: FormData): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertMission(tenantId, formData);
  revalidatePath("/painel/missoes");
  revalidatePath("/painel/conexoes");
  return { error };
}

export async function ownerUpdateMission(
  missionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyMissionUpdate(tenantId, missionId, formData);
  revalidatePath("/painel/missoes");
  revalidatePath("/painel/conexoes");
  return { error };
}

export async function ownerDeleteMission(missionId: string): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeMission(tenantId, missionId);
  revalidatePath("/painel/missoes");
  revalidatePath("/painel/conexoes");
  return { error };
}

export async function ownerReorderMissions(orderedIds: string[]): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await reorderMissions(tenantId, orderedIds);
  revalidatePath("/painel/missoes");
  return { error };
}

// ---------- Loja (rewards) ----------

export async function ownerCreateReward(formData: FormData): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertReward(tenantId, formData);
  revalidatePath("/painel/loja");
  revalidatePath("/loja");
  return { error };
}

export async function ownerUpdateReward(
  rewardId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyRewardUpdate(tenantId, rewardId, formData);
  revalidatePath("/painel/loja");
  revalidatePath("/loja");
  return { error };
}

export async function ownerDeleteReward(rewardId: string): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeReward(tenantId, rewardId);
  revalidatePath("/painel/loja");
  revalidatePath("/loja");
  return { error };
}

export async function ownerReorderRewards(orderedIds: string[]): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await reorderRewards(tenantId, orderedIds);
  revalidatePath("/painel/loja");
  revalidatePath("/loja");
  return { error };
}

// ---------- Planos (business_plans) ----------

export async function ownerCreatePlan(formData: FormData): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertPlan(tenantId, formData);
  revalidatePath("/painel/planos");
  revalidatePath("/planos");
  return { error };
}

export async function ownerUpdatePlan(
  planId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyPlanUpdate(tenantId, planId, formData);
  revalidatePath("/painel/planos");
  revalidatePath("/planos");
  return { error };
}

export async function ownerDeletePlan(planId: string): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removePlan(tenantId, planId);
  revalidatePath("/painel/planos");
  revalidatePath("/planos");
  return { error };
}

export async function ownerReorderPlans(orderedIds: string[]): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await reorderPlans(tenantId, orderedIds);
  revalidatePath("/painel/planos");
  revalidatePath("/planos");
  return { error };
}

// ---------- Clientes (membros) ----------

export async function ownerAdjustMemberPoints(membershipId: string, formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  const delta = Number(formData.get("delta") ?? 0);
  if (!Number.isFinite(delta) || delta === 0) return;

  const db = createAdminClient();
  const { data: m } = await db
    .from("memberships")
    .select("points_total")
    .eq("id", membershipId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ points_total: number }>();
  if (!m) return;

  const next = Math.max(0, m.points_total + delta);
  await db
    .from("memberships")
    .update({ points_total: next })
    .eq("id", membershipId)
    .eq("tenant_id", tenantId);
  revalidatePath("/painel/clientes");
}

export async function ownerToggleMemberStatus(membershipId: string, nextStatus: string) {
  const { tenantId } = await requireTenantOwner();
  if (!["active", "suspended"].includes(nextStatus)) return;
  const db = createAdminClient();
  await db
    .from("memberships")
    .update({ status: nextStatus })
    .eq("id", membershipId)
    .eq("tenant_id", tenantId);
  revalidatePath("/painel/clientes");
}

// ---------- Assinatura ----------

function redirectToPlanSelection(plan: string, billing: string, error?: string) {
  const params = new URLSearchParams({ select_plan: plan, billing });
  if (error) params.set("error", error);
  redirect(`/painel/assinatura?${params.toString()}`);
}

export async function ownerChangePlan(formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  const plan = String(formData.get("plan") ?? "");
  const billingType = String(formData.get("billing_type") ?? "PIX").toUpperCase() as BillingType;
  const isConfirmStep = formData.get("confirm") === "1";
  const keepTenantIds = formData
    .getAll("keep_tenant_id")
    .map(String)
    .filter((id) => id !== tenantId);

  if (!["starter", "pro", "premium"].includes(plan)) {
    redirectBack("/painel/assinatura", "Plano inválido.");
  }

  // Downgrade pode deixar o dono com mais negócios ativos do que o plano
  // novo permite — antes de mexer em qualquer cobrança, checa se precisa
  // escolher quais negócios ficam ativos.
  const impact = await checkTenantLimitImpact(tenantId, plan);
  if (impact.requiresSelection) {
    const requiredExtra = impact.limit === -1 ? 0 : impact.limit - 1;
    if (keepTenantIds.length !== requiredExtra) {
      redirectToPlanSelection(
        plan,
        billingType,
        isConfirmStep
          ? `Selecione exatamente ${requiredExtra} negócio(s) pra manter ativo(s) além deste.`
          : undefined,
      );
    }
  }

  let invoiceUrl: string | undefined;
  let scheduledFor: string | undefined;
  try {
    const result = await changeTenantPlan(tenantId, plan, billingType, {
      keepActiveTenantIds: impact.requiresSelection ? keepTenantIds : undefined,
    });
    invoiceUrl = result.invoiceUrl;
    scheduledFor = "scheduledFor" in result ? result.scheduledFor : undefined;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao trocar plano.";
    redirectBack("/painel/assinatura", msg);
  }

  revalidatePath("/painel/assinatura");
  if (invoiceUrl) redirect(invoiceUrl);
  redirect(`/painel/assinatura?saved=${scheduledFor ? "scheduled" : "1"}`);
}

export async function ownerCancelPendingPlanChange() {
  const { tenantId } = await requireTenantOwner();
  await cancelPendingPlanChange(tenantId);
  revalidatePath("/painel/assinatura");
  redirectBack("/painel/assinatura");
}

export async function ownerCancelSubscription() {
  const { tenantId } = await requireTenantOwner();
  await cancelTenantSubscription(tenantId);
  revalidatePath("/painel/assinatura");
  redirect("/painel/assinatura?saved=cancelled");
}

// ---------- Resgates (loja) ----------

export async function ownerApproveRedemption(redemptionId: string) {
  const { tenantId } = await requireTenantOwner();
  await approveRedemption(tenantId, redemptionId);
  revalidatePath("/painel/resgates");
  revalidatePath("/historico");
}

export async function ownerRejectRedemption(redemptionId: string) {
  const { tenantId } = await requireTenantOwner();
  await rejectRedemption(tenantId, redemptionId);
  revalidatePath("/painel/resgates");
  revalidatePath("/historico");
}

// ---------- Validações de missão ----------

export async function ownerApproveMissionCompletion(completionId: string) {
  const { tenantId } = await requireTenantOwner();
  await approveCompletion(tenantId, completionId);
  revalidatePath("/painel/validacoes");
}

export async function ownerRejectMissionCompletion(completionId: string) {
  const { tenantId } = await requireTenantOwner();
  await rejectCompletion(tenantId, completionId);
  revalidatePath("/painel/validacoes");
}

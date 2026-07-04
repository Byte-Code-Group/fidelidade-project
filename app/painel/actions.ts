"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTenantOwner } from "@/lib/owner";
import { applyTenantSettingsUpdate, applyTenantLogoUpload } from "@/lib/tenant-settings";
import { insertMission, applyMissionUpdate, removeMission } from "@/lib/missions";
import { insertReward, applyRewardUpdate, removeReward } from "@/lib/rewards";
import {
  insertProfileField,
  applyProfileFieldUpdate,
  removeProfileField,
  reorderProfileFields,
} from "@/lib/profile-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import { changeTenantPlan, cancelTenantSubscription } from "@/lib/tenant-billing";
import type { BillingType } from "@/lib/asaas";
import { approveCompletion, rejectCompletion } from "@/lib/mission-validations";

function redirectBack(path: string, error?: string) {
  revalidatePath(path);
  const qs = error ? `?error=${encodeURIComponent(error)}` : "?saved=1";
  redirect(`${path}${qs}`);
}

// Nenhuma dessas actions aceita tenantId vindo de fora — é sempre resolvido
// aqui via requireTenantOwner(), nunca por bind/argumento de form.

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

export async function ownerCreateProfileField(formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertProfileField(tenantId, formData);
  revalidatePath("/perfil");
  redirectBack("/painel/customizacao", error);
}

export async function ownerUpdateProfileField(fieldId: string, formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyProfileFieldUpdate(tenantId, fieldId, formData);
  revalidatePath("/perfil");
  redirectBack("/painel/customizacao", error);
}

export async function ownerDeleteProfileField(fieldId: string) {
  const { tenantId } = await requireTenantOwner();
  await removeProfileField(tenantId, fieldId);
  revalidatePath("/perfil");
  redirectBack("/painel/customizacao");
}

export async function ownerReorderProfileFields(orderedIds: string[]) {
  const { tenantId } = await requireTenantOwner();
  await reorderProfileFields(tenantId, orderedIds);
  revalidatePath("/perfil");
  revalidatePath("/painel/customizacao");
}

// ---------- Missões ----------

export async function ownerCreateMission(formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  await insertMission(tenantId, formData);
  revalidatePath("/painel/missoes");
}

export async function ownerUpdateMission(missionId: string, formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  await applyMissionUpdate(tenantId, missionId, formData);
  revalidatePath("/painel/missoes");
}

export async function ownerDeleteMission(missionId: string) {
  const { tenantId } = await requireTenantOwner();
  await removeMission(tenantId, missionId);
  revalidatePath("/painel/missoes");
}

// ---------- Loja (rewards) ----------

export async function ownerCreateReward(formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  await insertReward(tenantId, formData);
  revalidatePath("/painel/loja");
}

export async function ownerUpdateReward(rewardId: string, formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  await applyRewardUpdate(tenantId, rewardId, formData);
  revalidatePath("/painel/loja");
}

export async function ownerDeleteReward(rewardId: string) {
  const { tenantId } = await requireTenantOwner();
  await removeReward(tenantId, rewardId);
  revalidatePath("/painel/loja");
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

export async function ownerChangePlan(formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  const plan = String(formData.get("plan") ?? "");
  const billingType = String(formData.get("billing_type") ?? "PIX").toUpperCase() as BillingType;

  if (!["starter", "pro", "premium"].includes(plan)) {
    redirectBack("/painel/assinatura", "Plano inválido.");
  }

  try {
    await changeTenantPlan(tenantId, plan, billingType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao trocar plano.";
    redirectBack("/painel/assinatura", msg);
  }

  redirectBack("/painel/assinatura");
}

export async function ownerCancelSubscription() {
  const { tenantId } = await requireTenantOwner();
  await cancelTenantSubscription(tenantId);
  redirectBack("/painel/assinatura");
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

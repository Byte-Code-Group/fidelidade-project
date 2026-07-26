"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { conectarAsaas, desconectarAsaas } from "@/lib/tenant-asaas";
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
  insertDocumentTemplate,
  applyDocumentTemplateUpdate,
  removeDocumentTemplate,
  reorderDocumentTemplates,
} from "@/lib/document-templates";
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
import {
  insertProvider,
  applyProviderUpdate,
  removeProvider,
  reorderProviders,
  insertProviderSchedule,
  removeProviderSchedule,
  copyProviderScheduleDay,
  insertScheduleException,
  removeScheduleException,
} from "@/lib/providers";
import {
  insertProcedure,
  applyProcedureUpdate,
  removeProcedure,
  reorderProcedures,
  listProcedures,
} from "@/lib/procedures";
import {
  horariosDisponiveis,
  createAppointmentValidado,
  rescheduleAppointment,
  setAppointmentStatus,
  removeAppointment,
} from "@/lib/appointments";
import { getTenantTimezone, applyTenantTimezoneUpdate } from "@/lib/tenant-settings";
import type { AppointmentStatus } from "@/lib/types";
import { traduzirErroDesconhecido } from "@/lib/error-messages";

// Agenda do painel + agendamentos do portal do cliente saem do mesmo dado.
function revalidateAgenda() {
  revalidatePath("/painel/agenda");
  revalidatePath("/painel/agenda/configuracoes");
  revalidatePath("/agendamentos");
}

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

// ---------- Documentos (document_templates) ----------

export async function ownerCreateDocumentTemplate(formData: FormData): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertDocumentTemplate(tenantId, formData);
  revalidatePath("/painel/documentos");
  return { error };
}

export async function ownerUpdateDocumentTemplate(
  templateId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyDocumentTemplateUpdate(tenantId, templateId, formData);
  revalidatePath("/painel/documentos");
  return { error };
}

export async function ownerDeleteDocumentTemplate(templateId: string): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeDocumentTemplate(tenantId, templateId);
  revalidatePath("/painel/documentos");
  return { error };
}

export async function ownerReorderDocumentTemplates(orderedIds: string[]): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await reorderDocumentTemplates(tenantId, orderedIds);
  revalidatePath("/painel/documentos");
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

// Define o total de pontos de forma absoluta (o dono corrige o saldo direto,
// não só somando/subtraindo).
export async function ownerSetMemberPoints(membershipId: string, formData: FormData) {
  const { tenantId } = await requireTenantOwner();
  const raw = Number(formData.get("points") ?? NaN);
  if (!Number.isFinite(raw)) return;
  const points = Math.max(0, Math.round(raw));

  const db = createAdminClient();
  await db
    .from("memberships")
    .update({ points_total: points })
    .eq("id", membershipId)
    .eq("tenant_id", tenantId);
  revalidatePath("/painel/clientes/[id]", "page");
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
    const msg = traduzirErroDesconhecido(err, "Erro ao trocar plano.");
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

// ---------- Agenda: profissionais ----------

export async function ownerCreateProvider(formData: FormData): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertProvider(tenantId, formData);
  revalidateAgenda();
  return { error };
}

export async function ownerUpdateProvider(
  providerId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyProviderUpdate(tenantId, providerId, formData);
  revalidateAgenda();
  return { error };
}

export async function ownerDeleteProvider(providerId: string): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeProvider(tenantId, providerId);
  revalidateAgenda();
  return { error };
}

export async function ownerReorderProviders(orderedIds: string[]): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await reorderProviders(tenantId, orderedIds);
  revalidateAgenda();
  return { error };
}

// ---------- Agenda: horários de trabalho ----------

export async function ownerCreateProviderSchedule(
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertProviderSchedule(tenantId, formData);
  revalidateAgenda();
  return { error };
}

export async function ownerDeleteProviderSchedule(
  scheduleId: string,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeProviderSchedule(tenantId, scheduleId);
  revalidateAgenda();
  return { error };
}

export async function ownerCopyProviderScheduleDay(
  providerId: string,
  origem: number,
  destinos: number[],
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await copyProviderScheduleDay(tenantId, providerId, origem, destinos);
  revalidateAgenda();
  return { error };
}

// ---------- Agenda: folgas e bloqueios ----------

export async function ownerCreateScheduleException(
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertScheduleException(tenantId, formData);
  revalidateAgenda();
  return { error };
}

export async function ownerDeleteScheduleException(
  exceptionId: string,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeScheduleException(tenantId, exceptionId);
  revalidateAgenda();
  return { error };
}

// ---------- Agenda: procedimentos ----------

export async function ownerCreateProcedure(formData: FormData): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await insertProcedure(tenantId, formData);
  revalidateAgenda();
  return { error };
}

export async function ownerUpdateProcedure(
  procedureId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyProcedureUpdate(tenantId, procedureId, formData);
  revalidateAgenda();
  return { error };
}

export async function ownerDeleteProcedure(procedureId: string): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeProcedure(tenantId, procedureId);
  revalidateAgenda();
  return { error };
}

export async function ownerReorderProcedures(orderedIds: string[]): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await reorderProcedures(tenantId, orderedIds);
  revalidateAgenda();
  return { error };
}

// ---------- Agenda: fuso do negócio ----------

export async function ownerUpdateTimezone(formData: FormData): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await applyTenantTimezoneUpdate(
    tenantId,
    String(formData.get("timezone") ?? ""),
  );
  revalidateAgenda();
  return { error };
}

// ---------- Agenda: agendamentos ----------

/** Horários livres de um profissional numa data — alimenta o seletor de horário. */
export async function ownerAvailableSlots(
  providerId: string,
  procedureId: string | null,
  dateISO: string,
  ignorarAppointmentId?: string,
): Promise<{ slots?: string[]; error?: string }> {
  const { tenantId } = await requireTenantOwner();
  if (!providerId || !dateISO) return { slots: [] };

  const [timeZone, procedures] = await Promise.all([
    getTenantTimezone(tenantId),
    procedureId ? listProcedures(tenantId) : Promise.resolve([]),
  ]);
  const duracao = procedureId
    ? procedures.find((p) => p.id === procedureId)?.duration_min ?? 30
    : 30;

  const slots = await horariosDisponiveis({
    tenantId,
    dateISO,
    providerId,
    duracao,
    timeZone,
    ignorarAppointmentId,
  });
  return { slots };
}

export async function ownerCreateAppointment(
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const timeZone = await getTenantTimezone(tenantId);
  const { error } = await createAppointmentValidado(tenantId, formData, {
    timeZone,
    // created_by referencia public.users; o dono vive em platform_users, então
    // fica null (a autoria do lado do painel é implícita).
    createdBy: null,
  });
  if (!error) revalidateAgenda();
  return { error };
}

export async function ownerRescheduleAppointment(
  appointmentId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const timeZone = await getTenantTimezone(tenantId);
  const { error } = await rescheduleAppointment(tenantId, appointmentId, formData, {
    timeZone,
  });
  revalidateAgenda();
  return { error };
}

export async function ownerSetAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await setAppointmentStatus(tenantId, appointmentId, status);
  revalidateAgenda();
  return { error };
}

export async function ownerDeleteAppointment(
  appointmentId: string,
): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const { error } = await removeAppointment(tenantId, appointmentId);
  revalidateAgenda();
  return { error };
}

// ---------- Conta Asaas do próprio negócio ----------
// Recebe as assinaturas dos clientes finais. A chave chega aqui do form e vai
// cifrada pro banco — nunca volta pro browser (ver lib/tenant-asaas.ts).

export async function ownerConnectAsaas(
  apiKey: string,
  environment: "sandbox" | "production",
): Promise<{ error?: string; accountName?: string; aviso?: string }> {
  const { tenantId, user } = await requireTenantOwner();
  const resultado = await conectarAsaas(tenantId, apiKey, environment, {
    ownerEmail: user.email,
  });
  revalidatePath("/painel/conexoes");
  return resultado;
}

export async function ownerDisconnectAsaas(): Promise<{ error?: string }> {
  const { tenantId } = await requireTenantOwner();
  const resultado = await desconectarAsaas(tenantId);
  revalidatePath("/painel/conexoes");
  return resultado;
}

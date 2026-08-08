"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAdmin, requirePlatformAdmin } from "@/lib/superadmin";
import { SEGMENT_TEMPLATES, modulesEnabledFromTemplate } from "@/lib/segment-templates";
import { applyTenantSettingsUpdate, applyTenantLogoUpload } from "@/lib/tenant-settings";
import { insertMission, applyMissionUpdate, removeMission } from "@/lib/missions";
import { insertReward, applyRewardUpdate, removeReward } from "@/lib/rewards";
import { insertPlan, applyPlanUpdate, removePlan } from "@/lib/plans";
import {
  approveRedemption as approveRedemptionCore,
  rejectRedemption as rejectRedemptionCore,
} from "@/lib/reward-redemptions";
import {
  insertProfileField,
  applyProfileFieldUpdate,
  removeProfileField,
} from "@/lib/profile-fields";
import { cancelTenantSubscription } from "@/lib/tenant-billing";
import { garantirWebhookDaPlataforma } from "@/lib/asaas-webhook";
import { approveCompletion, rejectCompletion } from "@/lib/mission-validations";
import { createCustomer, createSubscription } from "@/lib/asaas";
import { addVercelDomain, removeVercelDomain } from "@/lib/vercel-domains";
import { BUCKETS, documentPath } from "@/lib/storage";
import { traduzirErro, traduzirErroDesconhecido } from "@/lib/error-messages";
import { enviarLinkDeRecuperacao } from "@/lib/password-reset";
import { siteUrl } from "@/lib/urls";

// ---------- Auth ----------

export async function superSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/superadmin/login?error=${encodeURIComponent(traduzirErro(error.message))}`);
  }

  // Autenticou — mas é platform admin? Senão, desloga e barra.
  const admin = await getPlatformAdmin();
  if (!admin) {
    await supabase.auth.signOut();
    redirect(
      `/superadmin/login?error=${encodeURIComponent("Acesso restrito à plataforma.")}`,
    );
  }
  redirect("/superadmin");
}

export async function requestSuperadminPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/superadmin/esqueci-senha?error=" + encodeURIComponent("Informe o e-mail."));
  }

  // Pelo Resend, com o template da plataforma — não pelo e-mail padrão da
  // Supabase (ver lib/password-reset.ts).
  const resultado = await enviarLinkDeRecuperacao({
    email,
    origin: siteUrl(),
    destino: "/superadmin/redefinir-senha",
  });

  if (!resultado.ok && "error" in resultado) {
    redirect("/superadmin/esqueci-senha?error=" + encodeURIComponent(traduzirErro(resultado.error)));
  }
  redirect("/superadmin/esqueci-senha?sent=1");
}

export async function superSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/superadmin/login");
}

// ---------- Tenants ----------

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function createTenant(formData: FormData) {
  await requirePlatformAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? name));
  const segment = String(formData.get("segment_template") ?? "generico");
  if (!name || !slug) {
    redirect(
      `/superadmin/tenants/new?error=${encodeURIComponent("Nome e slug são obrigatórios.")}`,
    );
  }

  const tpl = SEGMENT_TEMPLATES[segment] ?? SEGMENT_TEMPLATES.generico;
  const db = createAdminClient();

  const { data: tenant, error: tErr } = await db
    .from("tenants")
    .insert({ name, slug, segment_template: segment, status: "active" })
    .select("id")
    .single<{ id: string }>();

  if (tErr || !tenant) {
    const msg = tErr?.code === "23505" ? "Slug já em uso." : traduzirErro(tErr?.message, "Erro ao criar cliente.");
    redirect(
      `/superadmin/tenants/new?error=${encodeURIComponent(msg ?? "Erro ao criar.")}`,
    );
  }

  // Settings com os defaults do segmento (marca, IA, fidelidade, recompensa).
  const d = tpl.defaults;
  const { error: sErr } = await db.from("tenant_settings").insert({
    tenant_id: tenant.id,
    label_client: tpl.label_client,
    label_appointment: tpl.label_appointment,
    modules_enabled: modulesEnabledFromTemplate(segment),
    primary_color: d.primary_color,
    secondary_color: d.secondary_color,
    theme_mode: d.theme_mode,
    ai_name: d.ai_name,
    ai_welcome_message: d.ai_welcome_message,
    reward_name: d.reward_name,
    reward_description: d.reward_description,
    loyalty_goal: d.loyalty_goal,
    loyalty_frequency: d.loyalty_frequency,
  });
  if (sErr) {
    // rollback do tenant para não deixar órfão sem settings
    await db.from("tenants").delete().eq("id", tenant.id);
    redirect(
      `/superadmin/tenants/new?error=${encodeURIComponent(traduzirErro(sErr.message))}`,
    );
  }

  // Campos de cadastro padrão do segmento (Perfil do cliente).
  if (tpl.profileFields?.length) {
    await db.from("profile_fields").insert(
      tpl.profileFields.map((f, i) => ({
        tenant_id: tenant.id,
        label: f.label,
        field_key: f.field_key,
        field_type: f.field_type,
        options: f.options ?? null,
        required: f.required ?? false,
        max_length: f.max_length ?? null,
        display_order: i + 1,
      })),
    );
  }

  revalidatePath("/superadmin");
  redirect(`/superadmin/tenants/${tenant.id}`);
}

export async function updateTenantCore(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const name = String(formData.get("name") ?? "").trim();
  const newDomain = String(formData.get("custom_domain") ?? "").trim() || null;
  const ownerEmail = String(formData.get("owner_email") ?? "").trim();
  const ownerCpfCnpj = String(formData.get("owner_cpf_cnpj") ?? "").trim();

  const { data: prev } = await db
    .from("tenants")
    .select("custom_domain")
    .eq("id", tenantId)
    .maybeSingle<{ custom_domain: string | null }>();
  const oldDomain = prev?.custom_domain ?? null;

  const { error } = await db
    .from("tenants")
    .update({
      name,
      slug: slugify(name),
      custom_domain: newDomain,
      owner_email: ownerEmail || null,
      owner_cpf_cnpj: ownerCpfCnpj || null,
      saas_plan: String(formData.get("saas_plan") ?? "starter"),
      status: String(formData.get("status") ?? "pending"),
    })
    .eq("id", tenantId);

  if (!error && oldDomain !== newDomain) {
    if (oldDomain) await removeVercelDomain(oldDomain);
    if (newDomain) await addVercelDomain(newDomain);
  }

  redirectBack(tenantId, error ? traduzirErro(error.message) : undefined);
}

export async function updateTenantSettings(
  tenantId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  const { error } = await applyTenantSettingsUpdate(tenantId, formData);
  redirectBack(tenantId, error);
}

export async function uploadLogo(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const { error } = await applyTenantLogoUpload(tenantId, formData);
  redirectBack(tenantId, error);
}

function redirectBack(tenantId: string, error?: string) {
  revalidatePath(`/superadmin/tenants/${tenantId}`);
  const qs = error ? `?error=${encodeURIComponent(error)}` : "?saved=1";
  redirect(`/superadmin/tenants/${tenantId}${qs}`);
}

// Rotaciona o token de check-in (invalida o QR antigo).
export async function rotateCheckinToken(tenantId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("tenants")
    .update({ checkin_token: crypto.randomUUID() })
    .eq("id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/checkin`);
}

// ---------- Missões (por tenant) ----------

export async function createMission(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const { error } = await insertMission(tenantId, formData);
  revalidatePath(`/superadmin/tenants/${tenantId}/missions`);
  return { error };
}

export async function updateMission(
  tenantId: string,
  missionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const { error } = await applyMissionUpdate(tenantId, missionId, formData);
  revalidatePath(`/superadmin/tenants/${tenantId}/missions`);
  return { error };
}

export async function deleteMission(
  tenantId: string,
  missionId: string,
): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const { error } = await removeMission(tenantId, missionId);
  revalidatePath(`/superadmin/tenants/${tenantId}/missions`);
  return { error };
}

// ---------- Planos do negócio (por tenant) ----------

export async function createPlan(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  await insertPlan(tenantId, formData);
  revalidatePath(`/superadmin/tenants/${tenantId}/plans`);
}

export async function updatePlan(
  tenantId: string,
  planId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  await applyPlanUpdate(tenantId, planId, formData);
  revalidatePath(`/superadmin/tenants/${tenantId}/plans`);
}

export async function deletePlan(tenantId: string, planId: string) {
  await requirePlatformAdmin();
  await removePlan(tenantId, planId);
  revalidatePath(`/superadmin/tenants/${tenantId}/plans`);
}

// ---------- Loja de Resgate: recompensas (por tenant) ----------

export async function createReward(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  await insertReward(tenantId, formData);
  revalidatePath(`/superadmin/tenants/${tenantId}/rewards`);
}

export async function updateReward(
  tenantId: string,
  rewardId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  await applyRewardUpdate(tenantId, rewardId, formData);
  revalidatePath(`/superadmin/tenants/${tenantId}/rewards`);
}

export async function deleteReward(tenantId: string, rewardId: string) {
  await requirePlatformAdmin();
  await removeReward(tenantId, rewardId);
  revalidatePath(`/superadmin/tenants/${tenantId}/rewards`);
}

// ---------- Resgates (reward_redemptions) ----------

export async function approveRedemption(tenantId: string, redemptionId: string) {
  await requirePlatformAdmin();
  await approveRedemptionCore(tenantId, redemptionId);
  revalidatePath(`/superadmin/tenants/${tenantId}/redemptions`);
  revalidatePath("/superadmin");
}

export async function rejectRedemption(tenantId: string, redemptionId: string) {
  await requirePlatformAdmin();
  await rejectRedemptionCore(tenantId, redemptionId);
  revalidatePath(`/superadmin/tenants/${tenantId}/redemptions`);
  revalidatePath("/superadmin");
}

// ---------- Validação de missões ----------

export async function approveMissionCompletion(
  tenantId: string,
  completionId: string,
) {
  await requirePlatformAdmin();
  await approveCompletion(tenantId, completionId);
  revalidatePath(`/superadmin/tenants/${tenantId}/validations`);
}

export async function rejectMissionCompletion(
  tenantId: string,
  completionId: string,
) {
  await requirePlatformAdmin();
  await rejectCompletion(tenantId, completionId);
  revalidatePath(`/superadmin/tenants/${tenantId}/validations`);
}

// ---------- Campos de perfil ----------

export async function createProfileField(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const { error } = await insertProfileField(tenantId, formData);
  revalidatePath(`/superadmin/tenants/${tenantId}/profile-fields`);
  return { error };
}

export async function updateProfileField(
  tenantId: string,
  fieldId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const { error } = await applyProfileFieldUpdate(tenantId, fieldId, formData);
  revalidatePath(`/superadmin/tenants/${tenantId}/profile-fields`);
  return { error };
}

export async function deleteProfileField(
  tenantId: string,
  fieldId: string,
): Promise<{ error?: string }> {
  await requirePlatformAdmin();
  const { error } = await removeProfileField(tenantId, fieldId);
  revalidatePath(`/superadmin/tenants/${tenantId}/profile-fields`);
  return { error };
}

// ---------- Planos de acompanhamento (Tratamentos) ----------

export async function createCarePlan(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title || !userId) return;
  const db = createAdminClient();
  await db.from("care_plans").insert({
    tenant_id: tenantId,
    user_id: userId,
    title,
    description,
    status: "active",
  });
  revalidatePath(`/superadmin/tenants/${tenantId}/tratamentos`);
}

export async function updateCarePlanStatus(
  tenantId: string,
  planId: string,
  status: "active" | "completed" | "paused",
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("care_plans")
    .update({ status })
    .eq("id", planId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/tratamentos`);
}

export async function deleteCarePlan(tenantId: string, planId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db.from("care_plans").delete().eq("id", planId).eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/tratamentos`);
}

export async function addCarePlanStep(
  tenantId: string,
  planId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const db = createAdminClient();
  const { data: last } = await db
    .from("care_plan_steps")
    .select("display_order")
    .eq("care_plan_id", planId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle<{ display_order: number }>();
  await db.from("care_plan_steps").insert({
    care_plan_id: planId,
    tenant_id: tenantId,
    title,
    notes: String(formData.get("notes") ?? "").trim() || null,
    display_order: (last?.display_order ?? 0) + 1,
  });
  revalidatePath(`/superadmin/tenants/${tenantId}/tratamentos`);
}

export async function markStepDone(
  tenantId: string,
  stepId: string,
  done: boolean,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("care_plan_steps")
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq("id", stepId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/tratamentos`);
}

export async function deleteCarePlanStep(tenantId: string, stepId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db.from("care_plan_steps").delete().eq("id", stepId).eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/tratamentos`);
}

// ---------- Agendamentos ----------

export async function createAppointment(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  const title = String(formData.get("title") ?? "").trim();
  const scheduledAt = String(formData.get("scheduled_at") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  if (!title || !scheduledAt || !userId) return;
  await db.from("appointments").insert({
    tenant_id: tenantId,
    user_id: userId,
    title,
    scheduled_at: scheduledAt,
    notes,
    status: "scheduled",
  });
  revalidatePath(`/superadmin/tenants/${tenantId}/agenda`);
}

export async function updateAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  status: "completed" | "cancelled",
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/agenda`);
}

export async function deleteAppointment(tenantId: string, appointmentId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/agenda`);
}

// ---------- Documentos ----------

const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_DOC_SIZE = 10 * 1024 * 1024; // 10 MB

export async function createDocument(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  const title = String(formData.get("title") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  const category = String(formData.get("category") ?? "documentos");
  if (!title || !userId) return;

  const file = formData.get("file");

  let fileUrl: string;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_DOC_TYPES.includes(file.type)) {
      throw new Error("Tipo de arquivo não permitido.");
    }
    if (file.size > MAX_DOC_SIZE) {
      throw new Error("Arquivo maior que 10 MB.");
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = documentPath(tenantId, userId, "upload", ext);
    const { error: upErr } = await db.storage
      .from(BUCKETS.documents)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw new Error(traduzirErro(upErr.message));
    fileUrl = path;
  } else {
    return; // sem arquivo = noop
  }

  await db.from("documents").insert({
    tenant_id: tenantId,
    user_id: userId,
    category,
    title,
    file_url: fileUrl,
    source: "upload",
  });
  revalidatePath(`/superadmin/tenants/${tenantId}/documentos`);
}

export async function deleteDocument(tenantId: string, documentId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const { data: doc } = await db
    .from("documents")
    .select("file_url")
    .eq("id", documentId)
    .eq("tenant_id", tenantId)
    .single();

  await db
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("tenant_id", tenantId);

  // Remove do Storage se for path interno (não URL externa)
  if (doc?.file_url && !doc.file_url.startsWith("http")) {
    await db.storage.from(BUCKETS.documents).remove([doc.file_url]);
  }

  revalidatePath(`/superadmin/tenants/${tenantId}/documentos`);
}

// ---------- Parcerias ----------

function partnershipFields(formData: FormData) {
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: text("description"),
    logo_url: text("logo_url"),
    discount_text: text("discount_text"),
    website_url: text("website_url"),
    is_active: formData.get("is_active") === "on",
    display_order: Number(formData.get("display_order") ?? 0),
  };
}

export async function createPartnership(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const fields = partnershipFields(formData);
  if (!fields.name) return;
  const db = createAdminClient();
  await db.from("partnerships").insert({ tenant_id: tenantId, ...fields });
  revalidatePath(`/superadmin/tenants/${tenantId}/partnerships`);
}

export async function updatePartnership(
  tenantId: string,
  partnershipId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("partnerships")
    .update(partnershipFields(formData))
    .eq("id", partnershipId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/partnerships`);
}

export async function deletePartnership(
  tenantId: string,
  partnershipId: string,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("partnerships")
    .delete()
    .eq("id", partnershipId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/partnerships`);
}

// ---------- Billing (Asaas) ----------

export async function activateTenantBilling(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();

  if (!process.env.ASAAS_API_KEY) {
    redirect(
      `/superadmin/tenants/${tenantId}?error=${encodeURIComponent("ASAAS_API_KEY não configurada.")}`,
    );
  }

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("name, owner_email, owner_cpf_cnpj, saas_plan, asaas_customer_id")
    .eq("id", tenantId)
    .maybeSingle<{
      name: string;
      owner_email: string | null;
      owner_cpf_cnpj: string | null;
      saas_plan: string;
      asaas_customer_id: string | null;
    }>();

  if (!tenant) redirect(`/superadmin/tenants/${tenantId}?error=Tenant+não+encontrado.`);
  if (!tenant.owner_email) {
    redirect(
      `/superadmin/tenants/${tenantId}?error=${encodeURIComponent("Preencha o e-mail do responsável antes de ativar o billing.")}`,
    );
  }
  if (!tenant.owner_cpf_cnpj) {
    redirect(
      `/superadmin/tenants/${tenantId}?error=${encodeURIComponent("Preencha o CPF/CNPJ do responsável antes de ativar o billing.")}`,
    );
  }

  try {
    // Reusa cliente existente ou cria novo
    let customerId = tenant.asaas_customer_id;
    if (!customerId) {
      const customer = await createCustomer({
        name: tenant.name,
        email: tenant.owner_email,
        cpfCnpj: tenant.owner_cpf_cnpj,
      });
      customerId = customer.id;
    }

    const rawBillingType = String(formData.get("billing_type") ?? "PIX").toUpperCase();
    const billingType = (["PIX", "BOLETO", "CREDIT_CARD"].includes(rawBillingType)
      ? rawBillingType
      : "PIX") as import("@/lib/asaas").BillingType;

    const subscription = await createSubscription({
      customer: customerId,
      plan: tenant.saas_plan,
      email: tenant.owner_email,
      billingType,
    });

    await db
      .from("tenants")
      .update({
        asaas_customer_id: customerId,
        asaas_subscription_id: subscription.id,
        status: "active",
      })
      .eq("id", tenantId);
  } catch (err) {
    const msg = traduzirErroDesconhecido(err, "Erro ao criar assinatura.");
    redirect(`/superadmin/tenants/${tenantId}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/superadmin/tenants/${tenantId}`);
  revalidatePath("/superadmin");
  redirect(`/superadmin/tenants/${tenantId}?saved=1`);
}

export async function cancelTenantBilling(tenantId: string) {
  await requirePlatformAdmin();
  // Super Admin pode cancelar a qualquer momento, sem esperar o fim do
  // período pago — diferente do dono, que precisa esperar (ver painel).
  await cancelTenantSubscription(tenantId, { force: true });

  revalidatePath(`/superadmin/tenants/${tenantId}`);
  revalidatePath("/superadmin");
  redirect(`/superadmin/tenants/${tenantId}?saved=1`);
}

// ---------- Integração Asaas (conta da plataforma) ----------

// Cria (ou conserta) o webhook que ativa o portal do dono quando a mensalidade
// é paga. Roda no servidor porque é lá que a ASAAS_API_KEY existe — as env
// vars são "sensitive" na Vercel e não saem de lá nem pelo CLI.
export async function repararWebhookDaPlataforma(formData?: FormData) {
  await requirePlatformAdmin();

  // "forcar" regrava a configuração mesmo com o webhook saudável — o token não
  // é verificável pela consulta (o Asaas devolve null), então é assim que se
  // sincroniza o ASAAS_WEBHOOK_TOKEN quando a rota está rejeitando com 401.
  const forcar = formData?.get("forcar") === "1";
  const { acao, erro } = await garantirWebhookDaPlataforma({ forcar });

  const destino = "/superadmin/faturamento";
  if (erro) redirect(`${destino}?error=${encodeURIComponent(erro)}`);

  revalidatePath(destino);
  const mensagem =
    acao === "criado"
      ? "Webhook criado no Asaas."
      : acao === "corrigido"
        ? "Webhook atualizado no Asaas."
        : "Webhook já estava correto.";
  redirect(`${destino}?ok=${encodeURIComponent(mensagem)}`);
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlatformAdmin, requirePlatformAdmin } from "@/lib/superadmin";
import {
  SEGMENT_TEMPLATES,
  modulesEnabledFromTemplate,
  clampModulesToTemplate,
  MODULES,
} from "@/lib/segment-templates";

// ---------- Auth ----------

export async function superSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect(`/superadmin/login?error=${encodeURIComponent(error.message)}`);
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
    .insert({ name, slug, segment_template: segment })
    .select("id")
    .single<{ id: string }>();

  if (tErr || !tenant) {
    const msg = tErr?.code === "23505" ? "Slug já em uso." : tErr?.message;
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
      `/superadmin/tenants/new?error=${encodeURIComponent(sErr.message)}`,
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
  const customDomain = String(formData.get("custom_domain") ?? "").trim();
  const { error } = await db
    .from("tenants")
    .update({
      name,
      slug: slugify(name), // subdomínio derivado automaticamente do nome
      custom_domain: customDomain || null,
      saas_plan: String(formData.get("saas_plan") ?? "starter"),
      status: String(formData.get("status") ?? "trial"),
    })
    .eq("id", tenantId);

  redirectBack(tenantId, error?.message);
}

export async function updateTenantSettings(
  tenantId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();

  // Módulos: checkboxes presentes no form viram true, mas SEMPRE limitados ao
  // teto do template do tenant — não dá pra ativar módulo que o template não tem.
  const { data: t } = await db
    .from("tenants")
    .select("segment_template")
    .eq("id", tenantId)
    .maybeSingle<{ segment_template: string }>();

  const desired = Object.fromEntries(
    MODULES.map((m) => [m.key, formData.get(`module_${m.key}`) === "on"]),
  );
  const modules_enabled = clampModulesToTemplate(
    t?.segment_template ?? "generico",
    desired,
  );

  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const { error } = await db
    .from("tenant_settings")
    .update({
      // Visual
      logo_url: text("logo_url"),
      primary_color: String(formData.get("primary_color") ?? "#2563eb"),
      secondary_color: String(formData.get("secondary_color") ?? "#1e40af"),
      theme_mode: String(formData.get("theme_mode") ?? "light"),
      // Labels
      label_client: String(formData.get("label_client") ?? "Cliente"),
      label_appointment: String(
        formData.get("label_appointment") ?? "Agendamento",
      ),
      // Persona IA
      ai_name: String(formData.get("ai_name") ?? "Assistente"),
      ai_welcome_message: text("ai_welcome_message"),
      ai_tone: String(formData.get("ai_tone") ?? "amigavel"),
      // Rodapé
      footer_address: text("footer_address"),
      footer_phone: text("footer_phone"),
      footer_whatsapp: text("footer_whatsapp"),
      footer_website: text("footer_website"),
      // Módulos
      modules_enabled,
      // Fidelidade
      loyalty_goal: Number(formData.get("loyalty_goal") ?? 6),
      loyalty_frequency: String(formData.get("loyalty_frequency") ?? "monthly"),
      loyalty_points_per_checkin: Number(
        formData.get("loyalty_points_per_checkin") ?? 1,
      ),
      loyalty_streak_reset: formData.get("loyalty_streak_reset") === "on",
      // Recompensa
      reward_name: text("reward_name"),
      reward_description: text("reward_description"),
    })
    .eq("tenant_id", tenantId);

  redirectBack(tenantId, error?.message);
}

// Upload do logo da empresa para o Storage (bucket público 'branding') e grava a
// URL pública em tenant_settings.logo_url. Service role → bypassa RLS.
export async function uploadLogo(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    redirectBack(tenantId, "Selecione um arquivo de imagem.");
    return;
  }

  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    redirectBack(tenantId, "Formato não suportado (use PNG, JPG, WEBP ou SVG).");
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    redirectBack(tenantId, "Imagem muito grande (máx. 2MB).");
    return;
  }

  const db = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${tenantId}/logo-${Date.now()}.${ext}`;

  const { error: upErr } = await db.storage
    .from("branding")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) {
    redirectBack(tenantId, upErr.message);
    return;
  }

  const { data: pub } = db.storage.from("branding").getPublicUrl(path);
  const { error } = await db
    .from("tenant_settings")
    .update({ logo_url: pub.publicUrl })
    .eq("tenant_id", tenantId);

  redirectBack(tenantId, error?.message);
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

const SOCIAL_KEYS = ["instagram", "facebook", "youtube", "x"];

function missionFields(formData: FormData) {
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  // Rede social (se escolhida) vira o ícone → renderiza o logo no portal.
  const social = String(formData.get("social") ?? "");
  const icon = SOCIAL_KEYS.includes(social) ? social : text("icon");
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: text("description"),
    icon,
    type: String(formData.get("type") ?? "custom"),
    external_url: text("external_url"),
    points: Number(formData.get("points") ?? 0),
    requires_validation: formData.get("requires_validation") === "on",
    is_active: formData.get("is_active") === "on",
    display_order: Number(formData.get("display_order") ?? 0),
  };
}

export async function createMission(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const fields = missionFields(formData);
  if (!fields.title) return;
  const db = createAdminClient();
  await db.from("missions").insert({ tenant_id: tenantId, ...fields });
  revalidatePath(`/superadmin/tenants/${tenantId}/missions`);
}

export async function updateMission(
  tenantId: string,
  missionId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("missions")
    .update(missionFields(formData))
    .eq("id", missionId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/missions`);
}

export async function deleteMission(tenantId: string, missionId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("missions")
    .delete()
    .eq("id", missionId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/missions`);
}

// ---------- Planos do negócio (por tenant) ----------

function planFields(formData: FormData) {
  const benefits = String(formData.get("benefits") ?? "")
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  return {
    name: String(formData.get("name") ?? "").trim(),
    price_month: Number(formData.get("price_month") ?? 0),
    benefits,
    is_popular: formData.get("is_popular") === "on",
    upgrade_discount_pct: Number(formData.get("upgrade_discount_pct") ?? 0),
    display_order: Number(formData.get("display_order") ?? 0),
  };
}

export async function createPlan(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const fields = planFields(formData);
  if (!fields.name) return;
  const db = createAdminClient();
  await db.from("business_plans").insert({ tenant_id: tenantId, ...fields });
  revalidatePath(`/superadmin/tenants/${tenantId}/plans`);
}

export async function updatePlan(
  tenantId: string,
  planId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("business_plans")
    .update(planFields(formData))
    .eq("id", planId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/plans`);
}

export async function deletePlan(tenantId: string, planId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("business_plans")
    .delete()
    .eq("id", planId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/plans`);
}

// ---------- Loja de Resgate: recompensas (por tenant) ----------

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
    display_order: Number(formData.get("display_order") ?? 0),
  };
}

export async function createReward(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const fields = rewardFields(formData);
  if (!fields.name) return;
  const db = createAdminClient();
  await db.from("rewards").insert({ tenant_id: tenantId, ...fields });
  revalidatePath(`/superadmin/tenants/${tenantId}/rewards`);
}

export async function updateReward(
  tenantId: string,
  rewardId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("rewards")
    .update(rewardFields(formData))
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/rewards`);
}

export async function deleteReward(tenantId: string, rewardId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("rewards")
    .delete()
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/rewards`);
}

// ---------- Resgates (reward_redemptions) ----------

export async function approveRedemption(tenantId: string, redemptionId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("reward_redemptions")
    .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
    .eq("id", redemptionId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/redemptions`);
  revalidatePath("/superadmin");
}

export async function rejectRedemption(tenantId: string, redemptionId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();

  // Devolve os pontos gastos ao cliente.
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

    if (membership) {
      await db
        .from("memberships")
        .update({ points_total: membership.points_total + r.points_spent })
        .eq("id", membership.id);
    }
  }

  await db
    .from("reward_redemptions")
    .delete()
    .eq("id", redemptionId)
    .eq("tenant_id", tenantId);

  revalidatePath(`/superadmin/tenants/${tenantId}/redemptions`);
  revalidatePath("/superadmin");
}

// ---------- Validação de missões ----------

export async function approveMissionCompletion(
  tenantId: string,
  completionId: string,
) {
  await requirePlatformAdmin();
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

  // Credita os pontos da missão na carteirinha.
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

  revalidatePath(`/superadmin/tenants/${tenantId}/validations`);
}

export async function rejectMissionCompletion(
  tenantId: string,
  completionId: string,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("mission_completions")
    .delete()
    .eq("id", completionId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/validations`);
}

// ---------- Campos de perfil ----------

function profileFieldData(formData: FormData) {
  const optionsRaw = String(formData.get("options") ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  return {
    label: String(formData.get("label") ?? "").trim(),
    field_key: String(formData.get("field_key") ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_"),
    field_type: String(formData.get("field_type") ?? "text"),
    options: optionsRaw.length > 0 ? optionsRaw : null,
    required: formData.get("required") === "on",
    display_order: Number(formData.get("display_order") ?? 0),
  };
}

export async function createProfileField(tenantId: string, formData: FormData) {
  await requirePlatformAdmin();
  const fields = profileFieldData(formData);
  if (!fields.label || !fields.field_key) return;
  const db = createAdminClient();
  await db.from("profile_fields").insert({ tenant_id: tenantId, ...fields });
  revalidatePath(`/superadmin/tenants/${tenantId}/profile-fields`);
}

export async function updateProfileField(
  tenantId: string,
  fieldId: string,
  formData: FormData,
) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("profile_fields")
    .update(profileFieldData(formData))
    .eq("id", fieldId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/profile-fields`);
}

export async function deleteProfileField(tenantId: string, fieldId: string) {
  await requirePlatformAdmin();
  const db = createAdminClient();
  await db
    .from("profile_fields")
    .delete()
    .eq("id", fieldId)
    .eq("tenant_id", tenantId);
  revalidatePath(`/superadmin/tenants/${tenantId}/profile-fields`);
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
    const path = `${tenantId}/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await db.storage
      .from("documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) throw new Error(upErr.message);
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
    await db.storage.from("documents").remove([doc.file_url]);
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

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenant } from "@/lib/tenant";
import { currentPeriodRef, type LoyaltyFrequency } from "@/lib/loyalty";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/emails/welcome";
import { redemptionEmail } from "@/lib/emails/redemption";
import type { Membership, Mission, MissionCompletion, ProfileField, Reward } from "@/lib/types";
import { confirmEmailTemplate } from "@/lib/emails/confirm-email";
import { validateProfileFieldValues } from "@/lib/profile-fields";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Envia e-mail de recuperação de senha. O link redireciona para /redefinir-senha
// onde o usuário (já autenticado via magic link) atualiza a senha no client.
export async function requestPasswordReset(formData: FormData) {
  const ctx = await getCurrentTenant();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/esqueci-senha?error=" + encodeURIComponent("Informe o e-mail."));
  }

  // Monta a URL de retorno respeitando o domínio do tenant.
  const origin =
    ctx
      ? `http://${ctx.tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000"}`
      : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/redefinir-senha`,
  });

  if (error) {
    redirect("/esqueci-senha?error=" + encodeURIComponent(error.message));
  }
  redirect("/esqueci-senha?sent=1");
}

// Cadastro de novo cliente no portal do tenant.
// Usa service role para criar a linha em public.users (sem policy de INSERT
// para anon) e a carteirinha inicial.
export async function signUp(formData: FormData) {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/");
  const { tenant } = ctx;

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    redirect("/cadastro?error=" + encodeURIComponent("Preencha todos os campos."));
  }
  if (password.length < 6) {
    redirect("/cadastro?error=" + encodeURIComponent("A senha precisa ter pelo menos 6 caracteres."));
  }

  const supabase = await createClient();
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (authErr || !authData.user) {
    const msg = authErr?.message ?? "Erro ao criar conta.";
    redirect("/cadastro?error=" + encodeURIComponent(msg));
  }

  const db = createAdminClient();

  // Cria linha em public.users vinculada ao tenant.
  const { error: uErr } = await db.from("users").insert({
    id: authData.user.id,
    tenant_id: tenant.id,
    role: "client",
    full_name: fullName,
    email,
  });
  if (uErr) {
    redirect("/cadastro?error=" + encodeURIComponent("Erro ao salvar cadastro."));
  }

  // Gera código único da carteirinha: SLUG-XXXXX (6 hex aleatórios).
  const suffix = Math.random().toString(16).slice(2, 8).toUpperCase();
  const memberCode = `${tenant.slug.toUpperCase().slice(0, 6)}-${suffix}`;

  await db.from("memberships").insert({
    tenant_id: tenant.id,
    user_id: authData.user.id,
    modality: "titular",
    status: "active",
    member_code: memberCode,
    points_total: 0,
  });

  const { settings } = ctx;
  const origin = `http://${tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000"}`;
  const { subject, html } = welcomeEmail({
    tenantName: tenant.name,
    primaryColor: settings.primary_color,
    memberName: fullName,
    memberCode,
    portalUrl: origin,
  });
  await sendEmail({ to: email, subject, html });
// Enviar email de confirmacao com link magic const confirmLink = `${origin}/auth/confirm`; const { subject: confirmSubject, html: confirmHtml } = confirmEmailTemplate({ tenantName: tenant.name, primaryColor: settings.primary_color, confirmLink, userName: fullName, }); await sendEmail({ to: email, subject: confirmSubject, html: confirmHtml });

  redirect("/");
}

// Cliente conclui uma missão. Server Action é endpoint público (POST direto),
// então revalidamos auth e autorização aqui, não só na UI.
export async function completeMission(missionId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Missão precisa existir, estar ativa e ser do tenant do usuário (RLS).
  const { data: mission } = await supabase
    .from("missions")
    .select("id, tenant_id, requires_validation, is_active")
    .eq("id", missionId)
    .maybeSingle<
      Pick<Mission, "id" | "tenant_id" | "requires_validation" | "is_active">
    >();
  if (!mission || !mission.is_active) return;

  // Evita conclusão duplicada (não há unique no schema p/ esse par).
  const { data: existing } = await supabase
    .from("mission_completions")
    .select("id")
    .eq("mission_id", missionId)
    .eq("user_id", user.id)
    .maybeSingle<Pick<MissionCompletion, "id">>();
  if (existing) return;

  await supabase.from("mission_completions").insert({
    tenant_id: mission.tenant_id,
    user_id: user.id,
    mission_id: missionId,
    status: mission.requires_validation ? "pending_validation" : "completed",
    completed_at: mission.requires_validation ? null : new Date().toISOString(),
  });

  revalidatePath("/engajamento");
}

// Cliente atualiza o próprio perfil: nome (tabela users, sem policy de update
// → via service role) + campos customizáveis do tenant (profile_field_values).
export async function saveProfile(formData: FormData) {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createAdminClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName) {
    await db.from("users").update({ full_name: fullName }).eq("id", user.id);
  }

  // Campos dinâmicos: chegam como field_<uuid> no form.
  const rows: {
    tenant_id: string;
    user_id: string;
    field_id: string;
    value: string;
  }[] = [];
  const valuesByField = new Map<string, string>();
  for (const [key, raw] of formData.entries()) {
    if (!key.startsWith("field_")) continue;
    const fieldId = key.slice("field_".length);
    const value = String(raw);
    valuesByField.set(fieldId, value);
    rows.push({
      tenant_id: ctx.tenant.id,
      user_id: user.id,
      field_id: fieldId,
      value,
    });
  }

  const { data: fieldDefs } = await db
    .from("profile_fields")
    .select("*")
    .eq("tenant_id", ctx.tenant.id)
    .returns<ProfileField[]>();

  const validationError = validateProfileFieldValues(fieldDefs ?? [], valuesByField);
  if (validationError) {
    redirect(`/perfil?error=${encodeURIComponent(validationError)}`);
  }

  if (rows.length > 0) {
    await db
      .from("profile_field_values")
      .upsert(rows, { onConflict: "field_id,user_id" });
  }

  revalidatePath("/perfil");
  redirect("/perfil?saved=1");
}

// Resgate de recompensa na Loja: debita pontos da carteirinha e registra a
// redenção (pendente, p/ o operador entregar). Escreve via service role.
export async function redeemReward(rewardId: string) {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const db = createAdminClient();

  const { data: reward } = await db
    .from("rewards")
    .select("*")
    .eq("id", rewardId)
    .eq("tenant_id", ctx.tenant.id)
    .maybeSingle<Reward>();
  if (!reward || !reward.is_active) redirect("/loja?error=indisponivel");
  if (reward.stock !== null && reward.stock <= 0) redirect("/loja?error=esgotado");

  const [{ data: membership }, { data: profile }] = await Promise.all([
    db
      .from("memberships")
      .select("id, points_total")
      .eq("tenant_id", ctx.tenant.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<Pick<Membership, "id" | "points_total">>(),
    db
      .from("users")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle<{ full_name: string | null; email: string | null }>(),
  ]);
  if (!membership) redirect("/loja?error=sem_carteirinha");
  if (membership.points_total < reward.points_cost) redirect("/loja?error=pontos");

  const pointsRemaining = membership.points_total - reward.points_cost;

  await db
    .from("memberships")
    .update({ points_total: pointsRemaining })
    .eq("id", membership.id);

  await db.from("reward_redemptions").insert({
    tenant_id: ctx.tenant.id,
    user_id: user.id,
    reward_id: reward.id,
    reward_name: reward.name,
    points_spent: reward.points_cost,
    status: "pending",
  });

  if (reward.stock !== null) {
    await db.from("rewards").update({ stock: reward.stock - 1 }).eq("id", reward.id);
  }

  if (profile?.email) {
    const origin = `http://${ctx.tenant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000"}`;
    const { subject, html } = redemptionEmail({
      tenantName: ctx.tenant.name,
      primaryColor: ctx.settings.primary_color,
      memberName: profile.full_name ?? profile.email,
      rewardName: reward.name,
      pointsSpent: reward.points_cost,
      pointsRemaining,
      portalUrl: origin,
    });
    await sendEmail({ to: profile.email, subject, html });
  }

  revalidatePath("/loja");
  revalidatePath("/");
  redirect("/loja?done=1");
}

// Check-in de fidelidade. Disparado pelo QR (token presencial do tenant).
// Server Action = POST público → revalida auth E o token aqui dentro.
// Escreve via service role (checkins/memberships não têm policy de escrita).
export async function doCheckin(token: string) {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/");
  const { tenant, settings } = ctx;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Token errado → não está presencialmente no local. Não vaza motivo.
  if (token !== tenant.checkin_token) {
    redirect("/checkin?error=invalid");
  }

  const period = currentPeriodRef(
    (settings.loyalty_frequency as LoyaltyFrequency) ?? "monthly",
  );
  const db = createAdminClient();

  // Insere o check-in. O unique (tenant_id,user_id,period_ref) barra repetição.
  const { error: insErr } = await db.from("checkins").insert({
    tenant_id: tenant.id,
    user_id: user.id,
    period_ref: period,
    points_earned: settings.loyalty_points_per_checkin,
    method: "qr_code",
  });

  if (insErr) {
    // 23505 = já fez check-in neste período.
    const q = insErr.code === "23505" ? "already" : "fail";
    redirect(`/checkin?token=${token}&error=${q}`);
  }

  // Credita pontos na carteirinha.
  const { data: membership } = await db
    .from("memberships")
    .select("id, points_total")
    .eq("tenant_id", tenant.id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Pick<Membership, "id" | "points_total">>();

  if (membership) {
    await db
      .from("memberships")
      .update({
        points_total: membership.points_total + settings.loyalty_points_per_checkin,
      })
      .eq("id", membership.id);
  }

  revalidatePath("/engajamento");
  revalidatePath("/");
  redirect("/checkin?done=1");
}

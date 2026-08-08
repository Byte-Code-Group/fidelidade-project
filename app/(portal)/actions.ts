"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentTenant } from "@/lib/tenant";
import { currentPeriodRef, type LoyaltyFrequency } from "@/lib/loyalty";
import { sendEmail } from "@/lib/email";
import { enviarLinkDeRecuperacao } from "@/lib/password-reset";
import { welcomeEmail } from "@/lib/emails/welcome";
import { redemptionEmail } from "@/lib/emails/redemption";
import type { Membership, Mission, MissionCompletion, ProfileField, Reward } from "@/lib/types";
import { validateProfileFieldValues } from "@/lib/profile-fields";
import { assinarPlanoComCobranca } from "@/lib/member-subscriptions";
import { changeMembershipPlan } from "@/lib/memberships";
import { traduzirErro } from "@/lib/error-messages";
import { portalUrl, siteUrl } from "@/lib/urls";
import { listProcedures } from "@/lib/procedures";
import {
  horariosDisponiveis,
  createAppointmentValidado,
  cancelAppointmentAsClient,
} from "@/lib/appointments";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(traduzirErro(error.message))}`);
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Envia e-mail de recuperação de senha pelo Resend, com o branding do negócio
// (ver lib/password-reset.ts). O link passa por /auth/recuperar, que valida o
// token e abre /redefinir-senha já com sessão.
export async function requestPasswordReset(formData: FormData) {
  const ctx = await getCurrentTenant();
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect("/esqueci-senha?error=" + encodeURIComponent("Informe o e-mail."));
  }

  // Monta a URL de retorno respeitando o domínio do tenant.
  const origin = ctx ? portalUrl(ctx.tenant.slug) : siteUrl();

  const resultado = await enviarLinkDeRecuperacao({
    email,
    origin,
    destino: "/redefinir-senha",
    brandName: ctx?.tenant.name,
    primaryColor: ctx?.settings.primary_color,
  });

  // E-mail sem conta responde igual a um cadastrado — senão a tela vira um
  // oráculo de quem é cliente do negócio.
  if (!resultado.ok && "error" in resultado) {
    redirect("/esqueci-senha?error=" + encodeURIComponent(traduzirErro(resultado.error)));
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
    const msg = traduzirErro(authErr?.message, "Erro ao criar conta.");
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

  // Gera código único da carteirinha: SLUG-XXXXX (6 hex aleatórios). O código
  // é unique no banco, então uma colisão derrubava o insert em silêncio e o
  // cliente ficava sem carteirinha — tenta de novo com outro sufixo.
  let memberCode = "";
  let membershipErr: { code?: string } | null = null;
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const suffix = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
    memberCode = `${tenant.slug.toUpperCase().slice(0, 6)}-${suffix}`;

    const { error } = await db.from("memberships").insert({
      tenant_id: tenant.id,
      user_id: authData.user.id,
      modality: "titular",
      status: "active",
      member_code: memberCode,
      points_total: 0,
    });
    membershipErr = error;
    if (!error) break;
    if (error.code !== "23505") break;
  }

  if (membershipErr) {
    console.error("[signUp] carteirinha não criada", {
      tenantId: tenant.id,
      userId: authData.user.id,
      erro: membershipErr,
    });
    redirect("/cadastro?error=" + encodeURIComponent("Erro ao criar sua carteirinha. Fale com a equipe."));
  }

  const { settings } = ctx;
  const origin = portalUrl(tenant.slug);
  const { subject, html } = welcomeEmail({
    tenantName: tenant.name,
    primaryColor: settings.primary_color,
    memberName: fullName,
    memberCode,
    portalUrl: origin,
  });
  await sendEmail({ to: email, subject, html });
  // O e-mail de confirmação é enviado pelo webhook do Supabase Auth
  // (app/api/auth/email/route.ts), não daqui.

  redirect("/");
}

// Cliente conclui uma missão. Server Action é endpoint público (POST direto),
// então revalidamos auth e autorização aqui, não só na UI.
export async function completeMission(missionId: string) {
  const supabase = await createClient();

  const user = await getAuthUser();
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

  // Evita conclusão duplicada. Quem barra de verdade é o unique
  // (mission_id, user_id) — ver 0037; esta consulta só evita ida ao banco no
  // caso comum. Dois cliques simultâneos passam os dois por aqui, e aí o
  // 23505 do insert derruba o segundo.
  const { data: existing } = await supabase
    .from("mission_completions")
    .select("id")
    .eq("mission_id", missionId)
    .eq("user_id", user.id)
    .maybeSingle<Pick<MissionCompletion, "id">>();
  if (existing) return;

  const { error: insErr } = await supabase.from("mission_completions").insert({
    tenant_id: mission.tenant_id,
    user_id: user.id,
    mission_id: missionId,
    status: mission.requires_validation ? "pending_validation" : "completed",
    completed_at: mission.requires_validation ? null : new Date().toISOString(),
  });
  if (insErr && insErr.code !== "23505") return;

  revalidatePath("/engajamento");
}

// Cliente atualiza o próprio perfil: nome (tabela users, sem policy de update
// → via service role) + campos customizáveis do tenant (profile_field_values).
export async function saveProfile(formData: FormData) {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/");

  const user = await getAuthUser();
  if (!user) redirect("/login");

  const db = createAdminClient();

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (fullName) {
    await db.from("users").update({ full_name: fullName }).eq("id", user.id);
  }

  const { data: fieldDefs } = await db
    .from("profile_fields")
    .select("*")
    .eq("tenant_id", ctx.tenant.id)
    .returns<ProfileField[]>();

  // Campos dinâmicos: chegam como field_<uuid> no form. O id vem do cliente,
  // então só vale se for campo DESTE negócio — senão dava pra gravar valor
  // preso a um campo de outro tenant só editando o HTML.
  const camposDoTenant = new Set((fieldDefs ?? []).map((f) => f.id));
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
    if (!camposDoTenant.has(fieldId)) continue;
    const value = String(raw);
    valuesByField.set(fieldId, value);
    rows.push({
      tenant_id: ctx.tenant.id,
      user_id: user.id,
      field_id: fieldId,
      value,
    });
  }

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

// Assina ou troca de plano.
//
// Com a conta Asaas do negócio conectada e plano pago, gera a cobrança na
// conta DELE e manda o cliente pra fatura (ver lib/member-subscriptions.ts).
// Sem conta conectada ou plano grátis, segue como antes: upgrade vale na
// hora, downgrade agenda pro fim do período vigente (ver lib/memberships.ts).
export async function subscribeToPlan(planId: string) {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/");

  const user = await getAuthUser();
  if (!user) redirect("/login");

  // O retorno depois do pagamento é pro portal DESTE negócio (domínio próprio
  // ou subdomínio), não pro endereço da plataforma.
  const host = (await headers()).get("host");
  const resultado = await assinarPlanoComCobranca(ctx.tenant.id, user.id, planId, {
    siteUrl: host ? `https://${host}` : process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (resultado.tipo === "erro") {
    redirect(`/planos?error=${encodeURIComponent(resultado.error)}`);
  }
  if (resultado.tipo === "cobranca") {
    revalidatePath("/planos");
    redirect(resultado.invoiceUrl);
  }

  await changeMembershipPlan(ctx.tenant.id, user.id, planId);
  revalidatePath("/planos");
}

// Resgate de recompensa na Loja: debita pontos da carteirinha e registra a
// redenção (pendente, p/ o operador entregar). Escreve via service role.
export async function redeemReward(rewardId: string) {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/");

  const user = await getAuthUser();
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

  // Debita com compare-and-swap: o update só passa se os pontos ainda forem
  // os mesmos que acabamos de ler. Sem isso, dois cliques simultâneos liam o
  // mesmo saldo e saíam com dois resgates pelo preço de um.
  const { data: debitado } = await db
    .from("memberships")
    .update({ points_total: pointsRemaining })
    .eq("id", membership.id)
    .eq("points_total", membership.points_total)
    .select("id");

  if (!debitado?.length) redirect("/loja?error=pontos");

  await db.from("reward_redemptions").insert({
    tenant_id: ctx.tenant.id,
    user_id: user.id,
    reward_id: reward.id,
    reward_name: reward.name,
    points_spent: reward.points_cost,
    status: "pending",
  });

  if (reward.stock !== null) {
    // Mesmo cuidado do saldo: sem o filtro pelo estoque lido, resgates
    // simultâneos deixavam o estoque negativo.
    await db
      .from("rewards")
      .update({ stock: reward.stock - 1 })
      .eq("id", reward.id)
      .eq("stock", reward.stock);
  }

  if (profile?.email) {
    const origin = portalUrl(ctx.tenant.slug);
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

  const user = await getAuthUser();
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

// ---------- Agendamento pelo cliente ----------

// Contexto do portal: tenant da request + cliente logado. Todo agendamento
// feito aqui é obrigatoriamente do próprio usuário.
async function requireClientContext() {
  const ctx = await getCurrentTenant();
  if (!ctx) redirect("/");
  const user = await getAuthUser();
  if (!user) redirect("/login");
  return { tenantId: ctx.tenant.id, timeZone: ctx.settings.timezone, userId: user.id };
}

export async function clientAvailableSlots(
  providerId: string,
  procedureId: string | null,
  dateISO: string,
): Promise<{ slots?: string[]; error?: string }> {
  const { tenantId, timeZone } = await requireClientContext();
  if (!providerId || !dateISO) return { slots: [] };

  const procedures = await listProcedures(tenantId, { somenteAtivos: true });
  const procedimento = procedureId ? procedures.find((p) => p.id === procedureId) : null;
  if (procedureId && !procedimento) return { error: "Procedimento não disponível." };

  const slots = await horariosDisponiveis({
    tenantId,
    dateISO,
    providerId,
    duracao: procedimento?.duration_min ?? 30,
    timeZone,
    // Dá margem para a recepção se organizar em vez de aceitar "para agora".
    // (a antecedência mínima também evita marcar um horário que vence no clique)
  });
  return { slots };
}

export async function clientBookAppointment(
  formData: FormData,
): Promise<{ error?: string }> {
  const { tenantId, timeZone, userId } = await requireClientContext();

  const { error } = await createAppointmentValidado(tenantId, formData, {
    timeZone,
    createdBy: userId,
    forcarUserId: userId,
  });
  if (error) return { error };

  revalidatePath("/agendamentos");
  revalidatePath("/painel/agenda");
  return {};
}

export async function clientCancelAppointment(
  appointmentId: string,
): Promise<{ error?: string }> {
  const { tenantId, userId } = await requireClientContext();
  const { error } = await cancelAppointmentAsClient(tenantId, userId, appointmentId);
  if (error) return { error };

  revalidatePath("/agendamentos");
  revalidatePath("/painel/agenda");
  return {};
}

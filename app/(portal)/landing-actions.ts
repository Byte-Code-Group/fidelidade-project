"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import {
  SEGMENT_TEMPLATES,
  modulesEnabledFromTemplate,
} from "@/lib/segment-templates";

const TRIAL_DAYS = 14;

const ADMIN_EMAIL = "gustavo.junio2003@gmail.com";
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "fideliza.com.br";

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function uniqueSlug(base: string): Promise<string> {
  const db = createAdminClient();
  let slug = base;
  let attempt = 0;
  while (true) {
    const { count } = await db
      .from("tenants")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);
    if (!count) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

export async function startTrial(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const business = String(formData.get("business") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!name || !email || !business || !segment) {
    redirect("/?error=campos");
  }

  const db = createAdminClient();

  // Save lead regardless of what happens next
  await db.from("leads").insert({ name, email, business, segment, phone: phone || null });

  const slug = await uniqueSlug(slugify(business));
  const tpl = SEGMENT_TEMPLATES[segment] ?? SEGMENT_TEMPLATES.generico;
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: tenant, error: tErr } = await db
    .from("tenants")
    .insert({
      name: business,
      slug,
      segment_template: segment,
      status: "trial",
      owner_email: email,
      trial_ends_at: trialEndsAt,
    })
    .select("id")
    .single<{ id: string }>();

  if (tErr || !tenant) {
    // Provisioning failed — still confirm to user, notify admin
    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `[ERRO] Trial não provisionado: ${business}`,
      html: `<p>Erro ao criar tenant para ${business} (${email}): ${tErr?.message}</p>`,
    });
    redirect("/?enviado=1");
  }

  const d = tpl.defaults;
  await db.from("tenant_settings").insert({
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

  const portalUrl = `https://${ROOT_DOMAIN}/p/${slug}`;

  // Welcome email to business owner
  await sendEmail({
    to: email,
    subject: `Seu portal está pronto, ${name}! 🎉`,
    html: `
      <h2>Bem-vindo ao Fideliza.OS!</h2>
      <p>Olá, ${name}. Seu portal de fidelidade para <strong>${business}</strong> está no ar.</p>
      <p><strong>Acesse agora:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
      <p>Você tem <strong>${TRIAL_DAYS} dias gratuitos</strong> para explorar tudo. Após o período de trial, entre em contato para assinar e continuar usando.</p>
      <p>Qualquer dúvida, responda este e-mail.</p>
      <p>— Equipe Fideliza.OS</p>
    `,
  });

  // Notify admin
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `Novo trial: ${business} (${segment}) — /p/${slug}`,
    html: `
      <p><strong>Nome:</strong> ${name}</p>
      <p><strong>E-mail:</strong> ${email}</p>
      <p><strong>Negócio:</strong> ${business} · ${segment}</p>
      ${phone ? `<p><strong>Telefone:</strong> ${phone}</p>` : ""}
      <p><strong>Portal:</strong> <a href="${portalUrl}">${portalUrl}</a></p>
      <p><strong>Trial até:</strong> ${new Date(trialEndsAt).toLocaleDateString("pt-BR")}</p>
    `,
  });

  redirect(`/?trial=${encodeURIComponent(portalUrl)}`);
}

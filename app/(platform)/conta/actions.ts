"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { isValidCpfCnpj } from "@/lib/masks";
import {
  SEGMENT_TEMPLATES,
  modulesEnabledFromTemplate,
} from "@/lib/segment-templates";
import {
  createCustomer,
  createSubscription,
  getSubscriptionFirstPayment,
  type BillingType,
} from "@/lib/asaas";

const ROOT_URL =
  process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
    : "http://localhost:3000";

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

// ---------- Signup ----------

export async function platformSignUp(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !email || password.length < 6) {
    redirect("/conta/cadastro?error=campos");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) {
    redirect(`/conta/cadastro?error=${encodeURIComponent(error.message)}`);
  }

  // Create platform_users record
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const db = createAdminClient();
    await db.from("platform_users").upsert({ user_id: user.id });
  }

  redirect("/conta/configurar");
}

// ---------- Login ----------

export async function platformSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/conta/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/painel");
}

export async function platformSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/conta/login");
}

// ---------- Configurar negócio ----------

export async function configureBusiness(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/conta/login");

  const businessName = String(formData.get("business_name") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim();
  const ownerCpfCnpj = String(formData.get("owner_cpf_cnpj") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!businessName || !segment || !ownerCpfCnpj) {
    redirect("/conta/configurar?error=campos");
  }

  if (!isValidCpfCnpj(ownerCpfCnpj)) {
    redirect("/conta/configurar?error=" + encodeURIComponent("CPF/CNPJ inválido."));
  }

  const db = createAdminClient();
  const { data: platformUser } = await db
    .from("platform_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle<{ tenant_id: string | null }>();

  const tpl = SEGMENT_TEMPLATES[segment] ?? SEGMENT_TEMPLATES.generico;
  const slug = await uniqueSlug(slugify(businessName));

  let tenantId = platformUser?.tenant_id;

  if (tenantId) {
    // Update existing pending tenant
    await db
      .from("tenants")
      .update({
        name: businessName,
        slug,
        segment_template: segment,
        owner_email: user.email,
        owner_cpf_cnpj: ownerCpfCnpj || null,
      })
      .eq("id", tenantId);
  } else {
    // Create new tenant in "pending" state
    const { data: tenant, error: tErr } = await db
      .from("tenants")
      .insert({
        name: businessName,
        slug,
        segment_template: segment,
        status: "pending",
        owner_email: user.email,
        owner_cpf_cnpj: ownerCpfCnpj || null,
      })
      .select("id")
      .single<{ id: string }>();

    if (tErr || !tenant) {
      redirect(`/conta/configurar?error=${encodeURIComponent(tErr?.message ?? "Erro ao criar negócio.")}`);
    }

    tenantId = tenant.id;

    const d = tpl.defaults;
    await db.from("tenant_settings").insert({
      tenant_id: tenantId,
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
          tenant_id: tenantId,
          label: f.label,
          field_key: f.field_key,
          field_type: f.field_type,
          options: f.options ?? null,
          required: f.required ?? false,
          display_order: i + 1,
        })),
      );
    }

    // Link platform_user → tenant
    await db
      .from("platform_users")
      .update({ tenant_id: tenantId })
      .eq("user_id", user.id);
  }

  redirect("/conta/planos");
}

// ---------- Iniciar pagamento ----------

export async function initiatePayment(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/conta/login");

  const plan = String(formData.get("plan") ?? "starter");
  const billingType = (String(formData.get("billing_type") ?? "PIX").toUpperCase()) as BillingType;

  if (!process.env.ASAAS_API_KEY) {
    redirect("/conta/aguardando?modo=sem_asaas");
  }

  const db = createAdminClient();
  const { data: platformUser } = await db
    .from("platform_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle<{ tenant_id: string | null }>();

  if (!platformUser?.tenant_id) redirect("/conta/configurar");

  const { data: tenant } = await db
    .from("tenants")
    .select("name, owner_email, owner_cpf_cnpj, asaas_customer_id, asaas_subscription_id")
    .eq("id", platformUser.tenant_id)
    .maybeSingle<{
      name: string;
      owner_email: string | null;
      owner_cpf_cnpj: string | null;
      asaas_customer_id: string | null;
      asaas_subscription_id: string | null;
    }>();

  if (!tenant) redirect("/conta/configurar");

  // Update plan
  await db
    .from("tenants")
    .update({ saas_plan: plan })
    .eq("id", platformUser.tenant_id);

  try {
    // Reuse or create Asaas customer
    let customerId = tenant.asaas_customer_id;
    if (!customerId) {
      const customer = await createCustomer({
        name: tenant.name,
        email: tenant.owner_email ?? user.email ?? "",
        cpfCnpj: tenant.owner_cpf_cnpj ?? undefined,
      });
      customerId = customer.id;
      await db
        .from("tenants")
        .update({ asaas_customer_id: customerId })
        .eq("id", platformUser.tenant_id);
    }

    // Create subscription if not exists
    let subscriptionId = tenant.asaas_subscription_id;
    if (!subscriptionId) {
      const sub = await createSubscription({
        customer: customerId,
        plan,
        email: tenant.owner_email ?? user.email ?? "",
        billingType,
      });
      subscriptionId = sub.id;
      await db
        .from("tenants")
        .update({ asaas_subscription_id: subscriptionId })
        .eq("id", platformUser.tenant_id);
    }

    // Get invoice URL from first payment
    const payment = await getSubscriptionFirstPayment(subscriptionId);
    const invoiceUrl = payment?.invoiceUrl;

    if (invoiceUrl) {
      redirect(invoiceUrl);
    } else {
      redirect("/conta/aguardando");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro ao processar pagamento.";
    redirect(`/conta/planos?error=${encodeURIComponent(msg)}`);
  }
}

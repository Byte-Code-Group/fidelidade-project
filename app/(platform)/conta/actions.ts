"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantOwner, requireTenantOwner, ACTIVE_TENANT_COOKIE } from "@/lib/owner";
import { canCreateAnotherTenant } from "@/lib/tenant-limits";
import { isValidCpfCnpj } from "@/lib/masks";
import {
  SEGMENT_TEMPLATES,
  modulesEnabledFromTemplate,
} from "@/lib/segment-templates";
import {
  createCustomer,
  createSubscription,
  getSubscriptionFirstPayment,
  updateSubscriptionCallback,
  isRemovedCustomerError,
  type BillingType,
} from "@/lib/asaas";
import { traduzirErro, traduzirErroDesconhecido } from "@/lib/error-messages";

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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } },
  });

  if (error) {
    redirect(`/conta/cadastro?error=${encodeURIComponent(traduzirErro(error.message))}`);
  }

  // Cria a linha "placeholder" (tenant_id null) — só se ainda não existir
  // nenhuma, já que platform_users não tem mais user_id como PK única.
  // Usa o user retornado pelo signUp direto (não getAuthUser/sessão), pois
  // com confirmação de e-mail ativa a sessão ainda não existe nesta request.
  if (data.user) {
    const db = createAdminClient();
    const { count } = await db
      .from("platform_users")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id);
    if (!count) {
      await db.from("platform_users").insert({ user_id: data.user.id, tenant_id: null });
    }
  }

  // Painel decide: com sessão confirmada mas sem negócio ainda, mostra
  // estado vazio com CTA pra criar — não força a pessoa na criação.
  redirect("/painel");
}

// ---------- Login ----------

export async function platformSignIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/conta/login?error=${encodeURIComponent(traduzirErro(error.message))}`);
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
  const user = await getAuthUser();
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
  const owner = await getTenantOwner();
  const mode = String(formData.get("mode") ?? "");

  if (mode === "new") {
    const ownedPlans = (owner?.tenants ?? [])
      .filter((t) => t.status !== "suspended")
      .map((t) => t.saas_plan);
    const { allowed, limit } = canCreateAnotherTenant(ownedPlans);
    if (!allowed) {
      redirect(
        `/conta/configurar?mode=new&error=${encodeURIComponent(
          `Seu plano permite no máximo ${limit} negócio(s). Faça upgrade pra criar mais.`,
        )}`,
      );
    }
  }

  const tpl = SEGMENT_TEMPLATES[segment] ?? SEGMENT_TEMPLATES.generico;
  const slug = await uniqueSlug(slugify(businessName));

  // "new" sempre cria um negócio do zero, mesmo que o owner já tenha outros.
  let tenantId = mode === "new" ? undefined : owner?.tenantId;

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
      redirect(`/conta/configurar?error=${encodeURIComponent(traduzirErro(tErr?.message, "Erro ao criar negócio."))}`);
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
      // Telefone informado no cadastro vira o contato exibido no portal.
      footer_phone: phone || null,
    });

    // Link platform_user → tenant: reaproveita a linha placeholder (1º
    // negócio) ou insere uma nova (negócio adicional).
    if (mode === "new") {
      await db.from("platform_users").insert({ user_id: user.id, tenant_id: tenantId });
    } else {
      await db
        .from("platform_users")
        .update({ tenant_id: tenantId })
        .eq("user_id", user.id)
        .is("tenant_id", null);
    }

    // Novo negócio vira o ativo no painel.
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }

  redirect("/conta/planos");
}

// ---------- Iniciar pagamento ----------

export async function initiatePayment(formData: FormData) {
  const { user, tenantId } = await requireTenantOwner();

  const plan = String(formData.get("plan") ?? "starter");
  // Assinatura do SaaS é só no cartão — PIX não permite cobrança recorrente automática.
  const billingType: BillingType = "CREDIT_CARD";

  if (!process.env.ASAAS_API_KEY) {
    redirect("/conta/aguardando?modo=sem_asaas");
  }

  const db = createAdminClient();

  const { data: tenant } = await db
    .from("tenants")
    .select("name, owner_email, owner_cpf_cnpj, asaas_customer_id, asaas_subscription_id")
    .eq("id", tenantId)
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
    .eq("id", tenantId);

  let invoiceUrl: string | undefined;

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
        .eq("id", tenantId);
    }

    // Create subscription if not exists
    let subscriptionId = tenant.asaas_subscription_id;
    if (!subscriptionId) {
      let sub;
      try {
        sub = await createSubscription({
          customer: customerId,
          plan,
          email: tenant.owner_email ?? user.email ?? "",
          billingType,
        });
      } catch (err) {
        // Customer foi removido diretamente no painel Asaas (fora do fluxo
        // normal de cancelamento) — recria e tenta de novo.
        if (!isRemovedCustomerError(err)) throw err;
        const customer = await createCustomer({
          name: tenant.name,
          email: tenant.owner_email ?? user.email ?? "",
          cpfCnpj: tenant.owner_cpf_cnpj ?? undefined,
        });
        customerId = customer.id;
        await db
          .from("tenants")
          .update({ asaas_customer_id: customerId })
          .eq("id", tenantId);
        sub = await createSubscription({
          customer: customerId,
          plan,
          email: tenant.owner_email ?? user.email ?? "",
          billingType,
        });
      }
      subscriptionId = sub.id;
      await db
        .from("tenants")
        .update({ asaas_subscription_id: subscriptionId })
        .eq("id", tenantId);
    } else {
      // Assinatura já existia (pode ter sido criada antes do callback ser configurado)
      await updateSubscriptionCallback(subscriptionId);
    }

    // Get invoice URL from first payment
    // Nunca anexar ?autoRedirect=true aqui: esse parâmetro redireciona o dono
    // de volta assim que a fatura ABRE, pago ou não — ele nem chegava a
    // preencher o cartão. O redirect certo é o callback da assinatura, que
    // só dispara depois do pagamento.
    // (https://docs.asaas.com/docs/redirecionamento-apos-o-pagamento)
    const payment = await getSubscriptionFirstPayment(subscriptionId);
    invoiceUrl = payment?.invoiceUrl;
  } catch (err) {
    const msg = traduzirErroDesconhecido(err, "Erro ao processar pagamento.");
    redirect(`/conta/planos?error=${encodeURIComponent(msg)}`);
  }

  redirect(invoiceUrl || "/conta/aguardando");
}

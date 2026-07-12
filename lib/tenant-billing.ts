import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscriptionFirstPayment,
  isRemovedCustomerError,
  type BillingType,
} from "@/lib/asaas";

// Lógica de negócio pura (sem gate de auth) reaproveitada tanto pelo
// Super Admin quanto pelo painel do dono.

// O Asaas não expõe update de subscription (só create/get/cancel) — trocar de
// plano = cancelar a assinatura atual e criar uma nova com o valor do plano novo.
export async function changeTenantPlan(
  tenantId: string,
  newPlan: string,
  billingType: BillingType,
) {
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
  if (!tenant) throw new Error("Tenant não encontrado.");

  if (tenant.asaas_subscription_id) {
    try {
      await cancelSubscription(tenant.asaas_subscription_id);
    } catch {
      // segue mesmo se falhar — não deve bloquear a troca de plano
    }
  }

  let customerId = tenant.asaas_customer_id;
  if (!customerId) {
    const customer = await createCustomer({
      name: tenant.name,
      email: tenant.owner_email ?? "",
      cpfCnpj: tenant.owner_cpf_cnpj ?? undefined,
    });
    customerId = customer.id;
  }

  let subscription;
  try {
    subscription = await createSubscription({
      customer: customerId,
      plan: newPlan,
      email: tenant.owner_email ?? "",
      billingType,
    });
  } catch (err) {
    // Customer foi removido diretamente no painel Asaas (fora do fluxo
    // normal de cancelamento) — recria e tenta de novo.
    if (!isRemovedCustomerError(err)) throw err;
    const customer = await createCustomer({
      name: tenant.name,
      email: tenant.owner_email ?? "",
      cpfCnpj: tenant.owner_cpf_cnpj ?? undefined,
    });
    customerId = customer.id;
    subscription = await createSubscription({
      customer: customerId,
      plan: newPlan,
      email: tenant.owner_email ?? "",
      billingType,
    });
  }

  await db
    .from("tenants")
    .update({
      saas_plan: newPlan,
      asaas_customer_id: customerId,
      asaas_subscription_id: subscription.id,
      // Não marca como "active" aqui — o webhook confirma quando o
      // pagamento realmente cair (PAYMENT_RECEIVED/PAYMENT_CONFIRMED).
      status: "pending",
    })
    .eq("id", tenantId);

  const payment = await getSubscriptionFirstPayment(subscription.id);
  const invoiceUrl = payment?.invoiceUrl
    ? `${payment.invoiceUrl}?autoRedirect=true`
    : undefined;

  return { subscription, invoiceUrl };
}

export async function cancelTenantSubscription(tenantId: string) {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("asaas_subscription_id")
    .eq("id", tenantId)
    .maybeSingle<{ asaas_subscription_id: string | null }>();

  if (tenant?.asaas_subscription_id) {
    try {
      await cancelSubscription(tenant.asaas_subscription_id);
    } catch {
      // ignora erro do Asaas — suspende o tenant mesmo assim
    }
    await db
      .from("tenants")
      .update({ status: "suspended", asaas_subscription_id: null })
      .eq("id", tenantId);
  }
}

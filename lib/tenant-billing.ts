import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOwnerTenants, type OwnedTenant } from "@/lib/owner";
import { PLAN_RANK, canCreateAnotherTenant } from "@/lib/tenant-limits";
import {
  createCustomer,
  createSubscription,
  cancelSubscription,
  getSubscription,
  getSubscriptionFirstPayment,
  isRemovedCustomerError,
  type BillingType,
} from "@/lib/asaas";

// Status de pagamento do Asaas que consideramos "pago" — libera o tenant.
const CONFIRMED_PAYMENT_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

// Erro lançado quando o dono tenta rebaixar/cancelar antes do fim do
// período já pago — a mensagem carrega a data em que libera.
export class PlanChangeLockedError extends Error {
  constructor(public readonly availableAt: string) {
    super(`Troca/cancelamento bloqueado até ${availableAt}`);
    this.name = "PlanChangeLockedError";
  }
}

// Lógica de negócio pura (sem gate de auth) reaproveitada tanto pelo
// Super Admin quanto pelo painel do dono.

// Upgrade (plano melhor) é liberado na hora. Downgrade ou cancelamento com
// assinatura ativa só depois que o período já pago acabar (próx. vencimento
// da assinatura no Asaas) — não faz sentido derrubar algo que já foi pago.
async function assertPlanChangeAllowed(
  currentPlan: string,
  targetPlan: string,
  status: string,
  asaasSubscriptionId: string | null,
) {
  const isUpgrade = PLAN_RANK[targetPlan] > PLAN_RANK[currentPlan];
  if (isUpgrade) return;
  if (status !== "active" || !asaasSubscriptionId) return;

  try {
    const sub = await getSubscription(asaasSubscriptionId);
    if (new Date() < new Date(sub.nextDueDate)) {
      throw new PlanChangeLockedError(sub.nextDueDate);
    }
  } catch (err) {
    if (err instanceof PlanChangeLockedError) throw err;
    // Não deu pra consultar o Asaas (offline, id inválido) — não bloqueia.
  }
}

// Versão read-only de assertPlanChangeAllowed, pra tela mostrar "disponível
// a partir de X" sem precisar tentar a troca e capturar o erro.
export async function getPlanChangeLockDate(
  currentPlan: string,
  status: string,
  asaasSubscriptionId: string | null,
): Promise<string | null> {
  if (status !== "active" || !asaasSubscriptionId) return null;
  try {
    const sub = await getSubscription(asaasSubscriptionId);
    return new Date() < new Date(sub.nextDueDate) ? sub.nextDueDate : null;
  } catch {
    return null;
  }
}

// Quando um downgrade reduz o limite de negócios do dono abaixo da
// quantidade que ele já tem ativa, alguém precisa escolher quais ficam
// ativos. Chamada ANTES de mexer no Asaas — não faz sentido cobrar e só
// depois perguntar quais negócios sobrevivem.
export async function checkTenantLimitImpact(
  tenantId: string,
  newPlan: string,
): Promise<{ requiresSelection: boolean; activeTenants: OwnedTenant[]; limit: number }> {
  const db = createAdminClient();
  const { data: link } = await db
    .from("platform_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ user_id: string }>();
  if (!link) return { requiresSelection: false, activeTenants: [], limit: -1 };

  const allTenants = await getOwnerTenants(link.user_id);
  const active = allTenants.filter((t) => t.status !== "suspended");
  const projectedPlans = active.map((t) => (t.id === tenantId ? newPlan : t.saas_plan));
  const { limit } = canCreateAnotherTenant(projectedPlans);

  return { requiresSelection: limit !== -1 && active.length > limit, activeTenants: active, limit };
}

// O Asaas não expõe update de subscription (só create/get/cancel) — trocar de
// plano = cancelar a assinatura atual e criar uma nova com o valor do plano novo.
export async function changeTenantPlan(
  tenantId: string,
  newPlan: string,
  billingType: BillingType,
  opts?: { keepActiveTenantIds?: string[] },
) {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select(
      "name, owner_email, owner_cpf_cnpj, asaas_customer_id, asaas_subscription_id, saas_plan, status",
    )
    .eq("id", tenantId)
    .maybeSingle<{
      name: string;
      owner_email: string | null;
      owner_cpf_cnpj: string | null;
      asaas_customer_id: string | null;
      asaas_subscription_id: string | null;
      saas_plan: string;
      status: string;
    }>();
  if (!tenant) throw new Error("Tenant não encontrado.");

  await assertPlanChangeAllowed(
    tenant.saas_plan,
    newPlan,
    tenant.status,
    tenant.asaas_subscription_id,
  );

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

  // Downgrade pode deixar o dono com mais negócios ativos do que o plano
  // novo permite — suspende os excedentes, mantendo os escolhidos (ou o
  // próprio tenant que acabou de trocar, se nada foi escolhido).
  if (opts?.keepActiveTenantIds) {
    const { data: link } = await db
      .from("platform_users")
      .select("user_id")
      .eq("tenant_id", tenantId)
      .maybeSingle<{ user_id: string }>();
    if (link) {
      // O tenant que acabou de trocar de plano sempre fica ativo — a escolha
      // do dono é sobre os OUTROS negócios que sobram do limite novo.
      const keep = new Set([tenantId, ...opts.keepActiveTenantIds]);
      const allTenants = await getOwnerTenants(link.user_id);
      const active = allTenants.filter((t) => t.status !== "suspended");
      const toSuspend = active.filter((t) => !keep.has(t.id)).map((t) => t.id);
      if (toSuspend.length) {
        await db.from("tenants").update({ status: "suspended" }).in("id", toSuspend);
      }
    }
  }

  return { subscription, invoiceUrl };
}

// Fonte de verdade primária é o webhook (app/api/webhooks/asaas/route.ts),
// mas ele depende de estar bem configurado no painel Asaas e de o Asaas
// efetivamente entregar o evento. Esta função é o fallback: consulta o
// Asaas direto e sincroniza o status do tenant, cobrindo casos onde o
// webhook nunca chegou (ex: cliente restaurado manualmente no painel Asaas
// não dispara PAYMENT_RECEIVED). Chamada sempre que o usuário checa status
// (botão "Verificar status", página de assinatura).
export async function syncTenantStatusWithAsaas(tenantId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("status, asaas_subscription_id")
    .eq("id", tenantId)
    .maybeSingle<{ status: string; asaas_subscription_id: string | null }>();

  if (!tenant) return null;
  if (tenant.status === "active") return tenant.status;
  if (!tenant.asaas_subscription_id || !process.env.ASAAS_API_KEY) return tenant.status;

  try {
    const payment = await getSubscriptionFirstPayment(tenant.asaas_subscription_id);
    if (payment && CONFIRMED_PAYMENT_STATUSES.has(payment.status)) {
      await db.from("tenants").update({ status: "active" }).eq("id", tenantId);
      return "active";
    }
  } catch {
    // Asaas offline ou subscription inválida — mantém status atual, não bloqueia.
  }

  return tenant.status;
}

export async function cancelTenantSubscription(
  tenantId: string,
  opts?: { force?: boolean },
) {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("asaas_subscription_id, status")
    .eq("id", tenantId)
    .maybeSingle<{ asaas_subscription_id: string | null; status: string }>();

  if (!opts?.force && tenant?.asaas_subscription_id && tenant.status === "active") {
    try {
      const sub = await getSubscription(tenant.asaas_subscription_id);
      if (new Date() < new Date(sub.nextDueDate)) {
        throw new PlanChangeLockedError(sub.nextDueDate);
      }
    } catch (err) {
      if (err instanceof PlanChangeLockedError) throw err;
      // Não deu pra consultar o Asaas — não bloqueia o cancelamento.
    }
  }

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

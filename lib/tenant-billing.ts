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
  getSubscriptionPayments,
  PAID_PAYMENT_STATUSES,
  updateSubscriptionValue,
  isRemovedCustomerError,
  PLAN_PRICES,
  type BillingType,
  type AsaasSubscription,
} from "@/lib/asaas";

// Status de pagamento do Asaas que consideramos "pago" — libera o tenant.
const CONFIRMED_PAYMENT_STATUSES = PAID_PAYMENT_STATUSES;

// Lógica de negócio pura (sem gate de auth) reaproveitada tanto pelo
// Super Admin quanto pelo painel do dono.
//
// Modelo estilo Netflix/Spotify: upgrade e downgrade e cancelamento são
// SEMPRE liberados na hora, sem esperar prazo nenhum.
//   - Upgrade: acesso melhora já, sem cobrar nada agora — o valor novo só
//     entra na próxima fatura.
//   - Downgrade: acesso atual continua até o fim do período já pago; o
//     plano novo passa a valer (e cobrar) só depois disso.
//   - Cancelamento: para a cobrança na hora, mas o acesso continua até o
//     fim do período já pago — depois disso o portal é suspenso.

// Quando um downgrade reduz o limite de negócios do dono abaixo da
// quantidade que ele já tem ativa, alguém precisa escolher quais ficam
// ativos. Chamada ANTES de mexer no Asaas.
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

interface TenantBillingRow {
  name: string;
  owner_email: string | null;
  owner_cpf_cnpj: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  saas_plan: string;
  status: string;
}

async function loadTenantBillingRow(db: ReturnType<typeof createAdminClient>, tenantId: string) {
  const { data: tenant } = await db
    .from("tenants")
    .select(
      "name, owner_email, owner_cpf_cnpj, asaas_customer_id, asaas_subscription_id, saas_plan, status",
    )
    .eq("id", tenantId)
    .maybeSingle<TenantBillingRow>();
  if (!tenant) throw new Error("Tenant não encontrado.");
  return tenant;
}

// Suspende os negócios do dono que excedem o limite do novo plano, mantendo
// sempre o tenant que trocou de plano + os escolhidos por ele.
async function suspendOverLimitTenants(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  keepActiveTenantIds: string[],
) {
  const { data: link } = await db
    .from("platform_users")
    .select("user_id")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ user_id: string }>();
  if (!link) return;

  const keep = new Set([tenantId, ...keepActiveTenantIds]);
  const allTenants = await getOwnerTenants(link.user_id);
  const active = allTenants.filter((t) => t.status !== "suspended");
  const toSuspend = active.filter((t) => !keep.has(t.id)).map((t) => t.id);
  if (toSuspend.length) {
    await db.from("tenants").update({ status: "suspended" }).in("id", toSuspend);
  }
}

// Assina do zero (sem assinatura ativa, ou reativando depois de um
// cancelamento) — cancela qualquer assinatura velha e cria uma nova no
// valor do plano escolhido.
async function subscribeFresh(
  db: ReturnType<typeof createAdminClient>,
  tenantId: string,
  tenant: TenantBillingRow,
  newPlan: string,
  billingType: BillingType,
) {
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

  let subscription: AsaasSubscription;
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
      pending_plan: null,
      pending_plan_effective_at: null,
      pending_keep_tenant_ids: null,
      cancel_at: null,
    })
    .eq("id", tenantId);

  const payment = await getSubscriptionFirstPayment(subscription.id);
  const invoiceUrl = payment?.invoiceUrl
    ? `${payment.invoiceUrl}?autoRedirect=true`
    : undefined;

  return { subscription, invoiceUrl };
}

export async function changeTenantPlan(
  tenantId: string,
  newPlan: string,
  billingType: BillingType,
  opts?: { keepActiveTenantIds?: string[] },
) {
  const db = createAdminClient();
  const tenant = await loadTenantBillingRow(db, tenantId);

  // Sem assinatura ativa de verdade (nunca assinou, suspenso, ou cancelou e
  // o Asaas já não tem mais a subscription) — é assinatura nova.
  const isFreshSubscribe = tenant.status !== "active" || !tenant.asaas_subscription_id;

  if (isFreshSubscribe) {
    const result = await subscribeFresh(db, tenantId, tenant, newPlan, billingType);
    if (opts?.keepActiveTenantIds) {
      await suspendOverLimitTenants(db, tenantId, opts.keepActiveTenantIds);
    }
    return result;
  }

  const isUpgrade = PLAN_RANK[newPlan] > PLAN_RANK[tenant.saas_plan];
  const subscription = await getSubscription(tenant.asaas_subscription_id!);

  // Reajusta o valor cobrado nos PRÓXIMOS ciclos, sem mexer numa cobrança já
  // gerada e pendente — nem upgrade nem downgrade cobram nada agora.
  await updateSubscriptionValue(tenant.asaas_subscription_id!, PLAN_PRICES[newPlan]);

  if (isUpgrade) {
    // Upgrade vale na hora: acesso melhora já, sem cobrança extra — o valor
    // novo só aparece na próxima fatura.
    await db
      .from("tenants")
      .update({
        saas_plan: newPlan,
        pending_plan: null,
        pending_plan_effective_at: null,
        pending_keep_tenant_ids: null,
        cancel_at: null,
      })
      .eq("id", tenantId);

    return { subscription, invoiceUrl: undefined };
  }

  // Downgrade: o plano atual continua valendo (e com acesso completo) até o
  // fim do período já pago. A troca de fato — e a suspensão dos negócios
  // excedentes, se houver — só acontece quando o período vira (ver
  // applyScheduledChanges).
  await db
    .from("tenants")
    .update({
      pending_plan: newPlan,
      pending_plan_effective_at: subscription.nextDueDate,
      pending_keep_tenant_ids: opts?.keepActiveTenantIds?.length
        ? opts.keepActiveTenantIds
        : null,
      cancel_at: null,
    })
    .eq("id", tenantId);

  return { subscription, invoiceUrl: undefined, scheduledFor: subscription.nextDueDate };
}

// Desfaz um downgrade agendado (dono mudou de ideia) — restaura o valor da
// assinatura no Asaas pro plano atual e limpa os campos pendentes.
export async function cancelPendingPlanChange(tenantId: string) {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("saas_plan, asaas_subscription_id, pending_plan")
    .eq("id", tenantId)
    .maybeSingle<{
      saas_plan: string;
      asaas_subscription_id: string | null;
      pending_plan: string | null;
    }>();
  if (!tenant?.pending_plan) return;

  if (tenant.asaas_subscription_id) {
    try {
      await updateSubscriptionValue(tenant.asaas_subscription_id, PLAN_PRICES[tenant.saas_plan]);
    } catch {
      // Asaas offline — segue limpando localmente; próxima sync tenta de novo.
    }
  }

  await db
    .from("tenants")
    .update({ pending_plan: null, pending_plan_effective_at: null, pending_keep_tenant_ids: null })
    .eq("id", tenantId);
}

// Cancela a cobrança na hora (para o Asaas de cobrar de novo), mas mantém o
// acesso ativo até o fim do período já pago — estilo Netflix/Spotify.
// force=true (Super Admin) suspende na hora, sem esperar.
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

  if (!tenant?.asaas_subscription_id) return;

  let accessUntil: string | null = null;
  if (!opts?.force && tenant.status === "active") {
    try {
      const sub = await getSubscription(tenant.asaas_subscription_id);
      if (new Date() < new Date(sub.nextDueDate)) accessUntil = sub.nextDueDate;
    } catch {
      // Asaas offline — cancela sem grace period.
    }
  }

  try {
    await cancelSubscription(tenant.asaas_subscription_id);
  } catch {
    // ignora erro do Asaas — cancela localmente mesmo assim
  }

  if (accessUntil) {
    await db
      .from("tenants")
      .update({
        asaas_subscription_id: null,
        cancel_at: accessUntil,
        pending_plan: null,
        pending_plan_effective_at: null,
        pending_keep_tenant_ids: null,
      })
      .eq("id", tenantId);
  } else {
    await db
      .from("tenants")
      .update({
        status: "suspended",
        asaas_subscription_id: null,
        cancel_at: null,
        pending_plan: null,
        pending_plan_effective_at: null,
        pending_keep_tenant_ids: null,
      })
      .eq("id", tenantId);
  }
}

// Aplica downgrade agendado ou cancelamento cujo prazo já virou — chamada
// pela sincronização de status nas telas (fallback principal, já que um
// cancelamento não gera mais eventos de webhook do Asaas).
export async function applyScheduledChanges(tenantId: string): Promise<void> {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("cancel_at, pending_plan, pending_plan_effective_at, pending_keep_tenant_ids")
    .eq("id", tenantId)
    .maybeSingle<{
      cancel_at: string | null;
      pending_plan: string | null;
      pending_plan_effective_at: string | null;
      pending_keep_tenant_ids: string[] | null;
    }>();
  if (!tenant) return;

  if (tenant.cancel_at && new Date() >= new Date(tenant.cancel_at)) {
    await db
      .from("tenants")
      .update({
        status: "suspended",
        cancel_at: null,
        pending_plan: null,
        pending_plan_effective_at: null,
        pending_keep_tenant_ids: null,
      })
      .eq("id", tenantId);
    return;
  }

  if (
    tenant.pending_plan &&
    tenant.pending_plan_effective_at &&
    new Date() >= new Date(tenant.pending_plan_effective_at)
  ) {
    await db
      .from("tenants")
      .update({
        saas_plan: tenant.pending_plan,
        pending_plan: null,
        pending_plan_effective_at: null,
        pending_keep_tenant_ids: null,
      })
      .eq("id", tenantId);

    if (tenant.pending_keep_tenant_ids?.length) {
      await suspendOverLimitTenants(db, tenantId, tenant.pending_keep_tenant_ids);
    }
  }
}

// Fonte de verdade primária é o webhook (app/api/webhooks/asaas/route.ts),
// mas ele depende de estar bem configurado no painel Asaas e de o Asaas
// efetivamente entregar o evento. Esta função é o fallback: consulta o
// Asaas direto e sincroniza o status do tenant, cobrindo casos onde o
// webhook nunca chegou. Também aplica downgrade/cancelamento agendado se o
// prazo já passou — chamada sempre que o usuário abre a tela de assinatura.
export async function syncTenantStatusWithAsaas(tenantId: string): Promise<string | null> {
  await applyScheduledChanges(tenantId);

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
    // Qualquer cobrança paga da assinatura libera o tenant — olhar só a
    // primeira da lista deixava o dono preso em "pending" quando a
    // assinatura já tinha outra cobrança (tentativa vencida, ciclo novo).
    const payments = await getSubscriptionPayments(tenant.asaas_subscription_id);
    const pago = payments.find((p) => CONFIRMED_PAYMENT_STATUSES.has(p.status));
    if (pago) {
      await db.from("tenants").update({ status: "active" }).eq("id", tenantId);
      return "active";
    }
    console.log(
      `[asaas sync] tenant=${tenantId} sub=${tenant.asaas_subscription_id} sem cobrança paga — statuses=${payments.map((p) => p.status).join(",") || "nenhuma"}`,
    );
  } catch (err) {
    // Asaas offline, chave errada ou subscription inválida — mantém o status
    // atual pra não bloquear, mas registra: silenciar aqui já escondeu o
    // motivo real de assinatura paga que nunca ativava.
    console.error(
      `[asaas sync] falha ao consultar tenant=${tenantId} sub=${tenant.asaas_subscription_id}:`,
      err,
    );
  }

  return tenant.status;
}

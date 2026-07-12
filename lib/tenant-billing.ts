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
  updateSubscriptionValue,
  createOneOffPayment,
  isRemovedCustomerError,
  PLAN_PRICES,
  type BillingType,
  type AsaasSubscription,
} from "@/lib/asaas";

// Status de pagamento do Asaas que consideramos "pago" — libera o tenant.
const CONFIRMED_PAYMENT_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

// Erro lançado quando o dono tenta cancelar antes do fim do período já
// pago — a mensagem carrega a data em que libera.
export class PlanChangeLockedError extends Error {
  constructor(public readonly availableAt: string) {
    super(`Cancelamento bloqueado até ${availableAt}`);
    this.name = "PlanChangeLockedError";
  }
}

// Lógica de negócio pura (sem gate de auth) reaproveitada tanto pelo
// Super Admin quanto pelo painel do dono.

// Versão read-only, pra tela mostrar "disponível a partir de X" sem tentar
// a ação e capturar erro. Usada só pro cancelamento (downgrade não bloqueia
// mais — ver changeTenantPlan).
export async function getPlanChangeLockDate(
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
// ativos. Chamada ANTES de mexer no Asaas — não faz sentido agendar/cobrar
// e só depois perguntar quais negócios sobrevivem.
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

// Assina do zero (sem assinatura ativa) ou reativa — cancela qualquer
// assinatura velha e cria uma nova no valor do plano escolhido.
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

  const isFreshSubscribe = tenant.status !== "active" || !tenant.asaas_subscription_id;
  const isUpgrade = PLAN_RANK[newPlan] > PLAN_RANK[tenant.saas_plan];

  if (isFreshSubscribe) {
    const result = await subscribeFresh(db, tenantId, tenant, newPlan, billingType);
    if (opts?.keepActiveTenantIds) {
      await suspendOverLimitTenants(db, tenantId, opts.keepActiveTenantIds);
    }
    return result;
  }

  const subscription = await getSubscription(tenant.asaas_subscription_id!);

  if (isUpgrade) {
    // Upgrade vale na hora: só cobra a diferença proporcional aos dias que
    // faltam pro fim do ciclo atual (aproximado em 30 dias) e já reajusta o
    // valor da assinatura pros próximos ciclos.
    const diff = PLAN_PRICES[newPlan] - PLAN_PRICES[tenant.saas_plan];
    const daysRemaining = Math.max(
      0,
      Math.min(
        30,
        Math.ceil(
          (new Date(subscription.nextDueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      ),
    );
    const prorated = Math.round((diff * daysRemaining / 30) * 100) / 100;

    let invoiceUrl: string | undefined;
    if (prorated > 0 && tenant.asaas_customer_id) {
      const today = new Date().toISOString().slice(0, 10);
      const payment = await createOneOffPayment({
        customer: tenant.asaas_customer_id,
        billingType,
        value: prorated,
        dueDate: today,
        description: `Fideliza.OS — upgrade ${tenant.saas_plan} → ${newPlan} (diferença proporcional)`,
      });
      invoiceUrl = payment.invoiceUrl ? `${payment.invoiceUrl}?autoRedirect=true` : undefined;
    }

    await updateSubscriptionValue(tenant.asaas_subscription_id!, PLAN_PRICES[newPlan]);
    await db
      .from("tenants")
      .update({
        saas_plan: newPlan,
        pending_plan: null,
        pending_plan_effective_at: null,
        pending_keep_tenant_ids: null,
      })
      .eq("id", tenantId);

    return { subscription, invoiceUrl };
  }

  // Downgrade: o plano atual continua valendo até o fim do período já pago.
  // Só troca o valor cobrado nos PRÓXIMOS ciclos; a mudança de fato (e a
  // suspensão dos negócios excedentes) só acontece quando o período vira —
  // ver applyPendingPlanChange.
  await updateSubscriptionValue(tenant.asaas_subscription_id!, PLAN_PRICES[newPlan]);
  await db
    .from("tenants")
    .update({
      pending_plan: newPlan,
      pending_plan_effective_at: subscription.nextDueDate,
      pending_keep_tenant_ids: opts?.keepActiveTenantIds?.length
        ? opts.keepActiveTenantIds
        : null,
    })
    .eq("id", tenantId);

  return { subscription, invoiceUrl: undefined, scheduledFor: subscription.nextDueDate };
}

// Desfaz um downgrade agendado (ex: dono mudou de ideia) — restaura o valor
// da assinatura no Asaas pro plano atual e limpa os campos pendentes.
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

// Aplica um downgrade agendado cujo prazo já virou — chamada tanto pelo
// webhook (quando a próxima cobrança é confirmada) quanto pela sincronização
// de status nas telas, como fallback caso o webhook não dispare.
export async function applyPendingPlanChange(tenantId: string): Promise<void> {
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("pending_plan, pending_plan_effective_at, pending_keep_tenant_ids")
    .eq("id", tenantId)
    .maybeSingle<{
      pending_plan: string | null;
      pending_plan_effective_at: string | null;
      pending_keep_tenant_ids: string[] | null;
    }>();

  if (!tenant?.pending_plan || !tenant.pending_plan_effective_at) return;
  if (new Date() < new Date(tenant.pending_plan_effective_at)) return;

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

// Fonte de verdade primária é o webhook (app/api/webhooks/asaas/route.ts),
// mas ele depende de estar bem configurado no painel Asaas e de o Asaas
// efetivamente entregar o evento. Esta função é o fallback: consulta o
// Asaas direto e sincroniza o status do tenant, cobrindo casos onde o
// webhook nunca chegou (ex: cliente restaurado manualmente no painel Asaas
// não dispara PAYMENT_RECEIVED). Chamada sempre que o usuário checa status
// (botão "Verificar status", página de assinatura) — também aplica downgrade
// agendado se o prazo já passou.
export async function syncTenantStatusWithAsaas(tenantId: string): Promise<string | null> {
  await applyPendingPlanChange(tenantId);

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
      .update({
        status: "suspended",
        asaas_subscription_id: null,
        pending_plan: null,
        pending_plan_effective_at: null,
        pending_keep_tenant_ids: null,
      })
      .eq("id", tenantId);
  }
}

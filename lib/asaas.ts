const BASE_URL = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3";

export const PLAN_PRICES: Record<string, number> = {
  starter: 97,
  pro: 297,
  premium: 697,
};

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: process.env.ASAAS_API_KEY!,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asaas ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
}

export interface AsaasSubscription {
  id: string;
  status: string;          // ACTIVE | INACTIVE | EXPIRED
  nextDueDate: string;     // YYYY-MM-DD
  value: number;
  billingType: string;
}

export async function createCustomer(opts: {
  name: string;
  email: string;
  cpfCnpj?: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  return request<AsaasCustomer>("/customers", {
    method: "POST",
    body: JSON.stringify(opts),
  });
}

export type BillingType = "BOLETO" | "PIX" | "CREDIT_CARD";

export async function createSubscription(opts: {
  customer: string;
  plan: string;
  email: string;
  billingType?: BillingType;
}): Promise<AsaasSubscription> {
  const value = PLAN_PRICES[opts.plan] ?? PLAN_PRICES.starter;
  const nextDueDate = new Date();
  nextDueDate.setDate(nextDueDate.getDate() + 1);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  return request<AsaasSubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: opts.customer,
      billingType: opts.billingType ?? "PIX",
      value,
      nextDueDate: nextDueDate.toISOString().slice(0, 10),
      cycle: "MONTHLY",
      description: `Fideliza.OS — Plano ${opts.plan}`,
      externalReference: opts.customer,
      ...(siteUrl && {
        callback: {
          successUrl: `${siteUrl}/conta/aguardando`,
          autoRedirect: true,
        },
      }),
    }),
  });
}

// Detecta o erro do Asaas quando o customer salvo no nosso banco foi
// removido diretamente no painel deles (fora do fluxo normal de cancelamento).
export function isRemovedCustomerError(err: unknown): boolean {
  return err instanceof Error && /cliente removido|customer.*removed/i.test(err.message);
}

export async function getSubscription(
  subscriptionId: string,
): Promise<AsaasSubscription> {
  return request<AsaasSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function updateSubscriptionCallback(
  subscriptionId: string,
): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) return;
  await request(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({
      callback: {
        successUrl: `${siteUrl}/conta/aguardando`,
        autoRedirect: true,
      },
    }),
  });
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await request(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
}

// Muda o valor cobrado nos próximos ciclos, sem mexer numa cobrança já
// gerada e pendente (updatePendingPayments: false) — é assim que dá pra
// agendar um downgrade pra só valer a partir do próximo vencimento.
export async function updateSubscriptionValue(
  subscriptionId: string,
  value: number,
): Promise<void> {
  await request(`/subscriptions/${subscriptionId}`, {
    method: "PUT",
    body: JSON.stringify({ value, updatePendingPayments: false }),
  });
}

// Cobrança avulsa (fora da assinatura recorrente) — usada pra cobrar só a
// diferença proporcional quando o dono faz upgrade no meio do ciclo.
export async function createOneOffPayment(opts: {
  customer: string;
  billingType?: BillingType;
  value: number;
  dueDate: string;
  description: string;
}): Promise<AsaasPayment> {
  return request<AsaasPayment>("/payments", {
    method: "POST",
    body: JSON.stringify({
      customer: opts.customer,
      billingType: opts.billingType ?? "PIX",
      value: opts.value,
      dueDate: opts.dueDate,
      description: opts.description,
    }),
  });
}

export interface AsaasPayment {
  id: string;
  status: string;
  invoiceUrl: string;
  bankSlipUrl: string | null;
  value: number;
  dueDate: string;
}

export async function getSubscriptionFirstPayment(
  subscriptionId: string,
): Promise<AsaasPayment | null> {
  const res = await request<{ data: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments?limit=1&offset=0`,
  );
  return res.data?.[0] ?? null;
}

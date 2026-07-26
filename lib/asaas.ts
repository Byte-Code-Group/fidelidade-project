const BASE_URL = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3";

export type AsaasEnvironment = "sandbox" | "production";

/**
 * Credencial usada na chamada. Omitido = conta da PLATAFORMA (env), que cobra
 * a mensalidade dos negócios. Preenchido = conta do próprio negócio, usada
 * para cobrar os clientes finais dele (ver lib/tenant-asaas.ts).
 */
export interface AsaasConta {
  apiKey: string;
  environment: AsaasEnvironment;
}

export function baseUrlDe(environment: AsaasEnvironment): string {
  return environment === "sandbox"
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
}

export const PLAN_PRICES: Record<string, number> = {
  starter: 97,
  pro: 297,
  premium: 697,
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  conta?: AsaasConta,
): Promise<T> {
  const res = await fetch(`${conta ? baseUrlDe(conta.environment) : BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      access_token: conta?.apiKey ?? process.env.ASAAS_API_KEY!,
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

// ---------- Chamadas na conta do próprio negócio ----------
// Mesmos endpoints, credencial diferente: quem recebe é o negócio, não a
// plataforma. Ver lib/tenant-asaas.ts.

export interface AsaasAccountInfo {
  name?: string;
  email?: string;
  companyName?: string;
  personType?: string;
}

/** Valida a chave: se responder, a credencial existe e é do ambiente certo. */
export async function getMyAccount(conta: AsaasConta): Promise<AsaasAccountInfo> {
  return request<AsaasAccountInfo>("/myAccount", {}, conta);
}

export async function createCustomerNaConta(
  conta: AsaasConta,
  opts: { name: string; email?: string; cpfCnpj: string; phone?: string },
): Promise<AsaasCustomer> {
  return request<AsaasCustomer>(
    "/customers",
    { method: "POST", body: JSON.stringify(opts) },
    conta,
  );
}

export async function createSubscriptionNaConta(
  conta: AsaasConta,
  opts: {
    customer: string;
    value: number;
    description: string;
    billingType?: BillingType;
    externalReference?: string;
    successUrl?: string;
  },
): Promise<AsaasSubscription> {
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 1);

  return request<AsaasSubscription>(
    "/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        customer: opts.customer,
        // UNDEFINED deixa o cliente escolher pix/boleto/cartão na fatura.
        billingType: opts.billingType ?? "UNDEFINED",
        value: opts.value,
        nextDueDate: vencimento.toISOString().slice(0, 10),
        cycle: "MONTHLY",
        description: opts.description,
        externalReference: opts.externalReference,
        ...(opts.successUrl && {
          callback: { successUrl: opts.successUrl, autoRedirect: true },
        }),
      }),
    },
    conta,
  );
}

export async function cancelSubscriptionNaConta(
  conta: AsaasConta,
  subscriptionId: string,
): Promise<void> {
  await request(`/subscriptions/${subscriptionId}`, { method: "DELETE" }, conta);
}

export async function getSubscriptionFirstPaymentNaConta(
  conta: AsaasConta,
  subscriptionId: string,
): Promise<AsaasPayment | null> {
  const res = await request<{ data: AsaasPayment[] }>(
    `/subscriptions/${subscriptionId}/payments?limit=1&offset=0`,
    {},
    conta,
  );
  return res.data?.[0] ?? null;
}

export interface AsaasWebhook {
  id: string;
  url: string;
}

/** Webhook na conta do negócio apontando de volta pra nós. */
export async function createWebhookNaConta(
  conta: AsaasConta,
  opts: { name: string; url: string; email: string; authToken: string },
): Promise<AsaasWebhook> {
  return request<AsaasWebhook>(
    "/webhooks",
    {
      method: "POST",
      body: JSON.stringify({
        name: opts.name,
        url: opts.url,
        email: opts.email,
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken: opts.authToken,
        sendType: "SEQUENTIALLY",
        events: [
          "PAYMENT_CREATED",
          "PAYMENT_CONFIRMED",
          "PAYMENT_RECEIVED",
          "PAYMENT_OVERDUE",
          "PAYMENT_DELETED",
          "PAYMENT_REFUNDED",
        ],
      }),
    },
    conta,
  );
}

export async function deleteWebhookNaConta(
  conta: AsaasConta,
  webhookId: string,
): Promise<void> {
  await request(`/webhooks/${webhookId}`, { method: "DELETE" }, conta);
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

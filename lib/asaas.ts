const BASE_URL = process.env.ASAAS_SANDBOX === "true"
  ? "https://sandbox.asaas.com/api/v3"
  : "https://api.asaas.com/v3";

const PLAN_PRICES: Record<string, number> = {
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
    }),
  });
}

export async function getSubscription(
  subscriptionId: string,
): Promise<AsaasSubscription> {
  return request<AsaasSubscription>(`/subscriptions/${subscriptionId}`);
}

export async function cancelSubscription(
  subscriptionId: string,
): Promise<void> {
  await request(`/subscriptions/${subscriptionId}`, { method: "DELETE" });
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

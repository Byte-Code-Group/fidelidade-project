import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscription, PLAN_PRICES } from "@/lib/asaas";
import { FlashToast } from "@/components/flash-toast";
import { ownerCancelSubscription, ownerChangePlan } from "../actions";

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  premium: "Premium",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  pending: "Aguardando pagamento",
  suspended: "Suspensa",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export default async function OwnerAssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { tenantId } = await requireTenantOwner();
  const { error, saved } = await searchParams;

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("saas_plan, status, asaas_subscription_id")
    .eq("id", tenantId)
    .maybeSingle<{
      saas_plan: string;
      status: string;
      asaas_subscription_id: string | null;
    }>();

  const status = tenant?.status ?? "";
  const isActive = status === "active";

  let subscription: { status: string; nextDueDate: string; value: number } | null = null;
  if (tenant?.asaas_subscription_id && process.env.ASAAS_API_KEY) {
    try {
      subscription = await getSubscription(tenant.asaas_subscription_id);
    } catch {
      // Asaas offline ou id inválido — mostra só o status local.
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Assinatura</h1>
        <p className="mt-1 text-sm text-gray-500">
          Plano atual, troca de plano e cancelamento.
        </p>
      </div>

      <FlashToast error={error} saved={saved} successMessage="Alterações salvas." />

      {!isActive && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-400">
          {status === "suspended"
            ? "Sua assinatura está suspensa e o portal fica indisponível para os clientes. Escolha um plano abaixo e finalize o pagamento para reativar."
            : "Assinatura aguardando confirmação de pagamento. Escolha um plano abaixo para gerar (ou refazer) a cobrança."}
        </div>
      )}

      <Card>
        <CardContent className="space-y-2">
          <h2 className="font-semibold">Plano atual</h2>
          <p className="text-2xl font-bold">
            {PLAN_LABEL[tenant?.saas_plan ?? ""] ?? tenant?.saas_plan ?? "—"}
          </p>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
          >
            {STATUS_LABEL[status] ?? status ?? "—"}
          </span>
          {subscription && (
            <p className="text-xs text-gray-500">
              Asaas: {subscription.status} · R$ {subscription.value} · próx. vencimento{" "}
              {new Date(subscription.nextDueDate).toLocaleDateString("pt-BR")}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <h2 className="font-semibold">{isActive ? "Trocar de plano" : "Assinar / Reativar"}</h2>
          <p className="text-xs text-gray-500">
            {isActive
              ? "Trocar de plano cancela a assinatura atual e cria uma nova cobrança imediata (sem prorata)."
              : "Escolha o plano e a forma de pagamento — você será redirecionado para o checkout do Asaas para concluir o pagamento."}
          </p>
          <form action={ownerChangePlan} className="space-y-3">
            <Select name="plan" defaultValue={tenant?.saas_plan}>
              {Object.entries(PLAN_PRICES).map(([key, price]) => (
                <option key={key} value={key}>
                  {PLAN_LABEL[key] ?? key} — R$ {price}/mês
                </option>
              ))}
            </Select>
            <Select name="billing_type" defaultValue="CREDIT_CARD">
              <option value="CREDIT_CARD">Cartão de crédito</option>
              <option value="PIX">PIX</option>
            </Select>
            <Button type="submit">
              {isActive ? "Trocar plano" : "Assinar e pagar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {isActive && tenant?.asaas_subscription_id && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-semibold text-red-600">Cancelar assinatura</h2>
            <p className="text-sm text-gray-500">
              Seu portal será suspenso ao cancelar. Você pode assinar novamente quando quiser.
            </p>
            <form action={ownerCancelSubscription}>
              <Button type="submit" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                Cancelar assinatura
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

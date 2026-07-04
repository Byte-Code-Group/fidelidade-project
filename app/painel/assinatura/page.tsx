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

      <Card>
        <CardContent className="space-y-2">
          <h2 className="font-semibold">Plano atual</h2>
          <p className="text-2xl font-bold">
            {PLAN_LABEL[tenant?.saas_plan ?? ""] ?? tenant?.saas_plan ?? "—"}
          </p>
          <p className="text-sm text-gray-500">Status: {tenant?.status ?? "—"}</p>
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
          <h2 className="font-semibold">Trocar de plano</h2>
          <p className="text-xs text-gray-500">
            Trocar de plano cancela a assinatura atual e cria uma nova cobrança
            imediata (sem prorata).
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
            <Button type="submit">Trocar plano</Button>
          </form>
        </CardContent>
      </Card>

      {tenant?.asaas_subscription_id && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-semibold text-red-600">Cancelar assinatura</h2>
            <p className="text-sm text-gray-500">
              Seu portal será suspenso ao cancelar. Esta ação não pode ser desfeita.
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

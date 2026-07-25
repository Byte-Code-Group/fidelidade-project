import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { getAuthUser } from "@/lib/supabase/server";
import { getTenantOwner } from "@/lib/owner";
import { PLAN_CATALOG } from "@/lib/plan-catalog";
import { PLAN_PRICES } from "@/lib/asaas";
import { initiatePayment } from "../actions";
import { FormError } from "@/components/ui/form-alert";

const PLANS = PLAN_CATALOG.map((p) => ({ ...p, price: PLAN_PRICES[p.key] }));

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/conta/login");

  const owner = await getTenantOwner();
  if (!owner) redirect("/conta/configurar");

  const { error } = await searchParams;

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-600">
          Passo 2 de 2
        </div>
        <h1 className="text-2xl font-bold">Escolha seu plano</h1>
        <p className="mt-1 text-sm text-gray-500">Cancele a qualquer momento.</p>
      </div>

      <div className="mx-auto max-w-lg">
        <FormError error={error} />
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.key}
            className={
              plan.highlight
                ? "flex flex-col border-2 border-blue-600 shadow-lg"
                : "flex flex-col"
            }
          >
            <CardContent className="flex flex-1 flex-col p-6">
              {plan.highlight && (
                <span className="mb-2 inline-block w-fit rounded-full bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">
                  Mais popular
                </span>
              )}
              <h2 className="text-lg font-bold">{plan.name}</h2>
              <p className="mt-1">
                <span className="text-3xl font-bold">R$ {plan.price}</span>
                <span className="text-sm text-gray-400">/mês</span>
              </p>

              <ul className="mt-4 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-gray-500">
                    ✓ {f}
                  </li>
                ))}
              </ul>

              <form action={initiatePayment} className="mt-6 space-y-2">
                <input type="hidden" name="plan" value={plan.key} />
                <Select name="billing_type" defaultValue="CREDIT_CARD" className="w-full text-sm">
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                  <option value="PIX">PIX</option>
                </Select>
                <Button
                  type="submit"
                  className="w-full"
                  variant={plan.highlight ? "primary" : "outline"}
                >
                  Assinar {plan.name}
                </Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

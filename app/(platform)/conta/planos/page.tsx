import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { getAuthUser } from "@/lib/supabase/server";
import { getTenantOwner } from "@/lib/owner";
import { initiatePayment } from "../actions";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 97,
    features: ["1 negócio", "Até 200 clientes", "IA com 50k tokens/mês", "Módulos básicos"],
  },
  {
    key: "pro",
    name: "Pro",
    price: 297,
    features: [
      "Até 3 negócios",
      "Até 1.000 clientes",
      "IA com 500k tokens/mês",
      "Todos os módulos",
    ],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    price: 697,
    features: [
      "Negócios ilimitados",
      "Clientes ilimitados",
      "IA ilimitada",
      "Todos os módulos + suporte prioritário",
    ],
  },
];

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
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-600">
          Passo 2 de 2
        </div>
        <h1 className="text-2xl font-bold">Escolha seu plano</h1>
        <p className="mt-1 text-sm text-gray-500">Cancele a qualquer momento.</p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {decodeURIComponent(error)}
        </p>
      )}

      <div className="grid max-w-4xl gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.key}
            className={plan.highlight ? "flex flex-col border-2 border-blue-600" : "flex flex-col"}
          >
            <CardContent className="flex flex-1 flex-col">
              {plan.highlight && (
                <span className="mb-2 inline-block w-fit rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                  Mais popular
                </span>
              )}
              <h2 className="font-bold">{plan.name}</h2>
              <p className="mt-1">
                <span className="text-2xl font-bold">R$ {plan.price}</span>
                <span className="text-xs text-gray-400">/mês</span>
              </p>
              <ul className="mt-2 flex-1 space-y-0.5">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-gray-500">
                    ✓ {f}
                  </li>
                ))}
              </ul>

              <form action={initiatePayment} className="mt-4 space-y-2">
                <input type="hidden" name="plan" value={plan.key} />
                <Select name="billing_type" defaultValue="CREDIT_CARD" className="w-full text-sm">
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                  <option value="PIX">PIX</option>
                </Select>
                <Button type="submit" className="w-full" variant={plan.highlight ? "primary" : "outline"}>
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

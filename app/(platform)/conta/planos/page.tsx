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

      <div className="space-y-4">
        {PLANS.map((plan) => (
          <Card
            key={plan.key}
            className={plan.highlight ? "border-2 border-blue-600" : undefined}
          >
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  {plan.highlight && (
                    <span className="mb-1.5 inline-block w-fit rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                      Mais popular
                    </span>
                  )}
                  <h2 className="font-bold">{plan.name}</h2>
                </div>
                <p className="shrink-0 whitespace-nowrap text-right">
                  <span className="text-2xl font-bold">R$ {plan.price}</span>
                  <span className="text-xs text-gray-400">/mês</span>
                </p>
              </div>

              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="text-sm text-gray-500">
                    ✓ {f}
                  </li>
                ))}
              </ul>

              <form action={initiatePayment} className="mt-4 flex gap-2">
                <input type="hidden" name="plan" value={plan.key} />
                <Select name="billing_type" defaultValue="CREDIT_CARD" className="w-36 shrink-0 text-sm">
                  <option value="CREDIT_CARD">Cartão</option>
                  <option value="PIX">PIX</option>
                </Select>
                <Button type="submit" className="flex-1" variant={plan.highlight ? "primary" : "outline"}>
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

import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { initiatePayment } from "../actions";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 97,
    features: ["Até 200 clientes", "IA com 50k tokens/mês", "Módulos básicos"],
  },
  {
    key: "pro",
    name: "Pro",
    price: 297,
    features: ["Até 1.000 clientes", "IA com 500k tokens/mês", "Todos os módulos"],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    price: 697,
    features: ["Clientes ilimitados", "IA ilimitada", "Todos os módulos + suporte prioritário"],
  },
];

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/conta/login");

  const db = createAdminClient();
  const { data: pu } = await db
    .from("platform_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle<{ tenant_id: string | null }>();

  if (!pu?.tenant_id) redirect("/conta/configurar");

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

      <div className="space-y-3">
        {PLANS.map((plan) => (
          <Card
            key={plan.key}
            className={plan.highlight ? "border-2 border-blue-600" : ""}
          >
            <CardContent>
              {plan.highlight && (
                <span className="mb-2 inline-block rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                  Mais popular
                </span>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold">{plan.name}</h2>
                  <ul className="mt-1 space-y-0.5">
                    {plan.features.map((f) => (
                      <li key={f} className="text-sm text-gray-500">
                        ✓ {f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">
                    R$ {plan.price}
                  </p>
                  <p className="text-xs text-gray-400">/mês</p>
                </div>
              </div>

              <form action={initiatePayment} className="mt-4 flex items-center gap-3">
                <input type="hidden" name="plan" value={plan.key} />
                <Select name="billing_type" defaultValue="PIX" className="text-sm">
                  <option value="PIX">PIX</option>
                  <option value="BOLETO">Boleto</option>
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

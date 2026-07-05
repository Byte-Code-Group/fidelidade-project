import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlanFields } from "@/components/plan-fields";
import type { BusinessPlan } from "@/lib/types";
import { createPlan, deletePlan, updatePlan } from "../../../../actions";

export default async function PlansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: plans } = await db
    .from("business_plans")
    .select("*")
    .eq("tenant_id", id)
    .order("display_order", { ascending: true })
    .returns<BusinessPlan[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Planos/assinaturas que o cliente vende no portal (aba Planos).
      </p>

      {(plans ?? []).map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3">
            <form action={updatePlan.bind(null, id, p.id)} className="space-y-3">
              <PlanFields plan={p} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={deletePlan.bind(null, id, p.id)}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Excluir plano
              </button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Novo plano</h2>
          <form action={createPlan.bind(null, id)} className="space-y-3">
            <PlanFields />
            <div className="flex justify-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

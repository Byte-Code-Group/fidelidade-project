import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlanFields } from "@/components/plan-fields";
import type { BusinessPlan } from "@/lib/types";
import { ownerCreatePlan, ownerDeletePlan, ownerUpdatePlan } from "../actions";

export default async function OwnerPlansPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: plans } = await db
    .from("business_plans")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .returns<BusinessPlan[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Planos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Planos/assinaturas que aparecem na aba Planos do portal do cliente.
        </p>
      </div>

      {(plans ?? []).map((p) => (
        <Card key={p.id}>
          <CardContent className="space-y-3">
            <form action={ownerUpdatePlan.bind(null, p.id)} className="space-y-3">
              <PlanFields plan={p} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={ownerDeletePlan.bind(null, p.id)}>
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
          <form action={ownerCreatePlan} className="space-y-3">
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

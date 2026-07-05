import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlansList } from "@/components/plans-list";
import type { BusinessPlan } from "@/lib/types";
import {
  ownerCreatePlan,
  ownerUpdatePlan,
  ownerDeletePlan,
  ownerReorderPlans,
} from "../actions";

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
          Arraste pelo ⠿ pra reordenar.
        </p>
      </div>

      <PlansList
        plans={plans ?? []}
        createAction={ownerCreatePlan}
        updateAction={ownerUpdatePlan}
        deleteAction={ownerDeletePlan}
        reorderAction={ownerReorderPlans}
      />
    </div>
  );
}

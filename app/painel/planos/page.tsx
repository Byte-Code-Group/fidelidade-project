import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader icon="receipt" title="Planos" subtitle="Planos/assinaturas que aparecem na aba Planos do portal do cliente. Arraste pela alça para reordenar." />

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

import { PageHeader } from "@/components/ui/page-header";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { MissionsList } from "@/components/missions-list";
import type { Mission } from "@/lib/types";
import {
  ownerCreateMission,
  ownerUpdateMission,
  ownerDeleteMission,
  ownerReorderMissions,
} from "../actions";

export default async function OwnerMissionsPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: missions } = await db
    .from("missions")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .returns<Mission[]>();

  return (
    <div className="space-y-4">
      <PageHeader icon="award" title="Missões" subtitle="Missões que aparecem no portal de Engajamento do cliente. Arraste pela alça para reordenar." />

      <MissionsList
        missions={missions ?? []}
        createAction={ownerCreateMission}
        updateAction={ownerUpdateMission}
        deleteAction={ownerDeleteMission}
        reorderAction={ownerReorderMissions}
      />
    </div>
  );
}

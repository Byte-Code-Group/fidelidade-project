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
      <div>
        <h1 className="text-2xl font-bold">Missões</h1>
        <p className="mt-1 text-sm text-gray-500">
          Missões que aparecem no portal de Engajamento do cliente. Arraste pelo
          ⠿ pra reordenar.
        </p>
      </div>

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

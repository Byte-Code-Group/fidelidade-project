import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { RedemptionsList, type RedemptionRow } from "@/components/redemptions-list";
import { ownerApproveRedemption, ownerRejectRedemption } from "../actions";

export default async function OwnerRedemptionsPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: redemptions } = await db
    .from("reward_redemptions")
    .select("*, users!reward_redemptions_user_id_fkey(full_name, email)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .returns<RedemptionRow[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Resgates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Prêmios resgatados pelos clientes na Loja de Resgate do portal.
        </p>
      </div>

      <RedemptionsList
        redemptions={redemptions ?? []}
        approveAction={ownerApproveRedemption}
        rejectAction={ownerRejectRedemption}
      />
    </div>
  );
}

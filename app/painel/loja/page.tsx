import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { RewardsList } from "@/components/rewards-list";
import type { Reward } from "@/lib/types";
import {
  ownerCreateReward,
  ownerUpdateReward,
  ownerDeleteReward,
  ownerReorderRewards,
} from "../actions";

export default async function OwnerRewardsPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: rewards } = await db
    .from("rewards")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .returns<Reward[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Loja</h1>
        <p className="mt-1 text-sm text-gray-500">
          Prêmios que o cliente troca por pontos na Loja de Resgate do portal.
          Arraste pelo ⠿ pra reordenar.
        </p>
      </div>

      <RewardsList
        rewards={rewards ?? []}
        createAction={ownerCreateReward}
        updateAction={ownerUpdateReward}
        deleteAction={ownerDeleteReward}
        reorderAction={ownerReorderRewards}
      />
    </div>
  );
}

import { PageHeader } from "@/components/ui/page-header";
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
      <PageHeader icon="store" title="Loja" subtitle="Prêmios que o cliente troca por pontos na Loja de Resgate do portal. Arraste pela alça para reordenar." />

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

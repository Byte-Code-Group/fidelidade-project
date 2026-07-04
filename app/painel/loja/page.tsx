import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { RewardFields } from "@/components/reward-fields";
import type { Reward } from "@/lib/types";
import { ownerCreateReward, ownerDeleteReward, ownerUpdateReward } from "../actions";

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
        </p>
      </div>

      {(rewards ?? []).map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-3">
            <form action={ownerUpdateReward.bind(null, r.id)} className="space-y-3">
              <RewardFields reward={r} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={ownerDeleteReward.bind(null, r.id)}>
              <button
                type="submit"
                className="text-xs text-red-600 hover:underline"
              >
                Excluir prêmio
              </button>
            </form>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Novo prêmio</h2>
          <form action={ownerCreateReward} className="space-y-3">
            <RewardFields />
            <div className="flex justify-end">
              <Button type="submit">Adicionar</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

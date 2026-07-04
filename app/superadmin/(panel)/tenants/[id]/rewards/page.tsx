import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { RewardFields } from "@/components/reward-fields";
import type { Reward } from "@/lib/types";
import { createReward, deleteReward, updateReward } from "../../../../actions";

export default async function RewardsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: rewards } = await db
    .from("rewards")
    .select("*")
    .eq("tenant_id", id)
    .order("display_order", { ascending: true })
    .returns<Reward[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        Prêmios que o cliente troca por pontos na Loja de Resgate do portal.
      </p>

      {(rewards ?? []).map((r) => (
        <Card key={r.id}>
          <CardContent className="space-y-3">
            <form action={updateReward.bind(null, id, r.id)} className="space-y-3">
              <RewardFields reward={r} />
              <div className="flex justify-end">
                <Button type="submit" className="px-3 py-1.5">
                  Salvar
                </Button>
              </div>
            </form>
            <form action={deleteReward.bind(null, id, r.id)}>
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
          <form action={createReward.bind(null, id)} className="space-y-3">
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

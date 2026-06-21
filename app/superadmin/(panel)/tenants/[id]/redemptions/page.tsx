import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RewardRedemption } from "@/lib/types";
import { approveRedemption, rejectRedemption } from "../../../../actions";

interface RedemptionRow extends RewardRedemption {
  users: { full_name: string | null; email: string | null } | null;
}

const statusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  redeemed: "bg-green-500/15 text-green-600",
};

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  redeemed: "Entregue",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function RedemptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: redemptions } = await db
    .from("reward_redemptions")
    .select("*, users(full_name, email)")
    .eq("tenant_id", id)
    .order("created_at", { ascending: false })
    .returns<RedemptionRow[]>();

  const pending = (redemptions ?? []).filter((r) => r.status === "pending");
  const done = (redemptions ?? []).filter((r) => r.status === "redeemed");

  return (
    <div className="space-y-6">
      <p className="text-sm opacity-60">
        Resgates solicitados pelos clientes na Loja. Marque como entregue após
        dar o prêmio presencialmente.
      </p>

      {/* Pendentes */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          Pendentes ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <Card>
            <div className="px-5 py-8 text-center text-sm opacity-50">
              Nenhum resgate pendente. 🎉
            </div>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-black/5">
              {pending.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.reward_name}</p>
                    <p className="text-xs opacity-60">
                      {r.users?.full_name ?? r.users?.email ?? "—"} ·{" "}
                      {r.points_spent} pts · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <Badge className={statusStyle[r.status] ?? "bg-black/5"}>
                    {statusLabel[r.status] ?? r.status}
                  </Badge>
                  <form action={approveRedemption.bind(null, id, r.id)}>
                    <Button type="submit" className="px-3 py-1.5 text-sm">
                      Marcar entregue
                    </Button>
                  </form>
                  <form action={rejectRedemption.bind(null, id, r.id)}>
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Cancelar
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Histórico */}
      {done.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold opacity-60">
            Histórico ({done.length})
          </h2>
          <Card>
            <div className="divide-y divide-black/5">
              {done.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-5 py-3.5 opacity-70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{r.reward_name}</p>
                    <p className="text-xs opacity-60">
                      {r.users?.full_name ?? r.users?.email ?? "—"} ·{" "}
                      {r.points_spent} pts · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <Badge className={statusStyle[r.status] ?? "bg-black/5"}>
                    {statusLabel[r.status] ?? r.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

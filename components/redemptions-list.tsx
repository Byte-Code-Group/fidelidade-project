import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RewardRedemption } from "@/lib/types";

export interface RedemptionRow extends RewardRedemption {
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

export function RedemptionsList({
  redemptions,
  approveAction,
  rejectAction,
}: {
  redemptions: RedemptionRow[];
  approveAction: (redemptionId: string, formData: FormData) => void;
  rejectAction: (redemptionId: string, formData: FormData) => void;
}) {
  if (redemptions.length === 0) {
    return (
      <Card>
        <div className="px-5 py-8 text-center text-sm opacity-50">
          Nenhum resgate encontrado.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="divide-y divide-black/5">
        {redemptions.map((r) => (
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
            {r.status === "pending" && (
              <>
                <form action={approveAction.bind(null, r.id)}>
                  <Button type="submit" className="px-3 py-1.5 text-sm">
                    Marcar entregue
                  </Button>
                </form>
                <form action={rejectAction.bind(null, r.id)}>
                  <button type="submit" className="text-xs text-red-600 hover:underline">
                    Cancelar
                  </button>
                </form>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

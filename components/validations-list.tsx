import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MissionCompletion } from "@/lib/types";

export interface CompletionRow extends MissionCompletion {
  users: { full_name: string | null; email: string | null } | null;
  missions: { title: string; points: number } | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ValidationsList({
  completions,
  approveAction,
  rejectAction,
}: {
  completions: CompletionRow[];
  approveAction: (completionId: string, formData: FormData) => void;
  rejectAction: (completionId: string, formData: FormData) => void;
}) {
  const pending = completions.filter((c) => c.status === "pending_validation");
  const done = completions.filter((c) => c.status === "completed");

  return (
    <div className="space-y-6">
      <p className="text-sm opacity-60">
        Missões enviadas pelos clientes que precisam de validação manual antes
        de creditarem pontos.
      </p>

      {/* Pendentes */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          Aguardando validação ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <Card>
            <div className="px-5 py-8 text-center text-sm opacity-50">
              Nenhuma missão aguardando validação. ✓
            </div>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-black/5">
              {pending.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.missions?.title ?? "—"}</p>
                    <p className="text-xs opacity-60">
                      {c.users?.full_name ?? c.users?.email ?? "—"} ·{" "}
                      {c.missions?.points ?? 0} pts ·{" "}
                      {c.completed_at ? formatDate(c.completed_at) : "—"}
                    </p>
                  </div>
                  <Badge className="bg-amber-500/15 text-amber-600">Em análise</Badge>
                  <form action={approveAction.bind(null, c.id)}>
                    <Button type="submit" className="px-3 py-1.5 text-sm">
                      Aprovar
                    </Button>
                  </form>
                  <form action={rejectAction.bind(null, c.id)}>
                    <button type="submit" className="text-xs text-red-600 hover:underline">
                      Rejeitar
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
          <h2 className="text-sm font-semibold opacity-60">Aprovadas ({done.length})</h2>
          <Card>
            <div className="divide-y divide-black/5">
              {done.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.missions?.title ?? "—"}</p>
                    <p className="text-xs opacity-60">
                      {c.users?.full_name ?? c.users?.email ?? "—"} ·{" "}
                      {c.missions?.points ?? 0} pts ·{" "}
                      {c.completed_at ? formatDate(c.completed_at) : "—"}
                    </p>
                  </div>
                  <Badge className="bg-green-500/15 text-green-600">Aprovada</Badge>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

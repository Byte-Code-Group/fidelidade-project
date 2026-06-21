import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Reward } from "@/lib/types";
import { redeemReward } from "../actions";

const ERRORS: Record<string, string> = {
  pontos: "Você ainda não tem pontos suficientes para esse prêmio.",
  esgotado: "Esse prêmio está esgotado.",
  indisponivel: "Esse prêmio não está mais disponível.",
  sem_carteirinha: "Você ainda não tem uma carteirinha ativa.",
};

export default async function LojaPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();
  const { done, error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rewards }, { data: membership }] = await Promise.all([
    supabase
      .from("rewards")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .returns<Reward[]>(),
    supabase
      .from("memberships")
      .select("points_total")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<Pick<Membership, "points_total">>(),
  ]);

  const points = membership?.points_total ?? 0;

  return (
    <div>
      <PageHeader
        title="Loja de Resgate"
        subtitle="Troque seus pontos por recompensas."
        action={
          <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 dark:bg-white/5">
            <Icon name="award" className="h-5 w-5 text-[var(--primary)]" />
            <span className="font-bold text-[var(--primary)]">{points}</span>
            <span className="text-sm opacity-60">pontos</span>
          </div>
        }
      />

      {done && (
        <p className="mb-4 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600">
          🎉 Resgate solicitado! Retire seu prêmio na recepção.
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600">
          {ERRORS[error] ?? "Não foi possível resgatar agora."}
        </p>
      )}

      {!rewards || rewards.length === 0 ? (
        <EmptyState
          icon={<Icon name="store" className="h-6 w-6" />}
          title="Loja vazia por enquanto"
          description="Em breve novos prêmios para trocar pelos seus pontos."
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const out = r.stock !== null && r.stock <= 0;
            const canAfford = points >= r.points_cost;
            return (
              <div
                key={r.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white dark:bg-white/5"
              >
                <div className="flex h-32 items-center justify-center bg-[var(--primary)]/10">
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt={r.name} className="h-full w-full object-cover" />
                  ) : (
                    <Icon name="gift" className="h-10 w-10 text-[var(--primary)]" />
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold">{r.name}</h3>
                    <Badge className="shrink-0 bg-[var(--primary)]/10 text-[var(--primary)]">
                      {r.points_cost} pts
                    </Badge>
                  </div>
                  {r.description && (
                    <p className="mt-1 text-sm opacity-60">{r.description}</p>
                  )}
                  {r.stock !== null && (
                    <p className="mt-2 text-xs opacity-50">
                      {out ? "Esgotado" : `${r.stock} disponíveis`}
                    </p>
                  )}

                  <form action={redeemReward.bind(null, r.id)} className="mt-auto pt-4">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={out || !canAfford}
                      variant={canAfford && !out ? "primary" : "outline"}
                    >
                      {out
                        ? "Esgotado"
                        : canAfford
                          ? "Resgatar"
                          : `Faltam ${r.points_cost - points} pts`}
                    </Button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

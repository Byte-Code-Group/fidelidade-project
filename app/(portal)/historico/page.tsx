import { notFound, redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import type { IconKey } from "@/components/icons";
import type { Checkin, MissionCompletion, RewardRedemption } from "@/lib/types";

type EventKind = "checkin" | "mission" | "redemption";

interface TimelineEvent {
  id: string;
  kind: EventKind;
  label: string;
  sublabel?: string;
  points: number;
  date: string;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const kindMeta: Record<EventKind, { icon: IconKey; color: string }> = {
  checkin: { icon: "check", color: "text-green-600 bg-green-500/10" },
  mission: { icon: "award", color: "text-[var(--primary)] bg-[var(--primary)]/10" },
  redemption: { icon: "store", color: "text-amber-600 bg-amber-500/10" },
};

export default async function HistoricoPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: checkins },
    { data: completions },
    { data: redemptions },
  ] = await Promise.all([
    supabase
      .from("checkins")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<Checkin[]>(),
    supabase
      .from("mission_completions")
      .select("*, missions(title, points)")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .returns<
        (MissionCompletion & {
          missions: { title: string; points: number } | null;
        })[]
      >(),
    supabase
      .from("reward_redemptions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<RewardRedemption[]>(),
  ]);

  const events: TimelineEvent[] = [
    ...(checkins ?? []).map((c) => ({
      id: c.id,
      kind: "checkin" as const,
      label: "Check-in realizado",
      sublabel: `Período ${c.period_ref}`,
      points: c.points_earned,
      date: c.created_at,
    })),
    ...(completions ?? []).map((c) => ({
      id: c.id,
      kind: "mission" as const,
      label: c.missions?.title ?? "Missão concluída",
      sublabel: "Missão aprovada",
      points: c.missions?.points ?? 0,
      date: c.completed_at ?? c.id,
    })),
    ...(redemptions ?? []).map((r) => ({
      id: r.id,
      kind: "redemption" as const,
      label: r.reward_name,
      sublabel: r.status === "redeemed" ? "Entregue" : "Aguardando entrega",
      points: -r.points_spent,
      date: r.created_at,
    })),
  ].sort((a, b) => (b.date > a.date ? 1 : -1));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Histórico de Pontos"
        subtitle="Todas as movimentações da sua conta de pontos."
      />

      {events.length === 0 ? (
        <Card>
          <div className="px-5 py-10 text-center text-sm opacity-50">
            Nenhuma movimentação ainda. Faça seu primeiro check-in!
          </div>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-black/5">
            {events.map((ev) => {
              const meta = kindMeta[ev.kind];
              const positive = ev.points >= 0;
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-4 px-5 py-4"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${meta.color}`}
                  >
                    <Icon name={meta.icon} className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium leading-tight">{ev.label}</p>
                    {ev.sublabel && (
                      <p className="text-xs opacity-50">{ev.sublabel}</p>
                    )}
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-bold tabular-nums ${positive ? "text-green-600" : "text-red-500"}`}
                    >
                      {positive ? "+" : ""}
                      {ev.points} pts
                    </p>
                    <p className="text-xs opacity-40">{fmt(ev.date)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

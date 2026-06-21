import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { SocialLogo, isSocialKey } from "@/components/social-logos";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import type { Membership, Mission, MissionCompletion } from "@/lib/types";
import { completeMission } from "../actions";

export default async function EngajamentoPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Catálogo de missões ativas + conclusões do usuário + saldo de pontos.
  const [{ data: missions }, { data: completions }, { data: membership }] =
    await Promise.all([
      supabase
        .from("missions")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true })
        .returns<Mission[]>(),
      supabase
        .from("mission_completions")
        .select("mission_id, status")
        .eq("user_id", user.id)
        .returns<Pick<MissionCompletion, "mission_id" | "status">[]>(),
      supabase
        .from("memberships")
        .select("points_total")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<Pick<Membership, "points_total">>(),
    ]);

  const statusByMission = new Map(
    (completions ?? []).map((c) => [c.mission_id, c.status]),
  );
  const points = membership?.points_total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engajamento"
        subtitle="Complete missões, acumule pontos e troque na Loja."
        action={
          <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 dark:bg-white/5">
            <Icon name="award" className="h-5 w-5 text-[var(--primary)]" />
            <span className="font-bold text-[var(--primary)]">{points}</span>
            <span className="text-sm opacity-60">pontos</span>
          </div>
        }
      />

      {/* ---------- Saldo / Loja ---------- */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Icon name="store" />
            </div>
            <div>
              <h2 className="font-semibold">Você tem {points} pontos</h2>
              <p className="text-sm opacity-60">Troque por prêmios na Loja de Resgate.</p>
            </div>
          </div>
          <Link href="/loja">
            <Button>Ir para a Loja</Button>
          </Link>
        </CardContent>
      </Card>

      {/* ---------- Missões ---------- */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Missões</h2>
        {(missions ?? []).length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm opacity-70">
                Nenhuma missão disponível no momento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {(missions ?? []).map((mission) => {
              const status = statusByMission.get(mission.id);
              return (
                <Card key={mission.id}>
                  <CardContent className="flex items-start gap-3">
                    {isSocialKey(mission.icon) ? (
                      <SocialLogo name={mission.icon} className="h-8 w-8" />
                    ) : (
                      <div className="text-2xl">{mission.icon ?? "🎯"}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-medium">{mission.title}</h3>
                        <Badge className="shrink-0 bg-[var(--secondary)]/10 text-[var(--secondary)]">
                          +{mission.points}
                        </Badge>
                      </div>
                      {mission.description && (
                        <p className="mt-0.5 text-sm opacity-70">
                          {mission.description}
                        </p>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        {status === "completed" ? (
                          <span className="text-sm font-medium text-green-600">
                            ✓ Concluída
                          </span>
                        ) : status === "pending_validation" ? (
                          <span className="text-sm font-medium opacity-60">
                            ⏳ Em análise
                          </span>
                        ) : (
                          <>
                            {mission.external_url && (
                              <a
                                href={mission.external_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="outline" type="button">
                                  Abrir
                                </Button>
                              </a>
                            )}
                            <form action={completeMission.bind(null, mission.id)}>
                              <Button type="submit">
                                {mission.requires_validation
                                  ? "Enviar p/ validação"
                                  : "Concluir"}
                              </Button>
                            </form>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { CarePlan, CarePlanStep } from "@/lib/types";

interface PlanWithSteps extends CarePlan {
  care_plan_steps: CarePlanStep[];
}

const statusStyle: Record<string, string> = {
  active: "bg-blue-500/10 text-blue-600",
  completed: "bg-green-500/10 text-green-600",
  paused: "bg-amber-500/10 text-amber-600",
};

const statusLabel: Record<string, string> = {
  active: "Em andamento",
  completed: "Concluído",
  paused: "Pausado",
};

export default async function TratamentosPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { data: plans } = await supabase
    .from("care_plans")
    .select("*, care_plan_steps(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<PlanWithSteps[]>();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus Tratamentos"
        subtitle="Acompanhe a evolução dos seus procedimentos."
      />

      {!plans || plans.length === 0 ? (
        <EmptyState
          icon={<Icon name="activity" className="h-6 w-6" />}
          title="Nenhum tratamento encontrado"
          description={`Quando um plano de acompanhamento for iniciado, ele aparecerá aqui com cada etapa e progresso. Fale com a ${ctx.settings.ai_name} para saber mais.`}
        >
          <Link href="/atendente">
            <Button variant="outline">
              <Icon name="sparkles" className="mr-2 h-4 w-4" />
              Falar com a {ctx.settings.ai_name}
            </Button>
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {plans.map((plan) => {
            const steps = [...(plan.care_plan_steps ?? [])].sort(
              (a, b) => a.display_order - b.display_order,
            );
            const doneCount = steps.filter((s) => s.done).length;
            const pct =
              steps.length > 0
                ? Math.round((doneCount / steps.length) * 100)
                : 0;

            return (
              <Card key={plan.id}>
                <CardContent className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{plan.title}</h3>
                        <Badge className={statusStyle[plan.status]}>
                          {statusLabel[plan.status]}
                        </Badge>
                      </div>
                      {plan.description && (
                        <p className="mt-0.5 text-sm opacity-60">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    {steps.length > 0 && (
                      <div className="text-right">
                        <p className="text-2xl font-bold text-[var(--primary)]">
                          {pct}%
                        </p>
                        <p className="text-xs opacity-50">concluído</p>
                      </div>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  {steps.length > 0 && (
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs opacity-60">
                        <span>Progresso do tratamento</span>
                        <span>
                          {doneCount} de {steps.length} etapas
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                        <div
                          className="h-full rounded-full bg-[var(--primary)] transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Etapas */}
                  {steps.length > 0 && (
                    <div className="space-y-2">
                      {steps.map((step, i) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-3 text-sm"
                        >
                          <div
                            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                              step.done
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                                : "border-2 border-black/15 text-black/30 dark:border-white/20 dark:text-white/30"
                            }`}
                          >
                            {step.done ? (
                              <svg viewBox="0 0 12 12" className="h-3 w-3">
                                <path
                                  d="M2 6l3 3 5-5"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  fill="none"
                                  strokeLinecap="round"
                                />
                              </svg>
                            ) : (
                              i + 1
                            )}
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <p
                              className={
                                step.done ? "line-through opacity-40" : ""
                              }
                            >
                              {step.title}
                            </p>
                            {step.notes && (
                              <p className="mt-0.5 text-xs opacity-50">
                                {step.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {steps.length === 0 && (
                    <p className="text-sm opacity-50">
                      Nenhuma etapa definida ainda.
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

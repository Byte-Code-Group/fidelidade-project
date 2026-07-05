import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CarePlan, CarePlanStep } from "@/lib/types";
import {
  createCarePlan,
  updateCarePlanStatus,
  deleteCarePlan,
  addCarePlanStep,
  markStepDone,
  deleteCarePlanStep,
} from "../../../../actions";

interface PlanRow extends CarePlan {
  users: { full_name: string | null; email: string | null } | null;
  care_plan_steps: CarePlanStep[];
}

interface ClientOption {
  id: string;
  full_name: string | null;
  email: string | null;
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

export default async function TratamentosAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const [{ data: plans }, { data: clients }] = await Promise.all([
    db
      .from("care_plans")
      .select("*, users!care_plans_user_id_fkey(full_name, email), care_plan_steps(*)")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .returns<PlanRow[]>(),
    db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", id)
      .eq("role", "client")
      .order("full_name", { ascending: true })
      .returns<ClientOption[]>(),
  ]);

  return (
    <div className="space-y-6">
      <p className="text-sm opacity-60">
        Planos de acompanhamento com etapas para cada cliente.
      </p>

      {/* Novo plano */}
      <Card>
        <CardContent>
          <h2 className="mb-4 font-semibold">Novo plano de acompanhamento</h2>
          {!clients || clients.length === 0 ? (
            <p className="text-sm opacity-50">Nenhum cliente cadastrado ainda.</p>
          ) : (
            <form action={createCarePlan.bind(null, id)} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Cliente</span>
                  <Select name="user_id" required>
                    <option value="">Selecione...</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name ?? c.email ?? c.id}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Título do plano</span>
                  <Input
                    name="title"
                    required
                    placeholder="Tratamento ortodôntico"
                  />
                </label>
              </div>
              <label className="block space-y-1.5">
                <span className="text-sm font-medium">Descrição</span>
                <Input name="description" placeholder="Opcional" />
              </label>
              <div className="flex justify-end">
                <Button type="submit">Criar plano</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Planos existentes */}
      {(plans ?? []).map((plan) => {
        const steps = [...(plan.care_plan_steps ?? [])].sort(
          (a, b) => a.display_order - b.display_order,
        );
        const doneCount = steps.filter((s) => s.done).length;
        const pct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0;

        return (
          <Card key={plan.id}>
            <CardContent className="space-y-4">
              {/* Cabeçalho do plano */}
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{plan.title}</h3>
                    <Badge className={statusStyle[plan.status]}>
                      {statusLabel[plan.status]}
                    </Badge>
                  </div>
                  <p className="text-xs opacity-60">
                    {plan.users?.full_name ?? plan.users?.email ?? "—"}
                    {plan.description && ` · ${plan.description}`}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {plan.status !== "completed" && (
                    <form
                      action={updateCarePlanStatus.bind(null, id, plan.id, "completed")}
                    >
                      <Button type="submit" className="px-3 py-1.5 text-sm">
                        Concluir
                      </Button>
                    </form>
                  )}
                  {plan.status === "active" && (
                    <form
                      action={updateCarePlanStatus.bind(null, id, plan.id, "paused")}
                    >
                      <button
                        type="submit"
                        className="text-xs opacity-60 hover:opacity-100"
                      >
                        Pausar
                      </button>
                    </form>
                  )}
                  {plan.status === "paused" && (
                    <form
                      action={updateCarePlanStatus.bind(null, id, plan.id, "active")}
                    >
                      <button
                        type="submit"
                        className="text-xs opacity-60 hover:opacity-100"
                      >
                        Retomar
                      </button>
                    </form>
                  )}
                  <form action={deleteCarePlan.bind(null, id, plan.id)}>
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </form>
                </div>
              </div>

              {/* Progresso */}
              {steps.length > 0 && (
                <div>
                  <div className="mb-1 flex justify-between text-xs opacity-60">
                    <span>
                      {doneCount} de {steps.length} etapas
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Etapas */}
              {steps.length > 0 && (
                <div className="divide-y divide-black/5 rounded-xl border border-black/5">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <form
                        action={markStepDone.bind(null, id, step.id, !step.done)}
                        className="shrink-0"
                      >
                        <button
                          type="submit"
                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition ${
                            step.done
                              ? "border-green-500 bg-green-500 text-white"
                              : "border-black/20 hover:border-[var(--primary)]"
                          }`}
                        >
                          {step.done && (
                            <svg viewBox="0 0 12 12" className="h-3 w-3">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                fill="none"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                        </button>
                      </form>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm ${step.done ? "line-through opacity-40" : ""}`}
                        >
                          {step.title}
                        </p>
                        {step.notes && (
                          <p className="text-xs opacity-50">{step.notes}</p>
                        )}
                      </div>
                      <form action={deleteCarePlanStep.bind(null, id, step.id)}>
                        <button
                          type="submit"
                          className="text-xs text-red-600 opacity-0 hover:opacity-100 group-hover:opacity-60"
                        >
                          ×
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar etapa */}
              <form
                action={addCarePlanStep.bind(null, id, plan.id)}
                className="flex gap-2"
              >
                <Input
                  name="title"
                  placeholder="Nova etapa..."
                  className="flex-1"
                />
                <Input name="notes" placeholder="Observação (opcional)" className="flex-1" />
                <Button type="submit" className="px-3 py-1.5 text-sm shrink-0">
                  + Etapa
                </Button>
              </form>
            </CardContent>
          </Card>
        );
      })}

      {(plans ?? []).length === 0 && (
        <Card>
          <div className="px-5 py-10 text-center text-sm opacity-50">
            Nenhum plano de acompanhamento ainda.
          </div>
        </Card>
      )}
    </div>
  );
}

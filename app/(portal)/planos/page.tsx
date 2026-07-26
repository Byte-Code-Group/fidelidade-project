import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { applyScheduledMembershipChange } from "@/lib/memberships";
import { subscribeToPlan } from "../actions";
import type { BusinessPlan, Membership } from "@/lib/types";

function formatPrice(value: number) {
  const [reais, cents] = value.toFixed(2).split(".");
  return { reais, cents };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type MembershipRow = Pick<
  Membership,
  "id" | "plan_id" | "valid_until" | "pending_plan_id" | "pending_plan_effective_at"
> & { subscription_status?: string | null; asaas_invoice_url?: string | null };

const STATUS_ASSINATURA: Record<string, string> = {
  pending: "Aguardando pagamento",
  active: "Pagamento em dia",
  overdue: "Pagamento atrasado",
  canceled: "Assinatura cancelada",
};

export default async function PlanosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();
  const { tenant } = ctx;

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [{ data: plans }, { data: membershipBefore }] = await Promise.all([
    supabase
      .from("business_plans")
      .select("*")
      .order("display_order", { ascending: true })
      .returns<BusinessPlan[]>(),
    supabase
      .from("memberships")
      .select(
        "id, plan_id, valid_until, pending_plan_id, pending_plan_effective_at, subscription_status, asaas_invoice_url",
      )
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<MembershipRow>(),
  ]);

  let membership = membershipBefore;
  if (
    membership?.pending_plan_id &&
    membership.pending_plan_effective_at &&
    new Date() >= new Date(membership.pending_plan_effective_at)
  ) {
    await applyScheduledMembershipChange(membership.id);
    const { data: refreshed } = await supabase
      .from("memberships")
      .select(
        "id, plan_id, valid_until, pending_plan_id, pending_plan_effective_at, subscription_status, asaas_invoice_url",
      )
      .eq("id", membership.id)
      .maybeSingle<MembershipRow>();
    membership = refreshed;
  }

  return (
    <div>
      <PageHeader
        title="Planos"
        subtitle="Escolha o plano ideal para você e sua família."
      />

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400"
        >
          {error}
        </p>
      )}

      {membership?.subscription_status &&
        STATUS_ASSINATURA[membership.subscription_status] && (
          <p className="mb-4 rounded-lg bg-black/5 px-3 py-2 text-sm dark:bg-white/10">
            {STATUS_ASSINATURA[membership.subscription_status]}
          </p>
        )}

      {!plans || plans.length === 0 ? (
        <EmptyState
          icon={<Icon name="card" className="h-6 w-6" />}
          title="Nenhum plano disponível"
          description="Os planos deste programa ainda não foram publicados."
        />
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="mx-auto flex w-fit gap-5 px-1">
            {plans.map((plan) => {
              const { reais, cents } = formatPrice(plan.price_month);
              const isCurrent = membership?.plan_id === plan.id;
              const isPendingTarget = membership?.pending_plan_id === plan.id;
              const currentPlan = plans.find((p) => p.id === membership?.plan_id);
              const isDowngrade = currentPlan ? plan.price_month < currentPlan.price_month : false;
              const aguardandoPagamento = membership?.subscription_status === "pending";

              return (
                <div
                  key={plan.id}
                  className={cn(
                    "relative flex w-72 shrink-0 flex-col rounded-2xl border bg-white p-6 dark:bg-white/5",
                    plan.is_popular
                      ? "border-[var(--primary)] ring-1 ring-[var(--primary)]"
                      : "border-black/5",
                  )}
                >
                  {plan.is_popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--primary-foreground)]">
                      Popular
                    </span>
                  )}

                  <h3 className="text-lg font-bold">{plan.name}</h3>
                  <p className="text-[11px] uppercase tracking-wider opacity-50">
                    {tenant.name}
                  </p>

                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-sm opacity-60">R$</span>
                    <span className="text-4xl font-bold leading-none">{reais}</span>
                    <span className="text-lg font-bold">,{cents}</span>
                    <span className="mb-0.5 text-sm opacity-60">/mês</span>
                  </div>

                  <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                    {plan.benefits.map((benefit) => (
                      <li key={benefit} className="flex items-start gap-2">
                        <Icon
                          name="check"
                          className="mt-0.5 h-4 w-4 shrink-0 text-green-500"
                        />
                        <span className="opacity-80">{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6">
                    {isCurrent && aguardandoPagamento && membership?.asaas_invoice_url ? (
                      <>
                        <a
                          href={membership.asaas_invoice_url}
                          className="block w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 text-center text-sm font-medium text-[var(--primary-foreground)] transition hover:opacity-90"
                        >
                          Pagar fatura
                        </a>
                        <p className="mt-2 text-center text-xs opacity-60">
                          Assinatura criada — falta concluir o pagamento.
                        </p>
                      </>
                    ) : isCurrent ? (
                      <>
                        <Button variant="outline" className="w-full" disabled>
                          Plano atual
                        </Button>
                        {membership?.pending_plan_id && membership.pending_plan_effective_at && (
                          <p className="mt-2 text-center text-xs opacity-60">
                            Válido até {formatDate(membership.pending_plan_effective_at)}
                          </p>
                        )}
                      </>
                    ) : isPendingTarget && membership?.pending_plan_effective_at ? (
                      <>
                        <Button variant="outline" className="w-full" disabled>
                          Agendado
                        </Button>
                        <p className="mt-2 text-center text-xs opacity-60">
                          Ativa em {formatDate(membership.pending_plan_effective_at)}
                        </p>
                      </>
                    ) : (
                      <form action={subscribeToPlan.bind(null, plan.id)}>
                        <Button
                          type="submit"
                          variant={plan.is_popular ? "primary" : "outline"}
                          className="w-full"
                        >
                          Assinar
                        </Button>
                        {isDowngrade && membership?.valid_until && (
                          <p className="mt-2 text-center text-xs opacity-60">
                            Passa a valer em {formatDate(membership.valid_until)}
                          </p>
                        )}
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

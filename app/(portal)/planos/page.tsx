import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import type { BusinessPlan, Membership } from "@/lib/types";

function formatPrice(value: number) {
  const [reais, cents] = value.toFixed(2).split(".");
  return { reais, cents };
}

export default async function PlanosPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();
  const { tenant } = ctx;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: plans }, { data: membership }] = await Promise.all([
    supabase
      .from("business_plans")
      .select("*")
      .order("display_order", { ascending: true })
      .returns<BusinessPlan[]>(),
    supabase
      .from("memberships")
      .select("plan_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<Pick<Membership, "plan_id">>(),
  ]);

  return (
    <div>
      <PageHeader
        title="Planos"
        subtitle="Escolha o plano ideal para você e sua família."
      />

      {!plans || plans.length === 0 ? (
        <EmptyState
          icon={<Icon name="card" className="h-6 w-6" />}
          title="Nenhum plano disponível"
          description="Os planos deste programa ainda não foram publicados."
        />
      ) : (
        <div className="flex flex-wrap justify-center gap-5">
          {plans.map((plan) => {
            const { reais, cents } = formatPrice(plan.price_month);
            const isCurrent = membership?.plan_id === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex w-full max-w-sm flex-col rounded-2xl border bg-white p-6 dark:bg-white/5",
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

                {plan.is_popular && plan.upgrade_discount_pct > 0 && (
                  <Badge className="mt-3 w-fit bg-green-500/15 text-green-600">
                    ✓ {plan.upgrade_discount_pct}% OFF no upgrade
                  </Badge>
                )}

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

                <Link href="/atendente" className="mt-6 block">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : (
                    <Button
                      variant={plan.is_popular ? "primary" : "outline"}
                      className="w-full"
                    >
                      {plan.is_popular && plan.upgrade_discount_pct > 0
                        ? `Upgrade · ${plan.upgrade_discount_pct}% OFF`
                        : "Fazer Upgrade"}
                    </Button>
                  )}
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

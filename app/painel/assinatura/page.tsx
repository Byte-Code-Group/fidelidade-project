import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSubscription, PLAN_PRICES } from "@/lib/asaas";
import { PLAN_CATALOG } from "@/lib/plan-catalog";
import { PLAN_RANK, TENANT_LIMITS } from "@/lib/tenant-limits";
import { syncTenantStatusWithAsaas, checkTenantLimitImpact } from "@/lib/tenant-billing";
import { FlashToast } from "@/components/flash-toast";
import { cn } from "@/lib/utils";
import {
  ownerCancelSubscription,
  ownerChangePlan,
  ownerCancelPendingPlanChange,
} from "../actions";

const PLAN_LABEL: Record<string, string> = Object.fromEntries(
  PLAN_CATALOG.map((p) => [p.key, p.name]),
);

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  pending: "Aguardando pagamento",
  suspended: "Suspensa",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  suspended: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default async function OwnerAssinaturaPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    saved?: string;
    select_plan?: string;
  }>;
}) {
  const { tenantId } = await requireTenantOwner();
  const { error, saved, select_plan } = await searchParams;

  // Reconcilia com o Asaas antes de ler o status — cobre o caso do webhook
  // não ter confirmado o pagamento, e aplica downgrade/cancelamento
  // agendado se o prazo já passou (fallback, já que cancelamento não gera
  // mais eventos de webhook do Asaas).
  await syncTenantStatusWithAsaas(tenantId);

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select(
      "saas_plan, status, asaas_subscription_id, pending_plan, pending_plan_effective_at, cancel_at",
    )
    .eq("id", tenantId)
    .maybeSingle<{
      saas_plan: string;
      status: string;
      asaas_subscription_id: string | null;
      pending_plan: string | null;
      pending_plan_effective_at: string | null;
      cancel_at: string | null;
    }>();

  const status = tenant?.status ?? "";
  const isActive = status === "active";
  const currentPlan = tenant?.saas_plan ?? "starter";
  const pendingPlan = tenant?.pending_plan ?? null;
  const pendingAt = tenant?.pending_plan_effective_at ?? null;
  const cancelAt = tenant?.cancel_at ?? null;
  // Assinatura foi cancelada mas o acesso ainda vale — mesmo com status
  // "active" no banco, trata como "precisa reassinar" pra tela toda.
  const isCancelledButActive = isActive && !!cancelAt;

  const successMessage =
    saved === "scheduled"
      ? "Plano selecionado — seu plano atual continua valendo até a próxima renovação."
      : saved === "cancelled"
        ? "Assinatura cancelada — seu acesso continua até o fim do período já pago."
        : "Alterações salvas.";

  // Etapa intermediária: downgrade reduziria o limite de negócios abaixo do
  // que o dono já tem ativo — precisa escolher quais ficam ativos antes de
  // qualquer coisa ser agendada.
  if (select_plan && Object.keys(PLAN_LABEL).includes(select_plan)) {
    const impact = await checkTenantLimitImpact(tenantId, select_plan);
    if (impact.requiresSelection) {
      const others = impact.activeTenants.filter((t) => t.id !== tenantId);
      const requiredExtra = impact.limit === -1 ? 0 : impact.limit - 1;

      return (
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Assinatura</h1>
            <p className="mt-1 text-sm text-gray-500">
              Escolha quais negócios continuam ativos.
            </p>
          </div>

          <FlashToast error={error} saved={saved} successMessage={successMessage} />

          <Card>
            <CardContent className="space-y-4">
              <h2 className="font-semibold">Escolha quais negócios continuam ativos</h2>
              <p className="text-sm text-gray-500">
                O plano {PLAN_LABEL[select_plan]} permite {impact.limit} negócio
                {impact.limit === 1 ? "" : "s"} ativo{impact.limit === 1 ? "" : "s"}. Você tem{" "}
                {impact.activeTenants.length} negócios ativos hoje. Este negócio continua ativo
                automaticamente
                {requiredExtra > 0
                  ? ` — escolha mais ${requiredExtra} pra manter ativo${requiredExtra === 1 ? "" : "s"} quando o downgrade valer:`
                  : "; os demais serão suspensos quando o downgrade valer (sem perder dados — dá pra reativar depois trocando de plano de novo)."}
              </p>

              <form action={ownerChangePlan} className="space-y-4">
                <input type="hidden" name="plan" value={select_plan} />
                <input type="hidden" name="confirm" value="1" />

                {requiredExtra > 0 && (
                  <div className="space-y-2">
                    {others.map((t) => (
                      <label
                        key={t.id}
                        className="flex items-center gap-2 rounded-lg border border-black/10 px-3 py-2.5 text-sm dark:border-white/10"
                      >
                        <input
                          type="checkbox"
                          name="keep_tenant_id"
                          value={t.id}
                          className="h-4 w-4 accent-blue-600"
                        />
                        {t.name}
                        <span className="text-xs opacity-50">
                          ({PLAN_LABEL[t.saas_plan] ?? t.saas_plan})
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" pendingLabel="Confirmando…">Confirmar seleção</Button>
                  <Link href="/painel/assinatura">
                    <Button type="button" variant="outline">
                      Cancelar
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  let subscription: { status: string; nextDueDate: string; value: number } | null = null;
  if (tenant?.asaas_subscription_id && process.env.ASAAS_API_KEY) {
    try {
      subscription = await getSubscription(tenant.asaas_subscription_id);
    } catch {
      // Asaas offline ou id inválido — mostra só o status local.
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Assinatura</h1>
        <p className="mt-1 text-sm text-gray-500">
          Plano atual, troca de plano e cancelamento.
        </p>
      </div>

      <FlashToast error={error} saved={saved} successMessage={successMessage} />

      {!isActive && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-400">
          {status === "suspended"
            ? "Sua assinatura está suspensa e o portal fica indisponível para os clientes. Escolha um plano abaixo e finalize o pagamento para reativar."
            : "Assinatura aguardando confirmação de pagamento. Escolha um plano abaixo para gerar (ou refazer) a cobrança."}
        </div>
      )}

      {isCancelledButActive && cancelAt && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          Assinatura cancelada. Você ainda tem acesso ao plano {PLAN_LABEL[currentPlan]} até{" "}
          <strong>{fmtDate(cancelAt)}</strong> — depois disso o portal fica indisponível pros
          clientes. Escolha um plano abaixo a qualquer momento pra continuar sem interrupção.
        </div>
      )}

      {pendingPlan && pendingAt && !isCancelledButActive && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
          <span>
            Seu plano <strong>{PLAN_LABEL[currentPlan]}</strong> continua ativo até{" "}
            <strong>{fmtDate(pendingAt)}</strong> — depois disso muda pra{" "}
            <strong>{PLAN_LABEL[pendingPlan] ?? pendingPlan}</strong> automaticamente.
          </span>
          <form action={ownerCancelPendingPlanChange}>
            <Button type="submit" variant="outline" className="shrink-0 text-xs">
              Cancelar troca agendada
            </Button>
          </form>
        </div>
      )}

      <Card>
        <CardContent className="space-y-2">
          <h2 className="font-semibold">Plano atual</h2>
          <p className="text-2xl font-bold">
            {PLAN_LABEL[currentPlan] ?? currentPlan ?? "—"}
          </p>
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}
          >
            {isCancelledButActive ? "Cancelada (ativa até o fim do período)" : STATUS_LABEL[status] ?? status ?? "—"}
          </span>
          {subscription && !cancelAt && (
            <p className="text-xs text-gray-500">
              Asaas: {subscription.status} · R$ {subscription.value} · próx. vencimento{" "}
              {fmtDate(subscription.nextDueDate)}
            </p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-1 font-semibold">
          {isActive && !isCancelledButActive ? "Trocar de plano" : "Assinar / Reativar"}
        </h2>
        <p className="mb-3 text-xs text-gray-500">
          {isActive && !isCancelledButActive
            ? "Upgrade vale na hora, sem cobrar nada agora — o valor novo entra só na próxima fatura. Downgrade continua com o plano atual até o fim do período, depois muda sozinho."
            : "Escolha o plano e a forma de pagamento — você será redirecionado para o checkout do Asaas para concluir o pagamento."}
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          {PLAN_CATALOG.map((plan) => {
            const price = PLAN_PRICES[plan.key];
            const isCurrent = isActive && !isCancelledButActive && plan.key === currentPlan;
            const isUpgrade = PLAN_RANK[plan.key] > PLAN_RANK[currentPlan];
            const isThisPending = isActive && pendingPlan === plan.key;
            const needsBillingType = !isActive || isCancelledButActive;

            return (
              <Card
                key={plan.key}
                className={cn(
                  "flex flex-col",
                  isCurrent && "border-2 border-blue-600",
                  !isCurrent && plan.highlight && "border-blue-300",
                )}
              >
                <CardContent className="flex flex-1 flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    {isCurrent ? (
                      <span className="shrink-0 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-medium text-white">
                        Selecionado
                      </span>
                    ) : (
                      plan.highlight && (
                        <span className="shrink-0 rounded-full bg-blue-600/10 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                          Popular
                        </span>
                      )
                    )}
                  </div>

                  <p>
                    <span className="text-2xl font-bold">R$ {price}</span>
                    <span className="text-sm text-gray-400">/mês</span>
                  </p>

                  <ul className="flex-1 space-y-1.5">
                    {plan.features.map((f) => (
                      <li key={f} className="text-sm text-gray-500">
                        ✓ {f}
                      </li>
                    ))}
                  </ul>

                  {(() => {
                    const limit = TENANT_LIMITS[plan.key];
                    const limitLabel =
                      limit === -1 ? "negócios ilimitados" : `até ${limit} negócio${limit === 1 ? "" : "s"}`;
                    const renewalDate = subscription ? fmtDate(subscription.nextDueDate) : null;

                    if (isCurrent) {
                      return <p className="text-xs text-gray-500">Este é o seu plano atual.</p>;
                    }
                    if (isThisPending) {
                      return (
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Selecionado — na renovação de {pendingAt ? fmtDate(pendingAt) : ""} passa a
                          cobrar R$ {price}/mês e permitir {limitLabel}.
                        </p>
                      );
                    }
                    return (
                      <form action={ownerChangePlan} className="space-y-2">
                        <input type="hidden" name="plan" value={plan.key} />
                        {!needsBillingType && !isUpgrade && (
                          <p className="text-[11px] text-gray-500">
                            Na próxima renovação{renewalDate ? ` (${renewalDate})` : ""} passa a cobrar
                            R$ {price}/mês e permitir {limitLabel}. Até lá, {PLAN_LABEL[currentPlan]}{" "}
                            continua valendo.
                          </p>
                        )}
                        <Button
                          type="submit"
                          className="w-full"
                          variant={needsBillingType || isUpgrade ? "primary" : "outline"}
                        >
                          {needsBillingType
                            ? `Assinar ${plan.name}`
                            : isUpgrade
                              ? "Fazer upgrade"
                              : `Selecionar ${plan.name}`}
                        </Button>
                      </form>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {isActive && !isCancelledButActive && tenant?.asaas_subscription_id && (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="font-semibold text-red-600">Cancelar assinatura</h2>
            <p className="text-sm text-gray-500">
              Cancela a cobrança na hora. Se ainda tiver dias pagos, seu acesso continua até o
              fim do período — depois disso o portal é suspenso.
            </p>
            <form action={ownerCancelSubscription}>
              <Button
                type="submit"
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                Cancelar assinatura
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

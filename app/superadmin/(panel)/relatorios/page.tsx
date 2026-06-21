import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

const PLAN_PRICES: Record<string, number> = {
  starter: 97,
  pro: 297,
  premium: 697,
};

function monthLabel(yearMonth: string) {
  const [y, m] = yearMonth.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleDateString("pt-BR", {
    month: "short",
    year: "2-digit",
  });
}

export default async function RelatoriosPage() {
  const db = createAdminClient();

  const now = new Date();
  // Last 6 months
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toISOString().slice(0, 7));
  }

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

  const [
    { data: tenants },
    { data: aiUsage },
    { data: suspensions },
    { data: newSignups },
  ] = await Promise.all([
    db
      .from("tenants")
      .select("id, name, saas_plan, status, created_at")
      .returns<{
        id: string;
        name: string;
        saas_plan: string;
        status: string;
        created_at: string;
      }[]>(),
    db
      .from("tenant_ai_usage")
      .select("tenant_id, year_month, tokens_used")
      .in("year_month", months)
      .returns<{ tenant_id: string; year_month: string; tokens_used: number }[]>(),
    db
      .from("tenants")
      .select("id, name, created_at")
      .eq("status", "suspended")
      .returns<{ id: string; name: string; created_at: string }[]>(),
    db
      .from("tenants")
      .select("id, created_at, saas_plan, status")
      .gte("created_at", sixMonthsAgo)
      .returns<{ id: string; created_at: string; saas_plan: string; status: string }[]>(),
  ]);

  const all = tenants ?? [];
  const activeTenants = all.filter((t) => t.status === "active");

  // Current MRR
  const currentMrr = activeTenants.reduce(
    (sum, t) => sum + (PLAN_PRICES[t.saas_plan] ?? 0),
    0,
  );

  // Signups per month
  const signupsByMonth: Record<string, number> = Object.fromEntries(months.map((m) => [m, 0]));
  for (const t of newSignups ?? []) {
    const m = t.created_at.slice(0, 7);
    if (m in signupsByMonth) signupsByMonth[m]++;
  }
  const maxSignups = Math.max(1, ...Object.values(signupsByMonth));

  // AI token usage per tenant (current month)
  const currentMonth = now.toISOString().slice(0, 7);
  const aiThisMonth = (aiUsage ?? []).filter((u) => u.year_month === currentMonth);
  const totalAiTokens = aiThisMonth.reduce((sum, u) => sum + u.tokens_used, 0);
  const tenantNameById = new Map(all.map((t) => [t.id, t.name]));
  const topAiUsers = [...aiThisMonth]
    .sort((a, b) => b.tokens_used - a.tokens_used)
    .slice(0, 8);

  // Plan distribution
  const planCounts: Record<string, number> = { starter: 0, pro: 0, premium: 0 };
  for (const t of activeTenants) planCounts[t.saas_plan] = (planCounts[t.saas_plan] ?? 0) + 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        subtitle="Receita, crescimento e uso de IA."
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wider opacity-50">MRR Atual</p>
            <p className="mt-1 text-2xl font-bold">
              {currentMrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-xs opacity-50">{activeTenants.length} assinantes ativos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wider opacity-50">ARR (projeção)</p>
            <p className="mt-1 text-2xl font-bold">
              {(currentMrr * 12).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-xs opacity-50">MRR × 12</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs uppercase tracking-wider opacity-50">Tokens IA (mês)</p>
            <p className="mt-1 text-2xl font-bold">
              {totalAiTokens.toLocaleString("pt-BR")}
            </p>
            <p className="text-xs opacity-50">todos os tenants</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Novos signups por mês */}
        <Card>
          <CardContent>
            <h2 className="mb-4 text-sm font-semibold">Novos tenants por mês</h2>
            <div className="flex h-24 items-end gap-1">
              {months.map((m) => {
                const count = signupsByMonth[m] ?? 0;
                return (
                  <div key={m} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      title={`${monthLabel(m)}: ${count}`}
                      className="w-full rounded-t bg-blue-500/80"
                      style={{ height: `${Math.max(4, (count / maxSignups) * 100)}%` }}
                    />
                    <span className="text-[9px] opacity-40">{monthLabel(m)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Distribuição de planos */}
        <Card>
          <CardContent>
            <h2 className="mb-4 text-sm font-semibold">Distribuição de planos (ativos)</h2>
            <div className="space-y-3">
              {Object.entries(planCounts).map(([plan, count]) => {
                const total = activeTenants.length || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={plan}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="capitalize opacity-70">{plan}</span>
                      <span className="font-medium">
                        {count} · {pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                      <div
                        className="h-full rounded-full bg-blue-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {activeTenants.length === 0 && (
                <p className="py-4 text-center text-sm opacity-40">Sem assinantes ainda.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* AI usage por tenant */}
        <Card>
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold">
              Uso de IA por tenant — {monthLabel(currentMonth)}
            </h2>
            {topAiUsers.length === 0 ? (
              <p className="py-4 text-center text-sm opacity-40">Sem uso registrado.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs opacity-40">
                    <th className="pb-2 font-medium">Tenant</th>
                    <th className="pb-2 text-right font-medium">Tokens</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topAiUsers.map((u) => (
                    <tr key={u.tenant_id}>
                      <td className="py-2 opacity-70">
                        {tenantNameById.get(u.tenant_id) ?? u.tenant_id.slice(0, 8)}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {u.tokens_used.toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Tenants suspensos */}
        <Card>
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold">
              Tenants suspensos ({suspensions?.length ?? 0})
            </h2>
            {(suspensions?.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm opacity-40">Nenhum suspenso.</p>
            ) : (
              <ul className="divide-y text-sm">
                {(suspensions ?? []).slice(0, 8).map((t) => (
                  <li key={t.id} className="py-2 opacity-70">
                    {t.name}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

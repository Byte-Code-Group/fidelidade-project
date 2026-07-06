import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireTenantOwner } from "@/lib/owner";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  active: "Ativo",
  suspended: "Suspenso",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700",
  suspended: "bg-red-100 text-red-600",
};

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export default async function PainelPage() {
  const { tenantId } = await requireTenantOwner();

  const db = createAdminClient();
  const since = thirtyDaysAgo();

  const [
    { data: tenant },
    { data: members },
    { data: checkins },
    { data: pendingValidations },
    { data: pendingRedemptions },
    { data: missions },
  ] = await Promise.all([
    db
      .from("tenants")
      .select("name, slug, status, saas_plan, asaas_subscription_id")
      .eq("id", tenantId)
      .maybeSingle<{
        name: string;
        slug: string;
        status: string;
        saas_plan: string;
        asaas_subscription_id: string | null;
      }>(),
    db
      .from("memberships")
      .select("id, user_id, points_total")
      .eq("tenant_id", tenantId)
      .order("points_total", { ascending: false })
      .returns<{ id: string; user_id: string; points_total: number }[]>(),
    db
      .from("checkins")
      .select("created_at")
      .eq("tenant_id", tenantId)
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .returns<{ created_at: string }[]>(),
    db
      .from("mission_completions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
    db
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("status", "pending"),
    db
      .from("missions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("is_active", true),
  ]);

  if (!tenant) redirect("/conta/configurar");

  const portalUrl = `https://${ROOT_DOMAIN}/p/${tenant.slug}`;
  const isPending = tenant.status === "pending";

  // Check-in chart: bucket by day (last 30 days)
  const dayBuckets: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dayBuckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const c of checkins ?? []) {
    const day = c.created_at.slice(0, 10);
    if (day in dayBuckets) dayBuckets[day]++;
  }
  const chartDays = Object.entries(dayBuckets);
  const maxCheckins = Math.max(1, ...chartDays.map(([, v]) => v));

  // Top 5 members by points
  const top5 = (members ?? []).slice(0, 5);

  // Fetch names for top members
  const topUserIds = top5.map((m) => m.user_id);
  const { data: topUsers } = topUserIds.length
    ? await db
        .from("users")
        .select("id, full_name, email")
        .in("id", topUserIds)
        .returns<{ id: string; full_name: string | null; email: string | null }[]>()
    : { data: [] };
  const nameById = new Map((topUsers ?? []).map((u) => [u.id, u.full_name ?? u.email ?? "—"]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-gray-400">Meu painel</p>
        <h1 className="text-2xl font-bold">{tenant.name}</h1>
        <span
          className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[tenant.status] ?? "bg-gray-100 text-gray-600"}`}
        >
          {STATUS_LABEL[tenant.status] ?? tenant.status}
        </span>
      </div>

      {/* Banners */}
      {isPending && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm font-medium text-blue-800">Aguardando confirmação do pagamento</p>
          <p className="mt-1 text-sm text-blue-600">
            Seu portal será ativado automaticamente.{" "}
            <Link href="/conta/planos" className="underline">
              Pagar agora
            </Link>
          </p>
        </div>
      )}
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Membros", value: members?.length ?? 0 },
          { label: "Check-ins (30d)", value: checkins?.length ?? 0 },
          { label: "Missões ativas", value: missions?.length ?? 0 },
          {
            label: "Pendências",
            value: (pendingValidations?.length ?? 0) + (pendingRedemptions?.length ?? 0),
            alert: ((pendingValidations?.length ?? 0) + (pendingRedemptions?.length ?? 0)) > 0,
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent>
              <p className="text-xs uppercase tracking-wider text-gray-400">{kpi.label}</p>
              <p
                className={`mt-1 text-3xl font-bold ${kpi.alert ? "text-rose-500" : ""}`}
              >
                {kpi.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Check-in chart */}
      <Card>
        <CardContent>
          <h2 className="mb-4 text-sm font-semibold">Check-ins — últimos 30 dias</h2>
          {checkins?.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Nenhum check-in ainda.</p>
          ) : (
            <div className="flex h-24 items-end gap-0.5">
              {chartDays.map(([day, count]) => (
                <div
                  key={day}
                  title={`${day}: ${count}`}
                  className="flex-1 rounded-t bg-blue-500/80 transition-all hover:bg-blue-600"
                  style={{ height: `${Math.max(4, (count / maxCheckins) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top members + pending */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Top members */}
        <Card>
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold">Top membros por pontos</h2>
            {top5.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum membro ainda.</p>
            ) : (
              <ol className="space-y-2">
                {top5.map((m, i) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      <span className="mr-2 font-bold text-gray-300">#{i + 1}</span>
                      {nameById.get(m.user_id) ?? "—"}
                    </span>
                    <span className="font-semibold">{m.points_total} pts</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Pending actions */}
        <Card>
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold">Pendências</h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <Link href="/painel/validacoes" className="text-gray-500 hover:underline">
                  Validações de missão
                </Link>
                <span className={`font-semibold ${(pendingValidations?.length ?? 0) > 0 ? "text-rose-500" : "text-gray-400"}`}>
                  {pendingValidations?.length ?? 0}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-gray-500">Resgates a processar</span>
                <span className={`font-semibold ${(pendingRedemptions?.length ?? 0) > 0 ? "text-rose-500" : "text-gray-400"}`}>
                  {pendingRedemptions?.length ?? 0}
                </span>
              </li>
            </ul>
            <p className="mt-4 text-xs text-gray-400">
              Resgates ainda são processados pelo administrador da plataforma.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Portal + quick actions */}
      <Card>
        <CardContent>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Seu portal</p>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block break-all text-sm text-blue-600 hover:underline"
          >
            {portalUrl} ↗
          </a>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/painel/customizacao">
          <Button variant="outline" className="w-full text-sm">Editar negócio</Button>
        </Link>
        {!tenant.asaas_subscription_id && !isPending ? (
          <Link href="/conta/planos">
            <Button className="w-full text-sm">Assinar plano</Button>
          </Link>
        ) : (
          <a href={portalUrl} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full text-sm">Ver portal ↗</Button>
          </a>
        )}
      </div>
    </div>
  );
}

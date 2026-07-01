import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Icon, type IconKey } from "@/components/icons";
import { createAdminClient } from "@/lib/supabase/admin";
import { SEGMENT_TEMPLATES } from "@/lib/segment-templates";
import type { Tenant } from "@/lib/types";

const statusStyle: Record<string, string> = {
  active: "bg-green-500/15 text-green-600",
  trial: "bg-amber-500/15 text-amber-600",
  suspended: "bg-red-500/15 text-red-600",
};

// Isola Date.now em helper de módulo (a regra react-hooks/purity barra a
// chamada direta no corpo do Server Component).
function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - 30 * 86_400_000).toISOString();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
}

export default async function DashboardPage() {
  const db = createAdminClient();
  const since = thirtyDaysAgoIso();

  const [
    { data: tenants },
    { count: clientsCount },
    { count: pendingRedemptions },
    { data: checkins },
  ] = await Promise.all([
    db
      .from("tenants")
      .select("id, name, status, segment_template, saas_plan, created_at")
      .order("created_at", { ascending: false })
      .returns<Tenant[]>(),
    db.from("users").select("id", { count: "exact", head: true }).eq("role", "client"),
    db
      .from("reward_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db.from("checkins").select("tenant_id").gte("created_at", since).returns<
      { tenant_id: string }[]
    >(),
  ]);

  const all = tenants ?? [];
  const active = all.filter((t) => t.status === "active").length;
  const trial = all.filter((t) => t.status === "trial").length;

  const kpis: {
    label: string;
    value: string;
    icon: IconKey;
    note?: string;
    accent: string;
  }[] = [
    { label: "Empresas ativas", value: String(active), icon: "building", note: `${all.length} no total`, accent: "text-[var(--primary)]" },
    { label: "Clientes finais", value: String(clientsCount ?? 0), icon: "users", note: "em todas as empresas", accent: "text-violet-500" },
    { label: "Em trial", value: String(trial), icon: "clock", note: "acompanhe a conversão", accent: "text-amber-500" },
    { label: "Resgates pendentes", value: String(pendingRedemptions ?? 0), icon: "gift", note: "requer atenção", accent: "text-rose-500" },
  ];

  // Engajamento por empresa (check-ins nos últimos 30 dias).
  const nameById = new Map(all.map((t) => [t.id, t.name]));
  const counts = new Map<string, number>();
  for (const c of checkins ?? []) {
    counts.set(c.tenant_id, (counts.get(c.tenant_id) ?? 0) + 1);
  }
  const bars = [...counts.entries()]
    .map(([id, count]) => ({ name: nameById.get(id) ?? "—", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const maxBar = Math.max(1, ...bars.map((b) => b.count));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral de toda a plataforma."
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm opacity-60">{kpi.label}</span>
                <Icon name={kpi.icon} className={`h-5 w-5 ${kpi.accent}`} />
              </div>
              <p className="text-3xl font-bold">{kpi.value}</p>
              {kpi.note && <p className="text-xs opacity-50">{kpi.note}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {/* Engajamento por empresa */}
        <Card>
          <CardContent className="space-y-4">
            <div>
              <h2 className="font-semibold">Engajamento por empresa</h2>
              <p className="text-sm opacity-60">Check-ins nos últimos 30 dias</p>
            </div>
            {bars.length === 0 ? (
              <p className="py-8 text-center text-sm opacity-50">
                Sem check-ins no período.
              </p>
            ) : (
              <div className="space-y-3">
                {bars.map((b) => (
                  <div key={b.name} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 truncate opacity-70">
                      {b.name}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${(b.count / maxBar) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right font-medium">
                      {b.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Atividade recente */}
        <Card>
          <CardContent className="space-y-4">
            <h2 className="font-semibold">Atividade recente</h2>
            <ul className="space-y-4">
              {all.slice(0, 6).map((t) => (
                <li key={t.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <Link
                        href={`/superadmin/tenants/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>{" "}
                      <span className="opacity-60">
                        ·{" "}
                        {SEGMENT_TEMPLATES[t.segment_template]?.label ??
                          t.segment_template}
                      </span>
                    </p>
                    <p className="text-xs opacity-50">
                      Cadastrada {timeAgo(t.created_at)}
                    </p>
                  </div>
                  <Badge className={statusStyle[t.status] ?? "bg-black/5"}>
                    {t.status}
                  </Badge>
                </li>
              ))}
              {all.length === 0 && (
                <li className="text-sm opacity-50">Nenhuma empresa ainda.</li>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconKey } from "@/components/icons";
import { CopyButton } from "@/components/copy-button";
import { StampCard } from "@/components/stamp-card";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantOwner } from "@/lib/owner";
import { getAuthUser } from "@/lib/supabase/server";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  active: "Ativo",
  suspended: "Suspenso",
};
const STATUS_TONE = { pending: "warning", active: "success", suspended: "danger" } as const;

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString();
}

export default async function PainelPage() {
  const user = await getAuthUser();
  if (!user) redirect("/conta/login");

  const owner = await getTenantOwner();
  if (!owner) {
    return (
      <div className="mx-auto max-w-lg pt-12">
        <EmptyState
          icon={<Icon name="building" />}
          title="Crie seu primeiro negócio"
          description="O painel ganha vida quando seu programa de fidelidade existe: clientes, missões, prêmios e o portal com a sua marca."
        >
          <Link href="/conta/configurar">
            <Button>
              <Icon name="plus" className="h-4 w-4" />
              Criar meu negócio
            </Button>
          </Link>
        </EmptyState>
      </div>
    );
  }

  const { tenantId } = owner;

  const db = createAdminClient();
  const since = thirtyDaysAgo();

  const [
    { data: tenant },
    { data: members },
    { data: checkins },
    // head:true não traz linhas — o número vem em `count`.
    { count: pendingValidations },
    { count: pendingRedemptions },
    { count: activeMissions },
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
  const topPoints = Math.max(1, top5[0]?.points_total ?? 0);

  const validations = pendingValidations ?? 0;
  const redemptions = pendingRedemptions ?? 0;
  const pending: { href: string; icon: IconKey; count: number; label: string }[] = [
    { href: "/painel/validacoes", icon: "checkCircle", count: validations, label: "missões aguardando validação" },
    { href: "/painel/resgates", icon: "gift", count: redemptions, label: "resgates para entregar" },
  ];
  const pendingNow = pending.filter((p) => p.count > 0);

  const kpis: { label: string; value: number; icon: IconKey; href: string }[] = [
    { label: "Membros", value: members?.length ?? 0, icon: "users", href: "/painel/clientes" },
    { label: "Check-ins em 30 dias", value: checkins?.length ?? 0, icon: "stamp", href: "/painel/clientes" },
    { label: "Missões ativas", value: activeMissions ?? 0, icon: "award", href: "/painel/missoes" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="truncate text-[28px] font-bold leading-tight md:text-[32px]">{tenant.name}</h1>
            <Badge tone={STATUS_TONE[tenant.status as keyof typeof STATUS_TONE] ?? "neutral"}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {STATUS_LABEL[tenant.status] ?? tenant.status}
            </Badge>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-sm text-muted">
            <Icon name="globe" className="h-4 w-4" />
            <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:text-[var(--primary)] hover:underline">
              {portalUrl.replace(/^https?:\/\//, "")}
            </a>
            <CopyButton value={portalUrl} />
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/painel/customizacao">
            <Button variant="outline">
              <Icon name="edit" className="h-4 w-4" />
              Editar negócio
            </Button>
          </Link>
          {!tenant.asaas_subscription_id && !isPending ? (
            <Link href="/conta/planos">
              <Button>
                <Icon name="crown" className="h-4 w-4" />
                Assinar plano
              </Button>
            </Link>
          ) : (
            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
              <Button>
                <Icon name="external" className="h-4 w-4" />
                Ver portal
              </Button>
            </a>
          )}
        </div>
      </header>

      {isPending && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-4">
          <Icon name="clock" className="mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="text-sm">
            <p className="font-medium">Aguardando confirmação do pagamento</p>
            <p className="mt-0.5 text-muted">
              Seu portal é ativado sozinho quando o pagamento cai.{" "}
              <Link href="/conta/planos" className="font-medium text-[var(--primary)] hover:underline">
                Pagar agora
              </Link>
            </p>
          </div>
        </div>
      )}

      {pendingNow.length > 0 ? (
        <section aria-label="Pendências" className={`grid gap-3 ${pendingNow.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {pendingNow.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex items-center gap-4 rounded-2xl border border-[var(--primary)]/25 bg-[var(--primary)]/[0.06] p-4 transition hover:border-[var(--primary)]/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
                <Icon name={p.icon} />
              </span>
              <span className="min-w-0 flex-1 text-sm">
                <span className="font-display text-xl font-bold tabular-nums">{p.count}</span>{" "}
                <span className="text-muted">{p.label}</span>
              </span>
              <Icon name="arrowRight" className="h-4 w-4 text-[var(--primary)] transition-transform group-hover:translate-x-1" />
            </Link>
          ))}
        </section>
      ) : (
        <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          <Icon name="checkCircle" className="h-[18px] w-[18px] text-emerald-500" />
          Nada esperando por você: validações e resgates em dia.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Link
            key={kpi.label}
            href={kpi.href}
            className="group rounded-2xl border border-line bg-surface p-5 transition hover:border-[var(--primary)]/30"
          >
            <div className="flex items-center justify-between text-sm text-muted">
              {kpi.label}
              <Icon name={kpi.icon} className="h-[18px] w-[18px] transition-colors group-hover:text-[var(--primary)]" />
            </div>
            <p className="mt-2 font-display text-4xl font-bold tabular-nums">{kpi.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardContent className="p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[17px] font-semibold">Cartela de check-ins</h2>
                <p className="mt-0.5 text-sm text-muted">Cada selo é um dia dos últimos 30. O contornado é hoje.</p>
              </div>
            </div>
            <StampCard days={chartDays} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <h2 className="text-[17px] font-semibold">Quem mais pontua</h2>
            <p className="mt-0.5 text-sm text-muted">Os 5 membros com mais pontos agora.</p>
            {top5.length === 0 ? (
              <EmptyState
                bare
                icon={<Icon name="users" />}
                title="Nenhum membro ainda"
                description="Quando clientes se cadastrarem no portal, o ranking aparece aqui."
              >
                <Link href="/painel/clientes/novo">
                  <Button variant="outline">
                    <Icon name="plus" className="h-4 w-4" />
                    Cadastrar cliente
                  </Button>
                </Link>
              </EmptyState>
            ) : (
              <ol className="mt-5 space-y-3.5">
                {top5.map((m, i) => {
                  const name = nameById.get(m.user_id) ?? "—";
                  return (
                    <li key={m.id} className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                          i === 0 ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-surface-2 text-muted"
                        }`}
                      >
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="truncate font-medium">{name}</span>
                          <span className="shrink-0 tabular-nums text-muted">{m.points_total} pts</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-[var(--primary)] origin-left [animation:grow_700ms_var(--ease-out)_both]"
                            style={{ width: `${Math.max(4, (m.points_total / topPoints) * 100)}%`, animationDelay: `${150 + i * 80}ms` }}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

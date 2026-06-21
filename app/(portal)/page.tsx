import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { MembershipCard } from "@/components/membership-card";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import {
  currentPeriodRef,
  streakFromPeriods,
  type LoyaltyFrequency,
} from "@/lib/loyalty";
import type { BusinessPlan, Checkin, Membership } from "@/lib/types";

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function HomePage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();
  const { settings } = ctx;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Estado deslogado → CTA de login.
  if (!user) {
    return (
      <Card>
        <CardContent className="text-center">
          <h1 className="text-xl font-semibold">
            Bem-vindo à {ctx.tenant.name}
          </h1>
          <p className="mt-2 text-sm opacity-70">
            Entre para acessar sua carteirinha e recompensas.
          </p>
          <Link href="/login" className="mt-5 block">
            <Button className="w-full">Entrar</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const [{ data: profile }, { data: membership }, { data: checkins }] =
    await Promise.all([
      supabase
        .from("users")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null; email: string | null }>(),
      supabase
        .from("memberships")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<Membership>(),
      supabase
        .from("checkins")
        .select("period_ref")
        .eq("user_id", user.id)
        .returns<Pick<Checkin, "period_ref">[]>(),
    ]);

  // Nome do plano da carteirinha (se houver).
  let planName: string | null = null;
  if (membership?.plan_id) {
    const { data: plan } = await supabase
      .from("business_plans")
      .select("name")
      .eq("id", membership.plan_id)
      .maybeSingle<Pick<BusinessPlan, "name">>();
    planName = plan?.name ?? null;
  }

  const memberName = profile?.full_name ?? profile?.email ?? "Membro";
  const points = membership?.points_total ?? 0;

  // Fidelidade
  const frequency = (settings.loyalty_frequency as LoyaltyFrequency) ?? "monthly";
  const goal = settings.loyalty_goal;
  const periodLabel = frequency === "weekly" ? "semanas" : "meses";
  const periods = (checkins ?? []).map((c) => c.period_ref);
  const streak = streakFromPeriods(periods, frequency);
  const checkedIn = periods.includes(currentPeriodRef(frequency));
  const pct = goal > 0 ? Math.min(100, Math.round((streak / goal) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm opacity-60">Bem-vindo de volta,</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {memberName} <span className="align-middle">👋</span>
          </h1>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-black/5 bg-white px-3 py-1.5 dark:bg-white/5">
          <div className="text-right leading-tight">
            <p className="text-[10px] uppercase tracking-wider opacity-50">
              Pontos
            </p>
            <p className="font-bold text-[var(--primary)]">{points}</p>
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-[var(--primary-foreground)]"
            style={{ background: "var(--primary)" }}
          >
            {initials(memberName)}
          </div>
        </div>
      </div>

      {membership ? (
        <MembershipCard
          membership={membership}
          memberName={memberName}
          tenant={ctx}
          planName={planName}
        />
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm opacity-70">
              Olá, {memberName}. Você ainda não tem uma carteirinha ativa.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Programa de fidelidade */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <Icon name="award" />
              </div>
              <div>
                <h2 className="font-semibold">{settings.reward_name ?? "Programa Fidelidade"}</h2>
                <p className="text-sm opacity-60">
                  Faça check-in a cada período para evoluir.
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--primary)]">{points}</p>
              <p className="text-xs opacity-50">pontos</p>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="opacity-60">Progresso até a recompensa</span>
              <span className="font-medium">
                {streak} / {goal} {periodLabel}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, background: "var(--primary)" }}
              />
            </div>
          </div>

          <Link href="/checkin" className="block">
            <Button className="w-full" disabled={checkedIn}>
              {checkedIn ? "Check-in do período feito ✓" : "Fazer Check-in"}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

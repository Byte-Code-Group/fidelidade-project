import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { MembershipCard } from "@/components/membership-card";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import {
  currentPeriodRef,
  streakFromPeriods,
  type LoyaltyFrequency,
} from "@/lib/loyalty";
import type { BusinessPlan, Checkin, Membership } from "@/lib/types";
import { submitLead } from "./landing-actions";

const PLANS = [
  {
    key: "starter",
    name: "Starter",
    price: 97,
    features: [
      "1 negócio",
      "Até 200 membros",
      "IA com 50k tokens/mês",
      "Carteirinha + pontos + loja",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    price: 297,
    features: [
      "Até 3 negócios",
      "Até 1.000 membros",
      "IA com 500k tokens/mês",
      "Todos os módulos",
    ],
    highlight: true,
  },
  {
    key: "premium",
    name: "Premium",
    price: 697,
    features: [
      "Negócios ilimitados",
      "Membros ilimitados",
      "IA ilimitada",
      "Suporte prioritário",
    ],
  },
];

function LandingPage({ sent }: { sent?: boolean }) {
  const features = [
    { icon: "star" as const, title: "Carteirinha digital", desc: "QR Code e carteirinha personalizada com a marca do seu negócio." },
    { icon: "award" as const, title: "Pontos e recompensas", desc: "Seu cliente acumula pontos a cada visita e troca por prêmios." },
    { icon: "chat" as const, title: "IA atendente 24h", desc: "Assistente com IA responde dúvidas e consulta dados em tempo real." },
    { icon: "calendar" as const, title: "Agendamentos", desc: "Módulo de agenda integrado ao programa de fidelidade." },
    { icon: "document" as const, title: "Documentos", desc: "Envie laudos, receitas e termos diretamente pelo portal." },
    { icon: "users" as const, title: "Multi-tenant", desc: "Uma plataforma, múltiplos negócios. Cada um com seu portal exclusivo." },
  ];

  const segments = ["Odontologia", "Academia", "Barbearia", "Salão de beleza", "Restaurante", "Estética"];

  return (
    <div className="min-h-dvh bg-white font-sans text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-10 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <span className="text-xl font-bold tracking-tight">Fideliza<span className="text-blue-600">.OS</span></span>
          <div className="flex items-center gap-3">
            <Link href="/conta/login" className="text-sm text-gray-500 hover:text-gray-900">
              Entrar
            </Link>
            <Link href="/conta/cadastro">
              <Button className="text-sm bg-blue-600 hover:bg-blue-700 text-white">
                Criar conta grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <span className="mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
          Plataforma SaaS de fidelidade
        </span>
        <h1 className="mt-2 text-4xl font-extrabold leading-tight tracking-tight md:text-5xl">
          Seu programa de fidelidade<br />
          <span className="text-blue-600">pronto em minutos</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-gray-600">
          Portal com carteirinha digital, acúmulo de pontos, loja de recompensas e atendente IA 24h.
          Para clínicas, academias, barbearias e muito mais.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/conta/cadastro">
            <Button className="h-12 px-8 text-base bg-blue-600 hover:bg-blue-700 text-white">
              Criar meu portal agora →
            </Button>
          </Link>
          <a href="#planos" className="text-sm text-gray-500 hover:underline">
            Ver planos e preços
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-400">
          Sem taxa de setup · Cancele quando quiser
        </p>
      </section>

      {/* Features */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="mb-10 text-center text-2xl font-bold">Tudo que seu negócio precisa</h2>
          <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-2xl bg-white p-6 shadow-sm">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon name={f.icon} />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Segmentos */}
      <section className="py-14">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="mb-6 text-2xl font-bold">Para qual segmento?</h2>
          <div className="flex flex-wrap justify-center gap-3">
            {segments.map((s) => (
              <span key={s} className="rounded-full border border-gray-200 px-4 py-1.5 text-sm font-medium text-gray-700">
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="bg-gray-50 py-16">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="mb-2 text-center text-2xl font-bold">Planos e preços</h2>
          <p className="mb-10 text-center text-gray-500">Cancele a qualquer momento.</p>
          <div className="grid gap-5 sm:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.key}
                className={`rounded-2xl bg-white p-6 shadow-sm ${plan.highlight ? "ring-2 ring-blue-600" : ""}`}
              >
                {plan.highlight && (
                  <span className="mb-3 inline-block rounded-full bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
                    Mais popular
                  </span>
                )}
                <h3 className="text-lg font-bold">{plan.name}</h3>
                <p className="mt-1 text-3xl font-extrabold">
                  R$ {plan.price}
                  <span className="text-base font-normal text-gray-400">/mês</span>
                </p>
                <ul className="mt-4 space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-0.5 text-blue-500">✓</span> {f}
                    </li>
                  ))}
                </ul>
                <Link href="/conta/cadastro" className="mt-6 block">
                  <Button
                    className={`w-full ${plan.highlight ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
                    variant={plan.highlight ? "primary" : "outline"}
                  >
                    Assinar {plan.name}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-blue-600 py-16 text-white">
        <div className="mx-auto max-w-lg px-5 text-center">
          <h2 className="text-2xl font-bold">Comece agora mesmo</h2>
          <p className="mt-2 text-blue-100">
            Configure seu portal em menos de 5 minutos.
          </p>
          <Link href="/conta/cadastro" className="mt-8 inline-block">
            <button className="rounded-xl bg-white px-10 py-3 text-base font-semibold text-blue-600 transition hover:bg-blue-50">
              Criar conta grátis →
            </button>
          </Link>
        </div>
      </section>

      {/* Contato / lead */}
      <section id="contato" className="py-14">
        <div className="mx-auto max-w-lg px-5">
          <h2 className="mb-2 text-center text-xl font-bold">Prefere falar com a gente?</h2>
          <p className="mb-8 text-center text-sm text-gray-500">
            Deixe seu contato e retornamos em até 24h.
          </p>
          {sent ? (
            <p className="rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-700">
              ✓ Recebemos seu contato! Retornaremos em breve.
            </p>
          ) : (
            <form action={submitLead} className="space-y-3">
              <input name="name" required placeholder="Seu nome"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input name="email" type="email" required placeholder="E-mail"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input name="business" required placeholder="Nome do negócio"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select name="segment" required defaultValue=""
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="" disabled>Segmento</option>
                <option value="odonto">Odontologia</option>
                <option value="academia">Academia</option>
                <option value="barbearia">Barbearia</option>
                <option value="salao">Salão de beleza</option>
                <option value="restaurante">Restaurante</option>
                <option value="estetica">Estética</option>
                <option value="generico">Outro</option>
              </select>
              <input name="phone" type="tel" placeholder="WhatsApp (opcional)"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button type="submit"
                className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-800">
                Enviar mensagem
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 py-8 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Fideliza.OS · Todos os direitos reservados ·{" "}
        <Link href="/conta/login" className="hover:underline">Entrar</Link>
      </footer>
    </div>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const ctx = await getCurrentTenant();
  if (!ctx) {
    const { sent } = await searchParams;
    return <LandingPage sent={!!sent} />;
  }
  const { settings } = ctx;
  const supabase = await createClient();

  const user = await getAuthUser();

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

  const memberName =
    profile?.full_name ??
    (user.user_metadata?.full_name as string | undefined) ??
    profile?.email ??
    user.email ??
    "Membro";
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

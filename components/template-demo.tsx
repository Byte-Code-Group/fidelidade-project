import { Icon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { MembershipCard } from "@/components/membership-card";
import { SocialLogo, type SocialKey } from "@/components/social-logos";
import { buildPortalNav } from "@/lib/portal-nav";
import { cn } from "@/lib/utils";
import type { Membership, TenantContext } from "@/lib/types";

export interface DemoConfig {
  segmentLabel: string;
  emoji: string;
  primaryColor: string;
  secondaryColor: string;
  themeMode: "light" | "dark";
  labelClient: string;
  labelAppointment: string;
  aiName: string;
  aiWelcome: string;
  rewardName: string;
  loyaltyGoal: number;
  modules: Record<string, boolean>;
  profileFields: { label: string; type: string }[];
}

// Data fixa de validade da carteirinha de exemplo (helper de módulo p/ não chamar
// Date.now direto no corpo do componente — regra react-hooks/purity).
function validUntilIso(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

// Demo do template — REUSA os componentes reais do portal (mesmos ícones,
// dimensões e classes), só com dados de exemplo e tema do template via CSS vars.
export function TemplateDemo({
  config,
  active,
}: {
  config: DemoConfig;
  active: string;
}) {
  const nav = buildPortalNav(config.modules);

  // Contexto/membership de exemplo para alimentar o MembershipCard real.
  const tenant: TenantContext = {
    tenant: {
      id: "demo",
      name: "Sua marca",
      slug: "demo",
      custom_domain: null,
      segment_template: "odonto",
      saas_plan: "pro",
      status: "active",
      checkin_token: "",
      created_at: "",
    },
    settings: {
      tenant_id: "demo",
      logo_url: null,
      favicon_url: null,
      primary_color: config.primaryColor,
      secondary_color: config.secondaryColor,
      theme_mode: config.themeMode,
      ai_name: config.aiName,
      ai_welcome_message: config.aiWelcome,
      ai_tone: "amigavel",
      label_client: config.labelClient,
      label_appointment: config.labelAppointment,
      footer_address: null,
      footer_phone: null,
      footer_whatsapp: null,
      footer_website: null,
      modules_enabled: config.modules,
      loyalty_goal: config.loyaltyGoal,
      loyalty_frequency: "monthly",
      loyalty_points_per_checkin: 1,
      loyalty_streak_reset: false,
      reward_name: config.rewardName,
      reward_description: null,
    },
  };
  const membership: Membership = {
    id: "demo",
    tenant_id: "demo",
    user_id: "demo",
    plan_id: null,
    modality: "titular",
    status: "active",
    member_code: "ORD-26-0481",
    valid_until: validUntilIso(63),
    points_total: 125,
    created_at: "",
  };

  const ctx: Ctx = { config, tenant, membership };

  return (
    <div
      data-theme={config.themeMode}
      className="flex h-[calc(100dvh-37px)] bg-[var(--background)] text-[var(--foreground)]"
      style={
        {
          "--primary": config.primaryColor,
          "--secondary": config.secondaryColor,
          "--primary-foreground": "#ffffff",
        } as React.CSSProperties
      }
    >
      {/* Sidebar — mesmas classes/dimensões do portal real */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-black/5 bg-white dark:bg-white/[0.03]">
        <div className="flex items-center gap-3 px-5 py-5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
            style={{ background: "var(--primary)" }}
          >
            {config.emoji}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">Sua marca</p>
            <p className="truncate text-[10px] uppercase tracking-wider opacity-50">
              Programa Fidelidade
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {nav.map((item) => {
            const key = pageKey(item.href);
            const isActive = key === active;
            return (
              <a
                key={item.href}
                href={`?page=${key}&theme=${config.themeMode}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                    : "opacity-70 hover:bg-black/5 hover:opacity-100",
                )}
              >
                <Icon name={item.icon} />
                {item.label}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-black/5 p-3">
          <span className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-500">
            <Icon name="logout" /> Sair
          </span>
        </div>
      </aside>

      {/* Conteúdo — mesmo container do portal real */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-10">
          {renderPage(active, ctx)}
        </div>
      </main>
    </div>
  );
}

function pageKey(href: string): string {
  return href === "/" ? "inicio" : href.slice(1);
}

type Ctx = {
  config: DemoConfig;
  tenant: TenantContext;
  membership: Membership;
};

function renderPage(active: string, ctx: Ctx) {
  const ai = ctx.config.aiName;
  switch (active) {
    case "atendente":
      return <Atendente ctx={ctx} />;
    case "agendamentos":
      return (
        <div>
          <PageHeader title="Meus Agendamentos" subtitle="Acompanhe suas próximas consultas e histórico." />
          <EmptyState
            icon={<Icon name="calendar" className="h-6 w-6" />}
            title="Nenhum agendamento futuro"
            description={`Fale com a ${ai} para marcar sua próxima ${ctx.config.labelAppointment.toLowerCase()} de forma rápida.`}
          >
            <Button><Icon name="sparkles" className="mr-2 h-4 w-4" /> Conversar com a {ai}</Button>
          </EmptyState>
        </div>
      );
    case "tratamentos":
      return (
        <div>
          <PageHeader title="Meus Tratamentos" subtitle="Acompanhe a evolução dos seus procedimentos." />
          <EmptyState
            icon={<Icon name="activity" className="h-6 w-6" />}
            title="Nenhum tratamento encontrado"
            description={`Quando um plano de acompanhamento começar, ele aparece aqui. Fale com a ${ai} para saber mais.`}
          >
            <Button variant="outline"><Icon name="sparkles" className="mr-2 h-4 w-4" /> Falar com a {ai}</Button>
          </EmptyState>
        </div>
      );
    case "documentos":
      return <Documentos />;
    case "parcerias":
      return (
        <div>
          <PageHeader title="Parcerias & Convênios" subtitle="Vantagens e descontos exclusivos para membros." />
          <EmptyState
            icon={<Icon name="gift" className="h-6 w-6" />}
            title="Nenhuma parceria por aqui ainda"
            description="Convênios e descontos com parceiros aparecem aqui."
          />
        </div>
      );
    case "engajamento":
      return <Engajamento ctx={ctx} />;
    case "loja":
      return <Loja ctx={ctx} />;
    case "planos":
      return <Planos />;
    case "perfil":
      return <Perfil ctx={ctx} />;
    case "inicio":
    default:
      return <Inicio ctx={ctx} />;
  }
}

/* ---------------- páginas (mesmos componentes do portal real) ---------------- */

function Inicio({ ctx }: { ctx: Ctx }) {
  const { config, tenant, membership } = ctx;
  const points = membership.points_total;
  const goal = config.loyaltyGoal;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm opacity-60">Bem-vindo de volta,</p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Nome do Cliente 👋</h1>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-black/5 bg-white px-3 py-1.5 dark:bg-white/5">
          <div className="text-right leading-tight">
            <p className="text-[10px] uppercase tracking-wider opacity-50">Pontos</p>
            <p className="font-bold text-[var(--primary)]">{points}</p>
          </div>
          <div
            className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-[var(--primary-foreground)]"
            style={{ background: "var(--primary)" }}
          >
            NC
          </div>
        </div>
      </div>

      <MembershipCard membership={membership} memberName="Nome do Cliente" tenant={tenant} planName="Basic" />

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <Icon name="award" />
              </div>
              <div>
                <h2 className="font-semibold">Programa Fidelidade</h2>
                <p className="text-sm opacity-60">Faça check-in a cada consulta mensal.</p>
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
              <span className="font-medium">1 / {goal} meses</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${(1 / goal) * 100}%`, background: "var(--primary)" }} />
            </div>
          </div>
          <Button className="w-full">Fazer Check-in</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function Atendente({ ctx }: { ctx: Ctx }) {
  const { aiName, aiWelcome } = ctx.config;
  return (
    <div className="flex h-[72vh] flex-col overflow-hidden rounded-2xl border border-black/5 bg-white dark:bg-white/5">
      <div className="flex items-center justify-between gap-3 border-b border-black/5 px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Icon name="sparkles" />
          </div>
          <div>
            <p className="font-semibold leading-tight">{aiName} — Atendente Virtual</p>
            <p className="text-xs opacity-50">Suas últimas 5 conversas disponíveis</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="rounded-lg border border-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary)]">Histórico</span>
          <span className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-sm font-medium text-[var(--primary-foreground)]">Nova Conversa</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
          <Icon name="sparkles" className="h-9 w-9" />
        </div>
        <h2 className="mt-5 text-2xl font-bold">Olá! Eu sou a {aiName} 😊</h2>
        <p className="mt-2 max-w-md text-sm opacity-60">{aiWelcome}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {["Agendar", "Reagendar", "Receituário", "Documento"].map((a) => (
            <span key={a} className="rounded-full border border-black/10 px-4 py-1.5 text-sm font-medium opacity-80">{a}</span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-black/5 px-4 py-3">
        <div className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm opacity-50">Digite sua mensagem...</div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
          <Icon name="send" />
        </div>
      </div>
    </div>
  );
}

function Documentos() {
  return (
    <div>
      <PageHeader title="Documentos" subtitle="Acesse seus arquivos, termos e receituários." />
      <div className="mb-5 inline-flex rounded-xl border border-black/5 bg-black/[0.03] p-1 dark:bg-white/5">
        {["Documentos", "Termos", "Receituários"].map((t, i) => (
          <span
            key={t}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-medium",
              i === 0 ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "opacity-60",
            )}
          >
            {t}
          </span>
        ))}
      </div>
      <EmptyState
        icon={<Icon name="document" className="h-6 w-6" />}
        title="Nenhum documento encontrado"
        description="Nenhum arquivo nesta categoria no momento."
      />
    </div>
  );
}

function Engajamento({ ctx }: { ctx: Ctx }) {
  const points = ctx.membership.points_total;
  const missions: { net: SocialKey; t: string; sub: string; pts: number }[] = [
    { net: "instagram", t: "Siga no Instagram", sub: "@suaclinica", pts: 20 },
    { net: "facebook", t: "Curta no Facebook", sub: "/suaclinica", pts: 20 },
    { net: "youtube", t: "Inscreva-se no YouTube", sub: "Canal da clínica", pts: 25 },
    { net: "x", t: "Siga no X", sub: "@suaclinica", pts: 15 },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Engajamento"
        subtitle="Complete missões, acumule pontos e troque na Loja."
        action={
          <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 dark:bg-white/5">
            <Icon name="award" className="h-5 w-5 text-[var(--primary)]" />
            <span className="font-bold text-[var(--primary)]">{points}</span>
            <span className="text-sm opacity-60">pontos</span>
          </div>
        }
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Missões disponíveis</h2>
        <div className="space-y-3">
          {missions.map((m) => (
            <Card key={m.net}>
              <CardContent className="flex items-center gap-3">
                <SocialLogo name={m.net} className="h-9 w-9" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium">{m.t}</h3>
                  <p className="text-sm opacity-60">{m.sub}</p>
                </div>
                <Badge className="shrink-0 bg-[var(--secondary)]/10 text-[var(--secondary)]">+{m.pts}</Badge>
                <Button variant="outline" type="button" className="px-3 py-1.5">Acessar</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Loja({ ctx }: { ctx: Ctx }) {
  const points = ctx.membership.points_total;
  const rewards = [
    { name: "Limpeza profissional grátis", desc: "Uma limpeza por nossa conta.", cost: 120 },
    { name: "Clareamento com 50% OFF", desc: "Desconto no clareamento dental.", cost: 200 },
    { name: "Kit de higiene bucal", desc: "Escova + creme + fio dental.", cost: 60 },
  ];
  return (
    <div>
      <PageHeader
        title="Loja de Resgate"
        subtitle="Troque seus pontos por recompensas."
        action={
          <div className="flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 dark:bg-white/5">
            <Icon name="award" className="h-5 w-5 text-[var(--primary)]" />
            <span className="font-bold text-[var(--primary)]">{points}</span>
            <span className="text-sm opacity-60">pontos</span>
          </div>
        }
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((r) => {
          const canAfford = points >= r.cost;
          return (
            <div key={r.name} className="flex flex-col overflow-hidden rounded-2xl border border-black/5 bg-white dark:bg-white/5">
              <div className="flex h-32 items-center justify-center bg-[var(--primary)]/10">
                <Icon name="gift" className="h-10 w-10 text-[var(--primary)]" />
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{r.name}</h3>
                  <Badge className="shrink-0 bg-[var(--primary)]/10 text-[var(--primary)]">{r.cost} pts</Badge>
                </div>
                <p className="mt-1 text-sm opacity-60">{r.desc}</p>
                <div className="mt-auto pt-4">
                  <Button className="w-full" variant={canAfford ? "primary" : "outline"} type="button">
                    {canAfford ? "Resgatar" : `Faltam ${r.cost - points} pts`}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Planos() {
  const plans = [
    { name: "Essencial", price: "49,90", popular: false, benefits: ["1 limpeza/ano", "Avaliação clínica", "Desconto 10% em procedimentos"] },
    { name: "Cuidado", price: "89,90", popular: true, benefits: ["2 limpezas/ano", "Raio-X panorâmico", "Desconto 20%", "Clareamento com desconto"] },
    { name: "Família", price: "149,90", popular: false, benefits: ["Até 4 dependentes", "2 limpezas/ano por membro", "Desconto 25%"] },
  ];
  return (
    <div>
      <PageHeader title="Planos" subtitle="Escolha o plano ideal para você e sua família." />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((pl, i) => (
          <div
            key={pl.name}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-white p-6 dark:bg-white/5",
              pl.popular ? "border-[var(--primary)] ring-1 ring-[var(--primary)]" : "border-black/5",
            )}
          >
            {pl.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--primary-foreground)]">
                Popular
              </span>
            )}
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <Icon name={(["user", "star", "crown"] as const)[i] ?? "card"} />
            </div>
            <h3 className="mt-4 text-lg font-bold">{pl.name}</h3>
            <div className="mt-3 flex items-end gap-1">
              <span className="text-sm opacity-60">R$</span>
              <span className="text-4xl font-bold leading-none">{pl.price.split(",")[0]}</span>
              <span className="text-lg font-bold">,{pl.price.split(",")[1]}</span>
              <span className="mb-0.5 text-sm opacity-60">/mês</span>
            </div>
            <ul className="mt-5 flex-1 space-y-2.5 text-sm">
              {pl.benefits.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                  <span className="opacity-80">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <Button variant={pl.popular ? "primary" : "outline"} className="w-full">Fazer Upgrade</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Estilo único dos campos do Perfil (inline → independe de Tailwind/HMR). Cinza
// médio: visível tanto no tema claro quanto no escuro.
const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: 8,
  border: "1px solid rgba(128,128,128,0.4)",
  background: "transparent",
  padding: "9px 12px",
  fontSize: 14,
  color: "inherit",
};

function Perfil({ ctx }: { ctx: Ctx }) {
  const fields: { label: string; value: string; type: string }[] = [
    { label: "Nome completo", value: "Nome do Cliente", type: "text" },
    { label: "E-mail", value: "cliente@exemplo.com", type: "text" },
    ...ctx.config.profileFields.map((f) => ({ label: f.label, value: "", type: f.type })),
  ];
  return (
    <div>
      <PageHeader title="Perfil" subtitle="Gerencie seus dados e preferências." />
      <Card className="mb-5">
        <CardContent className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold text-[var(--primary-foreground)]"
            style={{ background: "var(--primary)" }}
          >
            NC
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold">Nome do Cliente</h2>
            <p className="truncate text-sm text-[var(--primary)]">cliente@exemplo.com</p>
          </div>
          <Badge className="bg-green-500/15 text-green-600">{ctx.config.labelClient} · Titular</Badge>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-5">
          <h3 className="font-semibold">Dados do cadastro</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.label} className={f.type === "textarea" ? "sm:col-span-2" : undefined}>
                <label className="mb-1 block text-sm opacity-70">{f.label}</label>
                {f.type === "textarea" ? (
                  <textarea
                    rows={4}
                    defaultValue={f.value}
                    disabled
                    style={{ ...FIELD_STYLE, minHeight: 112, resize: "none" }}
                  />
                ) : (
                  <input defaultValue={f.value} disabled style={FIELD_STYLE} />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

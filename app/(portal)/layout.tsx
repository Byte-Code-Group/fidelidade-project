import Link from "next/link";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthUser } from "@/lib/supabase/server";
import { PortalSidebar } from "@/components/portal-sidebar";
import { Icon, type IconKey } from "@/components/icons";
import { buildPortalNav } from "@/lib/portal-nav";
import { signOut } from "./actions";
import type { Metadata } from "next";
import { SessionWatch } from "@/components/session-watch";

// White-label: cada portal aparece com o nome e a logo do próprio negócio na
// aba do navegador e no compartilhamento em redes sociais.
export async function generateMetadata(): Promise<Metadata> {
  const ctx = await getCurrentTenant();
  if (!ctx) return {};

  const { tenant, settings } = ctx;
  const description =
    settings.ai_welcome_message ??
    `Portal de ${tenant.name}: carteirinha digital, pontos, recompensas e agendamentos.`;

  return {
    title: { absolute: tenant.name },
    description,
    icons: settings.logo_url ? { icon: settings.logo_url } : undefined,
    openGraph: {
      type: "website",
      locale: "pt_BR",
      siteName: tenant.name,
      title: tenant.name,
      description,
      images: settings.logo_url ? [settings.logo_url] : undefined,
    },
    // Portais de cliente são de acesso privado — fora do índice de busca.
    robots: { index: false, follow: false },
  };
}

// Layout do portal do cliente final.
// Resolve o tenant da request, injeta o tema (CSS variables) e monta a
// navegação (sidebar no desktop, drawer no mobile) conforme os módulos ativos.
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getCurrentTenant();
  // Apex domain (sem subdomínio) → landing page de marketing.
  if (!ctx) {
    return (
      <div className="min-h-dvh bg-white text-gray-900">
        {children}
      </div>
    );
  }

  const { tenant, settings } = ctx;

  // Conta suspensa ou pagamento pendente → bloqueia portal.
  if (tenant.status === "suspended" || tenant.status === "pending") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl">
            🔒
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Portal suspenso</h1>
          <p className="mt-2 text-sm text-gray-500">
            {tenant.status === "pending"
              ? "Este portal está aguardando a confirmação do pagamento. Tente novamente em alguns minutos."
              : "O acesso a este portal está temporariamente suspenso. Entre em contato com a empresa para regularizar."}
          </p>
        </div>
      </div>
    );
  }

  const user = await getAuthUser();

  const themeVars = `
    :root {
      --primary: ${settings.primary_color};
      --secondary: ${settings.secondary_color};
    }
  `;

  // Sem usuário (login/apresentação) → duas colunas no desktop (painel de marca
  // + formulário) e uma coluna no mobile (faixa compacta da marca + conteúdo).
  if (!user) {
    const modules = settings.modules_enabled ?? {};
    const perks: { icon: IconKey; label: string }[] = [
      { icon: "card" as IconKey, label: "Carteirinha digital com QR Code" },
      { icon: "award" as IconKey, label: settings.reward_name ?? "Pontos e recompensas" },
      ...(modules.appointments
        ? [{ icon: "calendar" as IconKey, label: "Agendamentos online" }]
        : []),
      { icon: "chat" as IconKey, label: "Atendimento com IA 24h" },
    ].slice(0, 4);

    return (
      <div
        data-theme={settings.theme_mode}
        className="min-h-dvh bg-[var(--background)] md:grid md:grid-cols-2 lg:grid-cols-[1.1fr_1fr]"
      >
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />

        {/* Painel de marca do tenant */}
        <aside
          className="relative overflow-hidden text-white"
          style={{
            background:
              "linear-gradient(140deg, var(--primary), var(--secondary))",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/15 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-black/15 blur-3xl"
          />

          <div className="relative flex h-full flex-col gap-10 px-6 py-6 md:justify-between md:px-12 md:py-14">
            <Link href="/" className="inline-flex items-center gap-3">
              {settings.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={settings.logo_url}
                  alt=""
                  className="h-10 w-10 rounded-xl bg-white/90 object-cover p-0.5"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-base font-bold">
                  {tenant.name.charAt(0)}
                </div>
              )}
              <span className="text-lg font-semibold tracking-tight">
                {tenant.name}
              </span>
            </Link>

            {/* Argumento de valor: só no desktop, pra não empurrar o form no mobile */}
            <div className="hidden md:block">
              <h2 className="max-w-sm text-3xl font-bold leading-tight tracking-tight lg:text-4xl">
                Seu programa de fidelidade, sempre à mão.
              </h2>
              <ul className="mt-8 space-y-4">
                {perks.map((p) => (
                  <li key={p.label} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                      <Icon name={p.icon} className="h-4 w-4" />
                    </span>
                    <span className="text-sm text-white/90">{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="hidden text-xs text-white/60 md:block">
              © {new Date().getFullYear()} {tenant.name}
            </p>
          </div>
        </aside>

        {/* Conteúdo (login, cadastro, boas-vindas…) */}
        <main className="flex flex-1 items-center justify-center px-5 py-10 md:px-8 md:py-14">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>
    );
  }

  const items = buildPortalNav(settings.modules_enabled);

  return (
    <div data-theme={settings.theme_mode} className="min-h-dvh md:pl-64">
      {/* Tokens de marca do tenant (Server Component → sem flash) */}
      <style dangerouslySetInnerHTML={{ __html: themeVars }} />

      <SessionWatch />

      <PortalSidebar
        brand={{
          name: tenant.name,
          subtitle: "Programa Fidelidade",
          logoUrl: settings.logo_url,
        }}
        items={items}
        signOutAction={signOut}
        defaultTheme={settings.theme_mode}
      />

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}

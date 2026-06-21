import { redirect } from "next/navigation";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { PortalSidebar } from "@/components/portal-sidebar";
import { buildPortalNav } from "@/lib/portal-nav";
import { signOut } from "./actions";

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const themeVars = `
    :root {
      --primary: ${settings.primary_color};
      --secondary: ${settings.secondary_color};
    }
  `;

  // Sem usuário (login/apresentação) → layout simples e centrado, sem nav.
  if (!user) {
    return (
      <div data-theme={settings.theme_mode} className="flex min-h-dvh flex-col">
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
          {children}
        </main>
      </div>
    );
  }

  const items = buildPortalNav(settings.modules_enabled);

  return (
    <div data-theme={settings.theme_mode} className="min-h-dvh md:pl-64">
      {/* Tokens de marca do tenant (Server Component → sem flash) */}
      <style dangerouslySetInnerHTML={{ __html: themeVars }} />

      <PortalSidebar
        brand={{
          name: tenant.name,
          subtitle: "Programa Fidelidade",
          logoUrl: settings.logo_url,
        }}
        items={items}
        signOutAction={signOut}
      />

      <main className="mx-auto w-full max-w-5xl px-5 py-8 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}

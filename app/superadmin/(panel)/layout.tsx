import { requirePlatformAdmin } from "@/lib/superadmin";
import { SuperadminSidebar } from "@/components/superadmin-sidebar";
import { superSignOut } from "../actions";
import { SessionWatch } from "@/components/session-watch";

// Shell do console da plataforma (Fideliza.OS). O guard roda aqui → todas as
// páginas do grupo (panel) exigem platform admin.
export default async function SuperPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePlatformAdmin();

  return (
    <div className="min-h-dvh md:pl-64">
      <SessionWatch />
      <SuperadminSidebar signOutAction={superSignOut} />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}

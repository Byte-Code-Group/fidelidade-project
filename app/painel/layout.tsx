import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/supabase/server";
import { getTenantOwner } from "@/lib/owner";
import { getPlatformAdmin } from "@/lib/superadmin";
import { canCreateAnotherTenant } from "@/lib/tenant-limits";
import { OwnerSidebar } from "@/components/owner-sidebar";
import { platformSignOut } from "@/app/(platform)/conta/actions";
import { switchActiveTenant } from "./actions";

// Shell do painel do dono do tenant. O guard roda aqui → todas as páginas
// do grupo exigem um dono de tenant autenticado (mesmo fallback de
// /painel/page.tsx para quem ainda não tem tenant ou é platform admin).
export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/conta/login");

  const owner = await getTenantOwner();
  if (!owner) {
    const admin = await getPlatformAdmin();
    if (admin) redirect("/superadmin");
    redirect("/conta/configurar");
  }

  const activeTenant = owner.tenants.find((t) => t.id === owner.tenantId);
  const { allowed: canCreateAnother } = canCreateAnotherTenant(
    owner.tenants.filter((t) => t.status !== "suspended").map((t) => t.saas_plan),
  );

  return (
    <div className="min-h-dvh md:pl-64">
      <OwnerSidebar
        signOutAction={platformSignOut}
        businessName={activeTenant?.name}
        tenants={owner.tenants}
        activeTenantId={owner.tenantId}
        canCreateAnother={canCreateAnother}
        switchTenantAction={switchActiveTenant}
      />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}

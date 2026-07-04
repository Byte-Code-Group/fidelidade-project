import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTenantOwner } from "@/lib/owner";
import { getPlatformAdmin } from "@/lib/superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { OwnerSidebar } from "@/components/owner-sidebar";
import { platformSignOut } from "@/app/(platform)/conta/actions";

// Shell do painel do dono do tenant. O guard roda aqui → todas as páginas
// do grupo exigem um dono de tenant autenticado (mesmo fallback de
// /painel/page.tsx para quem ainda não tem tenant ou é platform admin).
export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/conta/login");

  const owner = await getTenantOwner();
  if (!owner) {
    const admin = await getPlatformAdmin();
    if (admin) redirect("/superadmin");
    redirect("/conta/configurar");
  }

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("name")
    .eq("id", owner.tenantId)
    .maybeSingle<{ name: string }>();

  return (
    <div className="min-h-dvh md:pl-64">
      <OwnerSidebar signOutAction={platformSignOut} businessName={tenant?.name} />
      <main className="mx-auto w-full max-w-6xl px-5 py-8 md:px-10 md:py-10">
        {children}
      </main>
    </div>
  );
}

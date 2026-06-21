import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "@/lib/types";
import { TenantTabs } from "./tenant-tabs";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "lvh.me:3000";

// Header + abas compartilhados por Customização / Missões / Planos.
export default async function TenantLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("id, name, slug")
    .eq("id", id)
    .maybeSingle<Pick<Tenant, "id" | "name" | "slug">>();
  if (!tenant) notFound();

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <Link href="/superadmin" className="text-sm opacity-60 hover:opacity-100">
          ← Clientes
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{tenant.name}</h1>
        <a
          href={`http://${tenant.slug}.${ROOT_DOMAIN}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm opacity-60 hover:opacity-100"
        >
          {tenant.slug}.{ROOT_DOMAIN} ↗
        </a>
      </div>

      <TenantTabs tenantId={tenant.id} />

      {children}
    </div>
  );
}

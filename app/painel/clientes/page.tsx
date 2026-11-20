import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { Icon } from "@/components/icons";
import { FlashToast } from "@/components/flash-toast";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { ClientsBrowser, type ClientRow } from "@/components/clients-browser";

interface MemberRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  memberships: {
    id: string;
    member_code: string;
    points_total: number;
    status: string;
    plan_id: string | null;
  }[];
}

export default async function OwnerClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const { deleted } = await searchParams;
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();

  const [{ data: members }, { data: plans }] = await Promise.all([
    db
      .from("users")
      .select(
        "id, full_name, email, created_at, memberships(id, member_code, points_total, status, plan_id)",
      )
      .eq("tenant_id", tenantId)
      .eq("role", "client")
      .order("created_at", { ascending: false })
      .returns<MemberRow[]>(),
    db
      .from("business_plans")
      .select("id, name")
      .eq("tenant_id", tenantId)
      .order("display_order", { ascending: true })
      .returns<{ id: string; name: string }[]>(),
  ]);

  const clients: ClientRow[] = (members ?? []).map((m) => {
    const ms = m.memberships[0];
    return {
      id: m.id,
      name: m.full_name ?? "—",
      email: m.email ?? "sem e-mail",
      code: ms?.member_code ?? "",
      points: ms?.points_total ?? 0,
      status: ms?.status ?? "",
      planId: ms?.plan_id ?? "",
      createdAt: new Date(m.created_at).getTime(),
    };
  });

  return (
    <div className="space-y-4">
      <PageHeader
        icon="users"
        title="Clientes"
        subtitle={clients.length === 1 ? "1 cliente no programa." : `${clients.length} clientes no programa.`}
        action={
          <Link
            href="/painel/clientes/novo"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--primary-foreground)] shadow-sm transition hover:brightness-110 active:scale-[0.97]"
          >
            <Icon name="plus" className="h-4 w-4" />
            Novo cliente
          </Link>
        }
      />
      <FlashToast saved={deleted} successMessage="Cliente excluído." />

      <ClientsBrowser clients={clients} plans={plans ?? []} />
    </div>
  );
}

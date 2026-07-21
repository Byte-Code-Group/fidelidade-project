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

export default async function OwnerClientsPage() {
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
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="mt-1 text-sm text-gray-500">
          {clients.length} cliente(s) final(is) encontrado(s).
        </p>
      </div>

      <ClientsBrowser clients={clients} plans={plans ?? []} />
    </div>
  );
}

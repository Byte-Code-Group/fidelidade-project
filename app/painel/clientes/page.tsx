import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { ownerAdjustMemberPoints, ownerToggleMemberStatus } from "../actions";

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
    valid_until: string | null;
  }[];
}

const statusStyle: Record<string, string> = {
  active: "bg-green-500/10 text-green-600",
  expired: "bg-amber-500/10 text-amber-600",
  suspended: "bg-red-500/10 text-red-600",
};

export default async function OwnerClientsPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: members } = await db
    .from("users")
    .select(
      "id, full_name, email, created_at, memberships(id, member_code, points_total, status, valid_until)",
    )
    .eq("tenant_id", tenantId)
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .returns<MemberRow[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="mt-1 text-sm text-gray-500">
          {members?.length ?? 0} cliente(s) final(is) cadastrado(s).
        </p>
      </div>

      {!members || members.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm opacity-70">
              Nenhum cliente final ainda. Eles entram via cadastro/login no
              portal do seu negócio.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-black/5">
            {members.map((m) => {
              const ms = m.memberships[0];
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.full_name ?? "—"}</p>
                    <p className="truncate text-xs opacity-60">
                      {m.email ?? "sem e-mail"}
                      {ms ? ` · ${ms.member_code}` : ""}
                    </p>
                  </div>

                  {ms ? (
                    <>
                      <span className="text-sm tabular-nums opacity-70">
                        {ms.points_total} pts
                      </span>
                      <Badge className={statusStyle[ms.status] ?? "bg-black/5 opacity-70"}>
                        {ms.status}
                      </Badge>

                      <form action={ownerAdjustMemberPoints.bind(null, ms.id)} className="flex items-center gap-1">
                        <input
                          type="number"
                          name="delta"
                          placeholder="±pts"
                          className="w-20 rounded-lg border border-black/10 bg-transparent px-2 py-1 text-sm"
                        />
                        <Button type="submit" variant="outline" className="px-2 py-1 text-xs">
                          Ajustar
                        </Button>
                      </form>

                      <form
                        action={ownerToggleMemberStatus.bind(
                          null,
                          ms.id,
                          ms.status === "suspended" ? "active" : "suspended",
                        )}
                      >
                        <Button type="submit" variant="outline" className="px-2 py-1 text-xs">
                          {ms.status === "suspended" ? "Reativar" : "Suspender"}
                        </Button>
                      </form>
                    </>
                  ) : (
                    <Badge className="bg-black/5 opacity-70">sem carteirinha</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

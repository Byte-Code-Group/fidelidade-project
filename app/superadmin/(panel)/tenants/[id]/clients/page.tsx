import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminClient } from "@/lib/supabase/admin";

interface MemberRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  memberships: {
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

export default async function ClientsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: members } = await db
    .from("users")
    .select(
      "id, full_name, email, created_at, memberships(member_code, points_total, status, valid_until)",
    )
    .eq("tenant_id", id)
    .eq("role", "client")
    .order("created_at", { ascending: false })
    .returns<MemberRow[]>();

  return (
    <div className="space-y-4">
      <p className="text-sm opacity-60">
        {members?.length ?? 0} cliente(s) final(is) cadastrado(s) neste tenant.
      </p>

      {!members || members.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm opacity-70">
              Nenhum cliente final ainda. Eles entram via cadastro/login no
              portal do tenant.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-black/5">
            {members.map((m) => {
              const ms = m.memberships[0];
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {m.full_name ?? "—"}
                    </p>
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
                      <Badge
                        className={
                          statusStyle[ms.status] ?? "bg-black/5 opacity-70"
                        }
                      >
                        {ms.status}
                      </Badge>
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

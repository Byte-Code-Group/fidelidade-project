import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { Icon } from "@/components/icons";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 15;

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

export default async function OwnerClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page = "1" } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();

  let query = db
    .from("users")
    .select(
      "id, full_name, email, created_at, memberships(id, member_code, points_total, status, valid_until)",
      { count: "exact" },
    )
    .eq("tenant_id", tenantId)
    .eq("role", "client");

  if (q.trim()) {
    const term = q.trim();
    query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const from = (currentPage - 1) * PAGE_SIZE;
  const { data: members, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
    .returns<MemberRow[]>();

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const baseUrl = q.trim()
    ? `/painel/clientes?q=${encodeURIComponent(q.trim())}`
    : "/painel/clientes";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="mt-1 text-sm text-gray-500">
          {count ?? 0} cliente(s) final(is) cadastrado(s).
        </p>
      </div>

      <form method="get" className="flex">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome ou e-mail…"
          className="w-full max-w-sm rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] dark:border-white/10"
        />
      </form>

      {!members || members.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm opacity-70">
              {q.trim()
                ? "Nenhum cliente encontrado."
                : "Nenhum cliente final ainda. Eles entram via cadastro/login no portal do seu negócio."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-black/5">
            {members.map((m) => {
              const ms = m.memberships[0];
              return (
                <Link
                  key={m.id}
                  href={`/painel/clientes/${m.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                >
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
                    </>
                  ) : (
                    <Badge className="bg-black/5 opacity-70">sem carteirinha</Badge>
                  )}

                  <Icon name="chevronRight" className="h-4 w-4 shrink-0 opacity-40" />
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
      )}
    </div>
  );
}

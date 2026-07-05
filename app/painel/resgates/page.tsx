import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { RedemptionsList, type RedemptionRow } from "@/components/redemptions-list";
import { Pagination } from "@/components/ui/pagination";
import { ownerApproveRedemption, ownerRejectRedemption } from "../actions";

const PAGE_SIZE = 15;

export default async function OwnerRedemptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page = "1" } = await searchParams;
  const currentPage = parseInt(page, 10) || 1;
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();

  let query = db
    .from("reward_redemptions")
    .select("*, users!reward_redemptions_user_id_fkey(full_name, email)", { count: "exact" })
    .eq("tenant_id", tenantId);

  if (q.trim()) {
    const term = q.trim();
    const { data: matchingUsers } = await db
      .from("users")
      .select("id")
      .eq("tenant_id", tenantId)
      .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
      .returns<{ id: string }[]>();

    const userIds = (matchingUsers ?? []).map((u) => u.id);
    const orParts = [`reward_name.ilike.%${term}%`];
    if (userIds.length > 0) orParts.push(`user_id.in.(${userIds.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const from = (currentPage - 1) * PAGE_SIZE;
  const { data: redemptions, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1)
    .returns<RedemptionRow[]>();

  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const baseUrl = q.trim()
    ? `/painel/resgates?q=${encodeURIComponent(q.trim())}`
    : "/painel/resgates";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Resgates</h1>
        <p className="mt-1 text-sm text-gray-500">
          Prêmios resgatados pelos clientes na Loja de Resgate do portal.
          Marque como entregue após dar o prêmio presencialmente.
        </p>
      </div>

      <form method="get" className="flex">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Buscar por cliente ou prêmio…"
          className="w-full max-w-sm rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-[var(--primary)] dark:border-white/10"
        />
      </form>

      <RedemptionsList
        redemptions={redemptions ?? []}
        approveAction={ownerApproveRedemption}
        rejectAction={ownerRejectRedemption}
      />

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} baseUrl={baseUrl} />
      )}
    </div>
  );
}

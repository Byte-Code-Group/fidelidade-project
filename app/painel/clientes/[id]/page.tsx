import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Membership, ProfileField, RewardRedemption } from "@/lib/types";
import { ownerAdjustMemberPoints, ownerToggleMemberStatus } from "../../actions";

const statusStyle: Record<string, string> = {
  active: "bg-green-500/10 text-green-600",
  expired: "bg-amber-500/10 text-amber-600",
  suspended: "bg-red-500/10 text-red-600",
};

const redemptionStatusStyle: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600",
  redeemed: "bg-green-500/15 text-green-600",
};

const redemptionStatusLabel: Record<string, string> = {
  pending: "Pendente",
  redeemed: "Entregue",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function OwnerClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();

  const { data: client } = await db
    .from("users")
    .select("id, full_name, email, created_at")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .eq("role", "client")
    .maybeSingle<{ id: string; full_name: string | null; email: string | null; created_at: string }>();
  if (!client) notFound();

  const [{ data: membership }, { data: fields }, { data: values }, { data: redemptions }] =
    await Promise.all([
      db
        .from("memberships")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<Membership>(),
      db
        .from("profile_fields")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("display_order", { ascending: true })
        .returns<ProfileField[]>(),
      db
        .from("profile_field_values")
        .select("field_id, value")
        .eq("tenant_id", tenantId)
        .eq("user_id", id)
        .returns<{ field_id: string; value: string | null }[]>(),
      db
        .from("reward_redemptions")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .returns<RewardRedemption[]>(),
    ]);

  const valueByField = new Map((values ?? []).map((v) => [v.field_id, v.value]));

  return (
    <div className="space-y-4">
      <Link
        href="/painel/clientes"
        className="inline-flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        Clientes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{client.full_name ?? "—"}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {client.email ?? "sem e-mail"} · cliente desde {formatDate(client.created_at)}
          </p>
        </div>
        {membership && (
          <Badge className={statusStyle[membership.status] ?? "bg-black/5 opacity-70"}>
            {membership.status}
          </Badge>
        )}
      </div>

      {membership ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-wider opacity-50">Código</p>
                <p className="mt-0.5 font-medium">{membership.member_code}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider opacity-50">Pontos</p>
                <p className="mt-0.5 font-medium tabular-nums">{membership.points_total}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider opacity-50">Modalidade</p>
                <p className="mt-0.5 font-medium capitalize">{membership.modality}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider opacity-50">Válido até</p>
                <p className="mt-0.5 font-medium">
                  {membership.valid_until ? formatDate(membership.valid_until) : "sem prazo"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-black/10 pt-4 dark:border-white/10">
              <form
                action={ownerAdjustMemberPoints.bind(null, membership.id)}
                className="flex items-center gap-1.5"
              >
                <input
                  type="number"
                  name="delta"
                  placeholder="±pts"
                  className="w-24 rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10"
                />
                <Button type="submit" variant="outline" className="px-3 py-1.5 text-sm">
                  Ajustar pontos
                </Button>
              </form>

              <form
                action={ownerToggleMemberStatus.bind(
                  null,
                  membership.id,
                  membership.status === "suspended" ? "active" : "suspended",
                )}
              >
                <Button type="submit" variant="outline" className="px-3 py-1.5 text-sm">
                  {membership.status === "suspended" ? "Reativar" : "Suspender"}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm opacity-70">Cliente sem carteirinha.</p>
          </CardContent>
        </Card>
      )}

      {(fields ?? []).length > 0 && (
        <Card>
          <CardContent>
            <h2 className="mb-3 font-semibold">Cadastro</h2>
            <dl className="grid grid-cols-2 gap-4">
              {(fields ?? []).map((f) => (
                <div key={f.id}>
                  <dt className="text-xs uppercase tracking-wider opacity-50">{f.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium">
                    {valueByField.get(f.id) || "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <h2 className="mb-3 font-semibold">Resgates ({(redemptions ?? []).length})</h2>
          {!redemptions || redemptions.length === 0 ? (
            <p className="text-sm opacity-60">Nenhum resgate ainda.</p>
          ) : (
            <div className="-mx-6 divide-y divide-black/5">
              {redemptions.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.reward_name}</p>
                    <p className="text-xs opacity-60">
                      {r.points_spent} pts · {formatDate(r.created_at)}
                    </p>
                  </div>
                  <Badge className={redemptionStatusStyle[r.status] ?? "bg-black/5"}>
                    {redemptionStatusLabel[r.status] ?? r.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

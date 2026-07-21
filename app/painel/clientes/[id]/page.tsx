import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { DataList, type DataListRow } from "@/components/data-list";
import { Icon } from "@/components/icons";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, signedUrl } from "@/lib/storage";
import type {
  Appointment,
  Checkin,
  Document,
  Membership,
  MissionCompletion,
  ProfileField,
  RewardRedemption,
} from "@/lib/types";
import { ownerSetMemberPoints, ownerToggleMemberStatus } from "../../actions";

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

const completionStatusStyle: Record<string, string> = {
  pending_validation: "bg-amber-500/15 text-amber-600",
  completed: "bg-green-500/15 text-green-600",
};

const completionStatusLabel: Record<string, string> = {
  pending_validation: "Pendente",
  completed: "Validada",
};

const appointmentStatusStyle: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-600",
};

const appointmentStatusLabel: Record<string, string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface CompletionRow extends MissionCompletion {
  missions: { title: string; points: number } | null;
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-6 py-8 text-center text-sm opacity-50">{text}</p>;
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

  const [
    { data: membership },
    { data: fields },
    { data: values },
    { data: redemptions },
    { data: completions },
    { data: checkins },
    { data: appointments },
    { data: documents },
  ] = await Promise.all([
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
    db
      .from("mission_completions")
      .select("*, missions(title, points)")
      .eq("tenant_id", tenantId)
      .eq("user_id", id)
      .order("completed_at", { ascending: false })
      .returns<CompletionRow[]>(),
    db
      .from("checkins")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .returns<Checkin[]>(),
    db
      .from("appointments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", id)
      .order("scheduled_at", { ascending: false })
      .returns<Appointment[]>(),
    db
      .from("documents")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .returns<Document[]>(),
  ]);

  const valueByField = new Map((values ?? []).map((v) => [v.field_id, v.value]));

  // Bucket privado: o file_url guardado é um path, precisa de signed URL.
  const documentLinks = await Promise.all(
    (documents ?? []).map(async (d) => ({
      ...d,
      file_url: await signedUrl(BUCKETS.documents, d.file_url),
    })),
  );

  // ----- Linhas para as listas paginadas (busca/filtro no cliente) -----
  const redemptionRows: DataListRow[] = (redemptions ?? []).map((r) => ({
    id: r.id,
    title: r.reward_name,
    subtitle: `${r.points_spent} pts · ${formatDate(r.created_at)}`,
    badge: {
      label: redemptionStatusLabel[r.status] ?? r.status,
      className: redemptionStatusStyle[r.status] ?? "bg-black/5",
    },
    search: `${r.reward_name} ${redemptionStatusLabel[r.status] ?? r.status}`.toLowerCase(),
    filter: r.status,
  }));

  const completionRows: DataListRow[] = (completions ?? []).map((c) => ({
    id: c.id,
    title: c.missions?.title ?? "Missão removida",
    subtitle: `${c.missions?.points ?? 0} pts${c.completed_at ? ` · ${formatDate(c.completed_at)}` : ""}`,
    badge: {
      label: completionStatusLabel[c.status] ?? c.status,
      className: completionStatusStyle[c.status] ?? "bg-black/5",
    },
    search: `${c.missions?.title ?? ""} ${completionStatusLabel[c.status] ?? c.status}`.toLowerCase(),
    filter: c.status,
  }));

  const checkinRows: DataListRow[] = (checkins ?? []).map((c) => ({
    id: c.id,
    title: formatDateTime(c.created_at),
    subtitle: c.method,
    trailing: `+${c.points_earned} pts`,
    search: `${formatDateTime(c.created_at)} ${c.method}`.toLowerCase(),
    filter: c.method,
  }));
  const checkinMethods = Array.from(new Set((checkins ?? []).map((c) => c.method)));

  const appointmentRows: DataListRow[] = (appointments ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    subtitle: formatDateTime(a.scheduled_at),
    note: a.notes ?? undefined,
    badge: {
      label: appointmentStatusLabel[a.status] ?? a.status,
      className: appointmentStatusStyle[a.status] ?? "bg-black/5",
    },
    search: `${a.title} ${a.notes ?? ""} ${appointmentStatusLabel[a.status] ?? a.status}`.toLowerCase(),
    filter: a.status,
  }));

  const documentRows: DataListRow[] = documentLinks.map((d) => ({
    id: d.id,
    title: d.title,
    subtitle: `${d.category} · ${formatDate(d.created_at)}`,
    href: d.file_url,
    search: `${d.title} ${d.category}`.toLowerCase(),
    filter: d.category,
  }));
  const documentCategories = Array.from(new Set(documentLinks.map((d) => d.category)));

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
                action={ownerSetMemberPoints.bind(null, membership.id)}
                className="flex items-center gap-1.5"
              >
                <label className="text-sm opacity-60">Pontos:</label>
                <input
                  type="number"
                  name="points"
                  min={0}
                  defaultValue={membership.points_total}
                  className="w-24 rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/10"
                />
                <Button type="submit" variant="outline" className="px-3 py-1.5 text-sm">
                  Salvar pontos
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

      <Tabs
        tabs={[
          {
            key: "cadastro",
            label: "Cadastro",
            icon: "user",
            content: (
              <Card>
                <CardContent>
                  {(fields ?? []).length === 0 ? (
                    <EmptyRow text="Nenhum campo de cadastro configurado." />
                  ) : (
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
                  )}
                </CardContent>
              </Card>
            ),
          },
          {
            key: "resgates",
            label: "Resgates",
            icon: "gift",
            count: redemptionRows.length,
            content: (
              <Card>
                <DataList
                  rows={redemptionRows}
                  emptyText="Nenhum resgate ainda."
                  searchPlaceholder="Buscar recompensa..."
                  filters={[
                    { label: "Pendente", value: "pending" },
                    { label: "Entregue", value: "redeemed" },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "validacoes",
            label: "Validações",
            icon: "check",
            count: completionRows.length,
            content: (
              <Card>
                <DataList
                  rows={completionRows}
                  emptyText="Nenhuma missão concluída ainda."
                  searchPlaceholder="Buscar missão..."
                  filters={[
                    { label: "Pendente", value: "pending_validation" },
                    { label: "Validada", value: "completed" },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "checkins",
            label: "Check-ins",
            icon: "activity",
            count: checkinRows.length,
            content: (
              <Card>
                <DataList
                  rows={checkinRows}
                  emptyText="Nenhum check-in ainda."
                  searchPlaceholder="Buscar check-in..."
                  filters={checkinMethods.map((m) => ({ label: m, value: m }))}
                />
              </Card>
            ),
          },
          {
            key: "agendamentos",
            label: "Agendamentos",
            icon: "calendar",
            count: appointmentRows.length,
            content: (
              <Card>
                <DataList
                  rows={appointmentRows}
                  emptyText="Nenhum agendamento ainda."
                  searchPlaceholder="Buscar agendamento..."
                  filters={[
                    { label: "Agendado", value: "scheduled" },
                    { label: "Concluído", value: "completed" },
                    { label: "Cancelado", value: "cancelled" },
                  ]}
                />
              </Card>
            ),
          },
          {
            key: "documentos",
            label: "Documentos",
            icon: "document",
            count: documentRows.length,
            content: (
              <Card>
                <DataList
                  rows={documentRows}
                  emptyText="Nenhum documento ainda."
                  searchPlaceholder="Buscar documento..."
                  filters={documentCategories.map((c) => ({ label: c, value: c }))}
                />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

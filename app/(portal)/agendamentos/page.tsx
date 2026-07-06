import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/icons";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type { Appointment } from "@/lib/types";

const statusStyle: Record<string, string> = {
  scheduled: "bg-blue-500/10 text-blue-600",
  completed: "bg-green-500/10 text-green-600",
  cancelled: "bg-red-500/10 text-red-600",
};

const statusLabel: Record<string, string> = {
  scheduled: "Agendado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AgendamentosPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { data: appointments } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: false })
    .returns<Appointment[]>();

  const now = new Date().toISOString();
  const upcoming = (appointments ?? []).filter(
    (a) => a.status === "scheduled" && a.scheduled_at >= now,
  );
  const past = (appointments ?? []).filter(
    (a) => a.status !== "scheduled" || a.scheduled_at < now,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meus Agendamentos"
        subtitle="Acompanhe suas próximas consultas e histórico."
      />

      {/* Próximos */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="calendar" className="h-4 w-4 opacity-60" />
          Próximas consultas
        </h2>

        {upcoming.length === 0 ? (
          <EmptyState
            icon={<Icon name="calendar" className="h-6 w-6" />}
            title="Nenhum agendamento futuro"
            description={`Fale com a ${ctx.settings.ai_name} para marcar sua próxima visita de forma rápida.`}
          >
            <Link href="/atendente">
              <Button>
                <Icon name="sparkles" className="mr-2 h-4 w-4" />
                Conversar com a {ctx.settings.ai_name}
              </Button>
            </Link>
          </EmptyState>
        ) : (
          <Card>
            <div className="divide-y divide-black/5">
              {upcoming.map((a) => (
                <div key={a.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-[var(--primary)]/10 text-center leading-tight">
                    <span className="text-[10px] font-medium uppercase text-[var(--primary)] opacity-70">
                      {new Date(a.scheduled_at).toLocaleDateString("pt-BR", { month: "short" })}
                    </span>
                    <span className="text-lg font-bold text-[var(--primary)]">
                      {new Date(a.scheduled_at).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs opacity-60">{fmtDate(a.scheduled_at)}</p>
                    {a.notes && (
                      <p className="mt-1 text-xs opacity-50">{a.notes}</p>
                    )}
                  </div>
                  <Badge className={statusStyle[a.status]}>
                    {statusLabel[a.status]}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Histórico */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold opacity-60">
            Histórico ({past.length})
          </h2>
          <Card>
            <div className="divide-y divide-black/5">
              {past.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-4 px-5 py-3.5 opacity-70"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs opacity-60">{fmtDate(a.scheduled_at)}</p>
                  </div>
                  <Badge className={statusStyle[a.status] ?? "bg-black/5"}>
                    {statusLabel[a.status] ?? a.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}
    </div>
  );
}

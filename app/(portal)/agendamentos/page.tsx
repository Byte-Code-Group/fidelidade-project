import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Icon } from "@/components/icons";
import { BookingForm } from "@/components/agenda/booking-form";
import { ClientAppointments } from "@/components/agenda/client-appointments";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { listProviders } from "@/lib/providers";
import { listProcedures, listProviderProcedures } from "@/lib/procedures";
import { DEFAULT_TIMEZONE, formatarDataHora, hojeNoFuso } from "@/lib/scheduling";
import type { AppointmentDetalhado } from "@/lib/types";
import {
  clientAvailableSlots,
  clientBookAppointment,
  clientCancelAppointment,
} from "../actions";

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

export default async function AgendamentosPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const timeZone = ctx.settings.timezone || DEFAULT_TIMEZONE;
  const labelAppointment = ctx.settings.label_appointment ?? "Agendamento";
  const tenantId = ctx.tenant.id;

  const [{ data: appointments }, providers, procedures, vinculos] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, providers(id, name, color), procedures(id, name, duration_min)")
      .eq("user_id", user.id)
      .order("scheduled_at", { ascending: false })
      .returns<AppointmentDetalhado[]>(),
    listProviders(tenantId, { somenteAtivos: true }),
    listProcedures(tenantId, { somenteAtivos: true }),
    listProviderProcedures(tenantId),
  ]);

  const agora = new Date().toISOString();
  const upcoming = (appointments ?? []).filter(
    (a) => a.status === "scheduled" && a.scheduled_at >= agora,
  );
  const past = (appointments ?? []).filter(
    (a) => a.status !== "scheduled" || a.scheduled_at < agora,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Meus ${labelAppointment.toLowerCase()}s`}
        subtitle="Marque um horário e acompanhe seu histórico."
      />

      <Section
        title={`Marcar ${labelAppointment.toLowerCase()}`}
        desc="Escolha o serviço, o profissional e um horário livre."
      >
        <BookingForm
          providers={providers}
          procedures={procedures}
          vinculos={vinculos}
          dataInicial={hojeNoFuso(timeZone)}
          labelAppointment={labelAppointment}
          slotsAction={clientAvailableSlots}
          bookAction={clientBookAppointment}
        />
      </Section>

      {/* Próximos */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Icon name="calendar" className="h-4 w-4 opacity-60" />
          Próximos
        </h2>

        {upcoming.length === 0 ? (
          <EmptyState
            icon={<Icon name="calendar" className="h-6 w-6" />}
            title="Nenhum agendamento futuro"
            description="Escolha um horário acima para marcar sua próxima visita."
          />
        ) : (
          <ClientAppointments
            agendamentos={upcoming}
            timeZone={timeZone}
            cancelAction={clientCancelAppointment}
          />
        )}
      </section>

      {/* Histórico */}
      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold opacity-60">Histórico ({past.length})</h2>
          <Card>
            <div className="divide-y divide-black/5">
              {past.map((a) => (
                <div key={a.id} className="flex items-center gap-4 px-5 py-3.5 opacity-70">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs opacity-60">
                      {formatarDataHora(a.scheduled_at, timeZone)}
                      {a.providers ? ` · ${a.providers.name}` : ""}
                    </p>
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

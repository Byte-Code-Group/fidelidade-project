import Link from "next/link";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantSettings } from "@/lib/tenant-settings";
import { listProviders, listScheduleExceptions } from "@/lib/providers";
import { listProcedures, listProviderProcedures } from "@/lib/procedures";
import { listAppointmentsOfDay, listAppointmentsRange } from "@/lib/appointments";
import {
  DEFAULT_TIMEZONE,
  formatarDataLonga,
  hojeNoFuso,
  inicioDoMes,
  mesSeguinte,
  partesNoFuso,
  somarDias,
} from "@/lib/scheduling";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { MonthCalendar, type DiaResumo } from "@/components/agenda/month-calendar";
import { DayAgenda } from "@/components/agenda/day-agenda";
import { AppointmentForm } from "@/components/agenda/appointment-form";
import {
  ownerAvailableSlots,
  ownerCreateAppointment,
  ownerDeleteAppointment,
  ownerRescheduleAppointment,
  ownerSetAppointmentStatus,
} from "../actions";

interface ClienteRow {
  id: string;
  full_name: string | null;
  email: string | null;
}

// Data válida ("YYYY-MM-DD") ou o fallback.
function normalizaData(valor: string | undefined, fallback: string): string {
  return valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : fallback;
}

function normalizaMes(valor: string | undefined, fallback: string): string {
  return valor && /^\d{4}-\d{2}$/.test(valor) ? valor : fallback;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; mes?: string }>;
}) {
  const { tenantId } = await requireTenantOwner();
  const { dia: diaParam, mes: mesParam } = await searchParams;

  const settings = await getTenantSettings(tenantId);
  const timeZone = settings?.timezone || DEFAULT_TIMEZONE;
  const labelClient = settings?.label_client ?? "Cliente";

  const hoje = hojeNoFuso(timeZone);
  const dia = normalizaData(diaParam, hoje);
  // Mês segue o dia escolhido, a não ser que a navegação peça outro.
  const mes = normalizaMes(mesParam, dia.slice(0, 7));

  const primeiroDoMes = inicioDoMes(mes);
  const ultimoDoMes = somarDias(inicioDoMes(mesSeguinte(mes)), -1);

  const db = createAdminClient();
  const [
    providers,
    procedures,
    vinculos,
    doMes,
    doDia,
    excecoes,
    { data: clientes },
  ] = await Promise.all([
    listProviders(tenantId),
    listProcedures(tenantId, { somenteAtivos: true }),
    listProviderProcedures(tenantId),
    listAppointmentsRange(tenantId, primeiroDoMes, ultimoDoMes, timeZone),
    listAppointmentsOfDay(tenantId, dia, timeZone),
    listScheduleExceptions(tenantId, primeiroDoMes),
    db
      .from("users")
      .select("id, full_name, email")
      .eq("tenant_id", tenantId)
      .eq("role", "client")
      .order("full_name", { ascending: true })
      .returns<ClienteRow[]>(),
  ]);

  // Resumo por dia: pontinho colorido por profissional + marca de dia fechado.
  const resumoPorDia: Record<string, DiaResumo> = {};
  for (const a of doMes) {
    if (a.status === "cancelled") continue;
    const data = partesNoFuso(a.scheduled_at, timeZone).date;
    const atual = (resumoPorDia[data] ??= { total: 0, cores: [] });
    atual.total += 1;
    const cor = a.providers?.color ?? "#64748B";
    if (!atual.cores.includes(cor)) atual.cores.push(cor);
  }
  for (const ex of excecoes) {
    // Só folga do negócio inteiro (sem profissional) e de dia inteiro fecha o dia.
    if (ex.provider_id || ex.start_time) continue;
    (resumoPorDia[ex.exception_date] ??= { total: 0, cores: [] }).fechado = true;
  }

  const ativos = doDia.filter((a) => a.status !== "cancelled");
  const providersAtivos = providers.filter((p) => p.is_active);

  const hrefDoDia = (dateISO: string) =>
    `/painel/agenda?dia=${dateISO}&mes=${dateISO.slice(0, 7)}`;
  const hrefDoMes = (novoMes: string) => `/painel/agenda?dia=${dia}&mes=${novoMes}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agenda</h1>
          <p className="mt-1 text-sm text-gray-500">
            Calendário de atendimentos, horários dos profissionais e procedimentos.
          </p>
        </div>
        <Link href="/painel/agenda/configuracoes">
          <Button variant="outline" type="button">
            Configurações da agenda
          </Button>
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <MonthCalendar
            mes={mes}
            diaSelecionado={dia}
            hoje={hoje}
            resumoPorDia={resumoPorDia}
            hrefDoDia={hrefDoDia}
            hrefDoMes={hrefDoMes}
          />

          {providersAtivos.length > 0 && (
            <Card>
              <CardContent className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-50">
                  Profissionais
                </p>
                {providersAtivos.map((p) => (
                  <p key={p.id} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: p.color }}
                    />
                    <span className="truncate">{p.name}</span>
                    {p.specialty && (
                      <span className="truncate text-xs opacity-50">{p.specialty}</span>
                    )}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Section
            title={
              dia === hoje ? "Hoje" : formatarDataLonga(dia).replace(/^./, (c) => c.toUpperCase())
            }
            desc={
              ativos.length === 0
                ? "Nenhum atendimento ativo nesse dia."
                : `${ativos.length} atendimento(s) ativo(s) · ${doDia.length} no total`
            }
          >
            <DayAgenda
              agendamentos={doDia}
              providers={providersAtivos}
              timeZone={timeZone}
              labelClient={labelClient}
              slotsAction={ownerAvailableSlots}
              statusAction={ownerSetAppointmentStatus}
              rescheduleAction={ownerRescheduleAppointment}
              deleteAction={ownerDeleteAppointment}
            />
          </Section>

          <Section title="Novo agendamento" desc="Só aparecem horários realmente livres.">
            {clientes && clientes.length > 0 ? (
              <AppointmentForm
                providers={providersAtivos}
                procedures={procedures}
                vinculos={vinculos}
                clientes={clientes}
                dataInicial={dia}
                labelClient={labelClient}
                slotsAction={ownerAvailableSlots}
                createAction={ownerCreateAppointment}
              />
            ) : (
              <p className="rounded-xl bg-black/5 px-3 py-2.5 text-sm opacity-70 dark:bg-white/10">
                Nenhum {labelClient.toLowerCase()} cadastrado ainda — o cadastro
                acontece pelo portal do seu negócio.
              </p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

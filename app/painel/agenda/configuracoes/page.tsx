import Link from "next/link";
import { requireTenantOwner } from "@/lib/owner";
import { getTenantSettings } from "@/lib/tenant-settings";
import {
  listProviders,
  listProviderSchedules,
  listScheduleExceptions,
} from "@/lib/providers";
import { listProcedures, listProviderProcedures } from "@/lib/procedures";
import { DEFAULT_TIMEZONE, hojeNoFuso } from "@/lib/scheduling";
import { Section } from "@/components/ui/section";
import { ProvidersManager } from "@/components/agenda/providers-manager";
import { ProceduresManager } from "@/components/agenda/procedures-manager";
import { TimezoneForm } from "@/components/agenda/timezone-form";
import {
  ownerCreateProvider,
  ownerUpdateProvider,
  ownerDeleteProvider,
  ownerCreateProviderSchedule,
  ownerDeleteProviderSchedule,
  ownerCopyProviderScheduleDay,
  ownerCreateScheduleException,
  ownerDeleteScheduleException,
  ownerSetProviderProcedures,
  ownerCreateProcedure,
  ownerUpdateProcedure,
  ownerDeleteProcedure,
  ownerUpdateTimezone,
} from "../../actions";

export default async function ConfiguracoesAgendaPage() {
  const { tenantId } = await requireTenantOwner();

  const settings = await getTenantSettings(tenantId);
  const timeZone = settings?.timezone || DEFAULT_TIMEZONE;
  const hoje = hojeNoFuso(timeZone);

  const [providers, schedules, exceptions, procedures, vinculos] = await Promise.all([
    listProviders(tenantId),
    listProviderSchedules(tenantId),
    listScheduleExceptions(tenantId, hoje),
    listProcedures(tenantId),
    listProviderProcedures(tenantId),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link href="/painel/agenda" className="text-sm opacity-60 hover:opacity-100">
          ← Agenda
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Configurações da agenda</h1>
        <p className="mt-1 text-sm text-gray-500">
          Quem atende, em quais horários e quais procedimentos existem. É daqui
          que saem os horários livres oferecidos no agendamento.
        </p>
      </div>

      <Section
        title="Profissionais"
        desc="Cada profissional tem cor no calendário, horário de trabalho e folgas."
      >
        <ProvidersManager
          providers={providers}
          schedules={schedules}
          exceptions={exceptions}
          procedures={procedures}
          vinculos={vinculos}
          createAction={ownerCreateProvider}
          updateAction={ownerUpdateProvider}
          deleteAction={ownerDeleteProvider}
          createScheduleAction={ownerCreateProviderSchedule}
          deleteScheduleAction={ownerDeleteProviderSchedule}
          copyDayAction={ownerCopyProviderScheduleDay}
          createExceptionAction={ownerCreateScheduleException}
          deleteExceptionAction={ownerDeleteScheduleException}
          setProceduresAction={ownerSetProviderProcedures}
        />
      </Section>

      <Section
        title="Procedimentos"
        desc="A duração define o tamanho do horário reservado na agenda."
      >
        <ProceduresManager
          procedures={procedures}
          createAction={ownerCreateProcedure}
          updateAction={ownerUpdateProcedure}
          deleteAction={ownerDeleteProcedure}
        />
      </Section>

      <Section
        title="Fuso horário"
        desc="Base para converter os horários de trabalho em horários reais."
      >
        <TimezoneForm timeZone={timeZone} saveAction={ownerUpdateTimezone} />
      </Section>
    </div>
  );
}

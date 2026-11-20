import { BackLink } from "@/components/ui/back-link";
import { PageHeader } from "@/components/ui/page-header";
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
        <BackLink href="/painel/agenda">Agenda</BackLink>
        <PageHeader
          icon="settings"
          title="Configurações da agenda"
          subtitle="Quem atende, em quais horários e quais procedimentos existem. É daqui que saem os horários livres do agendamento."
        />
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

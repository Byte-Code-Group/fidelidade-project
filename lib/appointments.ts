import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzirErro } from "@/lib/error-messages";
import {
  DEFAULT_SLOT_STEP,
  DEFAULT_TIMEZONE,
  minutosDoHorario,
  partesNoFuso,
  slotsLivres,
  somarDias,
  weekdayDaData,
  zonedToUtc,
  type Bloco,
} from "@/lib/scheduling";
import type {
  Appointment,
  AppointmentDetalhado,
  AppointmentStatus,
  Procedure,
  Provider,
  ProviderSchedule,
  ScheduleException,
} from "@/lib/types";

const SELECT_DETALHADO =
  "*, providers(id, name, color), procedures(id, name, duration_min), users!appointments_user_id_fkey(id, full_name, email)";

// ---------- Consultas ----------

/** Agendamentos que começam dentro do período (datas "YYYY-MM-DD" no fuso). */
export async function listAppointmentsRange(
  tenantId: string,
  deISO: string,
  ateISO: string,
  timeZone = DEFAULT_TIMEZONE,
): Promise<AppointmentDetalhado[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("appointments")
    .select(SELECT_DETALHADO)
    .eq("tenant_id", tenantId)
    .gte("scheduled_at", zonedToUtc(deISO, "00:00", timeZone).toISOString())
    .lt("scheduled_at", zonedToUtc(somarDias(ateISO, 1), "00:00", timeZone).toISOString())
    .order("scheduled_at", { ascending: true })
    .returns<AppointmentDetalhado[]>();
  return data ?? [];
}

export async function listAppointmentsOfDay(
  tenantId: string,
  dateISO: string,
  timeZone = DEFAULT_TIMEZONE,
): Promise<AppointmentDetalhado[]> {
  return listAppointmentsRange(tenantId, dateISO, dateISO, timeZone);
}

export async function getAppointment(
  tenantId: string,
  appointmentId: string,
): Promise<AppointmentDetalhado | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("appointments")
    .select(SELECT_DETALHADO)
    .eq("tenant_id", tenantId)
    .eq("id", appointmentId)
    .maybeSingle<AppointmentDetalhado>();
  return data ?? null;
}

// ---------- Disponibilidade ----------

interface DisponibilidadeInput {
  tenantId: string;
  dateISO: string;
  providerId: string;
  duracao: number;
  timeZone?: string;
  passo?: number;
  /** Agendamento sendo remarcado — o próprio horário dele não bloqueia. */
  ignorarAppointmentId?: string;
  agora?: Date;
}

/**
 * Horários livres ("HH:MM") de um profissional numa data: horário de trabalho
 * do dia da semana, menos folgas/bloqueios, menos o que já está agendado.
 */
export async function horariosDisponiveis({
  tenantId,
  dateISO,
  providerId,
  duracao,
  timeZone = DEFAULT_TIMEZONE,
  passo = DEFAULT_SLOT_STEP,
  ignorarAppointmentId,
  agora = new Date(),
}: DisponibilidadeInput): Promise<string[]> {
  const db = createAdminClient();
  const weekday = weekdayDaData(dateISO);

  const [{ data: horarios }, { data: excecoes }, { data: agendados }] = await Promise.all([
    db
      .from("provider_schedules")
      .select("start_time, end_time")
      .eq("tenant_id", tenantId)
      .eq("provider_id", providerId)
      .eq("weekday", weekday)
      .returns<Pick<ProviderSchedule, "start_time" | "end_time">[]>(),
    db
      .from("schedule_exceptions")
      .select("provider_id, start_time, end_time")
      .eq("tenant_id", tenantId)
      .eq("exception_date", dateISO)
      .or(`provider_id.eq.${providerId},provider_id.is.null`)
      .returns<Pick<ScheduleException, "provider_id" | "start_time" | "end_time">[]>(),
    db
      .from("appointments")
      .select("id, scheduled_at, duration_min")
      .eq("tenant_id", tenantId)
      .eq("provider_id", providerId)
      .eq("status", "scheduled")
      .gte("scheduled_at", zonedToUtc(dateISO, "00:00", timeZone).toISOString())
      .lt("scheduled_at", zonedToUtc(somarDias(dateISO, 1), "00:00", timeZone).toISOString())
      .returns<Pick<Appointment, "id" | "scheduled_at" | "duration_min">[]>(),
  ]);

  const trabalho: Bloco[] = (horarios ?? []).map((h) => ({
    start: minutosDoHorario(h.start_time),
    end: minutosDoHorario(h.end_time),
  }));
  if (trabalho.length === 0) return [];

  const ocupado: Bloco[] = [];

  for (const ex of excecoes ?? []) {
    // Sem horário = dia inteiro bloqueado.
    if (!ex.start_time || !ex.end_time) return [];
    ocupado.push({
      start: minutosDoHorario(ex.start_time),
      end: minutosDoHorario(ex.end_time),
    });
  }

  for (const ag of agendados ?? []) {
    if (ignorarAppointmentId && ag.id === ignorarAppointmentId) continue;
    const inicio = partesNoFuso(ag.scheduled_at, timeZone).minutos;
    ocupado.push({ start: inicio, end: inicio + ag.duration_min });
  }

  return slotsLivres({
    dateISO,
    trabalho,
    ocupado,
    duracao,
    passo,
    agora,
    timeZone,
  });
}

/** Dias do período em que o profissional tem pelo menos um horário livre. */
export async function diasComVaga(
  tenantId: string,
  providerId: string,
  duracao: number,
  deISO: string,
  dias: number,
  timeZone = DEFAULT_TIMEZONE,
): Promise<string[]> {
  const datas = Array.from({ length: dias }, (_, i) => somarDias(deISO, i));
  const resultados = await Promise.all(
    datas.map(async (dateISO) => ({
      dateISO,
      livres: await horariosDisponiveis({
        tenantId,
        dateISO,
        providerId,
        duracao,
        timeZone,
      }),
    })),
  );
  return resultados.filter((r) => r.livres.length > 0).map((r) => r.dateISO);
}

export interface OpcaoDeHorario {
  dateISO: string;
  time: string;
  providerId: string;
  providerName: string;
  procedureId: string | null;
  procedureName: string | null;
  duracao: number;
}

/**
 * Próximas vagas reais para um procedimento, varrendo dia a dia a partir de
 * `deISO` — é o que o assistente oferece ao cliente em vez de perguntar
 * "que dia você prefere?" (ver lib/ai/tools.ts).
 *
 * Considera só profissionais ativos que atendem o procedimento (sem vínculo
 * em provider_procedures = atende todos) e para assim que junta `limite`
 * opções, no máximo `porDia` de cada dia para não devolver só um período.
 */
export async function proximasVagas(
  tenantId: string,
  {
    procedureId,
    providerId,
    deISO,
    dias = 14,
    limite = 6,
    porDia = 2,
    timeZone = DEFAULT_TIMEZONE,
    agora = new Date(),
  }: {
    procedureId?: string | null;
    providerId?: string | null;
    deISO: string;
    dias?: number;
    limite?: number;
    porDia?: number;
    timeZone?: string;
    agora?: Date;
  },
): Promise<OpcaoDeHorario[]> {
  const db = createAdminClient();

  const procedimento = await resolveProcedimento(tenantId, procedureId ?? null);
  const duracao = procedimento?.duration_min ?? 30;

  let queryProviders = db
    .from("providers")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (providerId) queryProviders = queryProviders.eq("id", providerId);

  const [{ data: providers }, { data: vinculos }] = await Promise.all([
    queryProviders.returns<Pick<Provider, "id" | "name">[]>(),
    db
      .from("provider_procedures")
      .select("provider_id, procedure_id")
      .eq("tenant_id", tenantId)
      .returns<{ provider_id: string; procedure_id: string }[]>(),
  ]);

  const elegiveis = (providers ?? []).filter((p) => {
    if (!procedimento) return true;
    const meus = (vinculos ?? []).filter((v) => v.provider_id === p.id);
    return meus.length === 0 || meus.some((v) => v.procedure_id === procedimento.id);
  });
  if (elegiveis.length === 0) return [];

  const opcoes: OpcaoDeHorario[] = [];

  for (let i = 0; i < dias && opcoes.length < limite; i++) {
    const dateISO = somarDias(deISO, i);

    const porProvider = await Promise.all(
      elegiveis.map(async (p) => ({
        provider: p,
        livres: await horariosDisponiveis({
          tenantId,
          dateISO,
          providerId: p.id,
          duracao,
          timeZone,
          agora,
        }),
      })),
    );

    for (const { provider, livres } of porProvider) {
      // Espalha as opções do dia (primeiro horário, meio da agenda…) em vez de
      // oferecer 11:00 e 11:15, que na prática é uma opção só.
      const espacados =
        livres.length <= porDia
          ? livres
          : Array.from(
              { length: porDia },
              (_, k) => livres[Math.round((k * (livres.length - 1)) / (porDia - 1 || 1))],
            );

      for (const time of espacados) {
        if (opcoes.length >= limite) break;
        opcoes.push({
          dateISO,
          time,
          providerId: provider.id,
          providerName: provider.name,
          procedureId: procedimento?.id ?? null,
          procedureName: procedimento?.name ?? null,
          duracao,
        });
      }
    }
  }

  return opcoes;
}

// ---------- Criação / alteração ----------

interface DadosAgendamento {
  userId: string;
  providerId: string;
  procedureId: string | null;
  dateISO: string;
  time: string;
  notes: string | null;
  duracao?: number;
  titulo?: string;
}

function leDadosDoForm(formData: FormData): DadosAgendamento {
  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  return {
    userId: String(formData.get("user_id") ?? ""),
    providerId: String(formData.get("provider_id") ?? ""),
    procedureId: texto("procedure_id"),
    dateISO: String(formData.get("date") ?? ""),
    time: String(formData.get("time") ?? ""),
    notes: texto("notes"),
    titulo: texto("title") ?? undefined,
  };
}

async function resolveProcedimento(
  tenantId: string,
  procedureId: string | null,
): Promise<Procedure | null> {
  if (!procedureId) return null;
  const db = createAdminClient();
  const { data } = await db
    .from("procedures")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", procedureId)
    .maybeSingle<Procedure>();
  return data ?? null;
}

async function profissionalValido(
  tenantId: string,
  providerId: string,
): Promise<Provider | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("providers")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", providerId)
    .maybeSingle<Provider>();
  return data ?? null;
}

// A constraint appointments_no_overlap é a garantia real contra dois
// agendamentos no mesmo horário; aqui só traduzimos a violação.
function mensagemDeConflito(msg: string): string {
  return /exclusion constraint|appointments_no_overlap/i.test(msg)
    ? "Esse horário acabou de ser ocupado. Escolha outro."
    : traduzirErro(msg);
}

export interface ResultadoAgendamento {
  error?: string;
  appointmentId?: string;
}

/**
 * Cria um agendamento validando o horário de ponta a ponta: profissional do
 * tenant, procedimento do tenant, horário dentro da agenda de trabalho e livre.
 */
export async function createAppointmentValidado(
  tenantId: string,
  formData: FormData,
  {
    timeZone = DEFAULT_TIMEZONE,
    createdBy = null,
    forcarUserId,
  }: { timeZone?: string; createdBy?: string | null; forcarUserId?: string } = {},
): Promise<ResultadoAgendamento> {
  const dados = leDadosDoForm(formData);
  const userId = forcarUserId ?? dados.userId;

  if (!userId) return { error: "Selecione o cliente." };
  if (!dados.providerId) return { error: "Selecione o profissional." };
  if (!dados.dateISO) return { error: "Escolha a data." };
  if (!dados.time) return { error: "Escolha o horário." };

  const provider = await profissionalValido(tenantId, dados.providerId);
  if (!provider) return { error: "Profissional não encontrado." };
  if (!provider.is_active) return { error: "Esse profissional está inativo." };

  const procedimento = await resolveProcedimento(tenantId, dados.procedureId);
  if (dados.procedureId && !procedimento) {
    return { error: "Procedimento não encontrado." };
  }

  const duracao = procedimento?.duration_min ?? 30;
  const titulo = dados.titulo ?? procedimento?.name ?? "Atendimento";

  const livres = await horariosDisponiveis({
    tenantId,
    dateISO: dados.dateISO,
    providerId: dados.providerId,
    duracao,
    timeZone,
  });
  if (!livres.includes(dados.time)) {
    return {
      error:
        livres.length === 0
          ? "Esse profissional não tem horário disponível nessa data."
          : "Esse horário não está disponível. Escolha um dos horários livres.",
    };
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("appointments")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      provider_id: dados.providerId,
      procedure_id: procedimento?.id ?? null,
      title: titulo,
      scheduled_at: zonedToUtc(dados.dateISO, dados.time, timeZone).toISOString(),
      duration_min: duracao,
      notes: dados.notes,
      status: "scheduled",
      created_by: createdBy,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) return { error: mensagemDeConflito(error.message) };
  return { appointmentId: data?.id };
}

/** Remarca (nova data/hora e, se quiser, outro profissional). */
export async function rescheduleAppointment(
  tenantId: string,
  appointmentId: string,
  formData: FormData,
  { timeZone = DEFAULT_TIMEZONE }: { timeZone?: string } = {},
): Promise<{ error?: string }> {
  const dateISO = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "");
  const providerIdForm = String(formData.get("provider_id") ?? "").trim();

  if (!dateISO || !time) return { error: "Escolha a nova data e horário." };

  const atual = await getAppointment(tenantId, appointmentId);
  if (!atual) return { error: "Agendamento não encontrado." };
  if (atual.status !== "scheduled") {
    return { error: "Só é possível remarcar um agendamento que está agendado." };
  }

  const providerId = providerIdForm || atual.provider_id;
  if (!providerId) return { error: "Selecione o profissional." };

  const livres = await horariosDisponiveis({
    tenantId,
    dateISO,
    providerId,
    duracao: atual.duration_min,
    timeZone,
    ignorarAppointmentId: appointmentId,
  });
  if (!livres.includes(time)) {
    return { error: "Esse horário não está disponível. Escolha um dos horários livres." };
  }

  const db = createAdminClient();
  const { error } = await db
    .from("appointments")
    .update({
      provider_id: providerId,
      scheduled_at: zonedToUtc(dateISO, time, timeZone).toISOString(),
    })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId);

  return { error: error ? mensagemDeConflito(error.message) : undefined };
}

export async function setAppointmentStatus(
  tenantId: string,
  appointmentId: string,
  status: AppointmentStatus,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("appointments")
    .update({ status })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function removeAppointment(
  tenantId: string,
  appointmentId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("appointments")
    .delete()
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

/** Cancelamento pelo próprio cliente — só o que é dele e ainda vai acontecer. */
export async function cancelAppointmentAsClient(
  tenantId: string,
  userId: string,
  appointmentId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { data } = await db
    .from("appointments")
    .select("id, scheduled_at, status")
    .eq("tenant_id", tenantId)
    .eq("id", appointmentId)
    .eq("user_id", userId)
    .maybeSingle<Pick<Appointment, "id" | "scheduled_at" | "status">>();

  if (!data) return { error: "Agendamento não encontrado." };
  if (data.status !== "scheduled") return { error: "Esse agendamento já foi encerrado." };
  if (new Date(data.scheduled_at) < new Date()) {
    return { error: "Esse horário já passou. Fale com a recepção." };
  }

  const { error } = await db
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

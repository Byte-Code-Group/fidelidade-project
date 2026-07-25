import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { traduzirErro } from "@/lib/error-messages";
import { minutosDoHorario } from "@/lib/scheduling";
import type { Provider, ProviderSchedule, ScheduleException } from "@/lib/types";

// Profissionais que atendem (doutor, dentista, cabeleireiro… conforme o
// segmento), seus horários de trabalho recorrentes e as folgas.

function camposDoProfissional(formData: FormData) {
  const texto = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const cor = String(formData.get("color") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    specialty: texto("specialty"),
    color: /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : "#2563EB",
    is_active: formData.get("is_active") === "on",
  };
}

export async function insertProvider(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const campos = camposDoProfissional(formData);
  if (!campos.name) return { error: "Informe o nome do profissional." };

  const db = createAdminClient();
  const { count } = await db
    .from("providers")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  const { error } = await db
    .from("providers")
    .insert({ tenant_id: tenantId, ...campos, display_order: count ?? 0 });
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function applyProviderUpdate(
  tenantId: string,
  providerId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const campos = camposDoProfissional(formData);
  if (!campos.name) return { error: "Informe o nome do profissional." };

  const db = createAdminClient();
  const { error } = await db
    .from("providers")
    .update(campos)
    .eq("id", providerId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function removeProvider(
  tenantId: string,
  providerId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();

  // Agendamento futuro perderia o profissional (FK on delete set null) e
  // ficaria órfão na agenda — melhor barrar e pedir para cancelar antes.
  const { count } = await db
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("provider_id", providerId)
    .eq("status", "scheduled")
    .gte("scheduled_at", new Date().toISOString());

  if (count && count > 0) {
    return {
      error: `Este profissional tem ${count} agendamento(s) futuro(s). Cancele ou remarque antes de excluir.`,
    };
  }

  const { error } = await db
    .from("providers")
    .delete()
    .eq("id", providerId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function reorderProviders(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("providers")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error ? traduzirErro(failed.error.message) : undefined };
}

// ---------- Horário de trabalho ----------

export async function insertProviderSchedule(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const providerId = String(formData.get("provider_id") ?? "");
  const weekday = Number(formData.get("weekday"));
  const start = String(formData.get("start_time") ?? "");
  const end = String(formData.get("end_time") ?? "");

  if (!providerId) return { error: "Selecione o profissional." };
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return { error: "Selecione o dia da semana." };
  }
  if (!start || !end) return { error: "Informe o horário de início e de fim." };
  if (minutosDoHorario(end) <= minutosDoHorario(start)) {
    return { error: "O horário de fim precisa ser depois do início." };
  }

  const db = createAdminClient();

  // Sobreposição no mesmo dia não faz sentido: os blocos existem justamente
  // para separar turnos (manhã/tarde).
  const { data: existentes } = await db
    .from("provider_schedules")
    .select("start_time, end_time")
    .eq("tenant_id", tenantId)
    .eq("provider_id", providerId)
    .eq("weekday", weekday)
    .returns<{ start_time: string; end_time: string }[]>();

  const novoInicio = minutosDoHorario(start);
  const novoFim = minutosDoHorario(end);
  const colide = (existentes ?? []).some(
    (b) =>
      novoInicio < minutosDoHorario(b.end_time) &&
      minutosDoHorario(b.start_time) < novoFim,
  );
  if (colide) {
    return { error: "Esse intervalo se sobrepõe a outro horário já cadastrado nesse dia." };
  }

  const { error } = await db.from("provider_schedules").insert({
    tenant_id: tenantId,
    provider_id: providerId,
    weekday,
    start_time: start,
    end_time: end,
  });
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function removeProviderSchedule(
  tenantId: string,
  scheduleId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("provider_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

/**
 * Copia os horários de um dia para os outros dias informados — atalho para o
 * caso comum de "segunda a sexta igual".
 */
export async function copyProviderScheduleDay(
  tenantId: string,
  providerId: string,
  origem: number,
  destinos: number[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { data: blocos } = await db
    .from("provider_schedules")
    .select("start_time, end_time")
    .eq("tenant_id", tenantId)
    .eq("provider_id", providerId)
    .eq("weekday", origem)
    .returns<{ start_time: string; end_time: string }[]>();

  if (!blocos || blocos.length === 0) {
    return { error: "Esse dia não tem horário cadastrado para copiar." };
  }

  const dias = destinos.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6 && d !== origem);
  if (dias.length === 0) return { error: "Selecione para quais dias copiar." };

  const { error: delErr } = await db
    .from("provider_schedules")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("provider_id", providerId)
    .in("weekday", dias);
  if (delErr) return { error: traduzirErro(delErr.message) };

  const { error } = await db.from("provider_schedules").insert(
    dias.flatMap((weekday) =>
      blocos.map((b) => ({
        tenant_id: tenantId,
        provider_id: providerId,
        weekday,
        start_time: b.start_time,
        end_time: b.end_time,
      })),
    ),
  );
  return { error: error ? traduzirErro(error.message) : undefined };
}

// ---------- Folgas e bloqueios ----------

export async function insertScheduleException(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const providerRaw = String(formData.get("provider_id") ?? "");
  const date = String(formData.get("exception_date") ?? "");
  const inicio = String(formData.get("start_time") ?? "").trim();
  const fim = String(formData.get("end_time") ?? "").trim();
  const diaInteiro = formData.get("all_day") === "on" || (!inicio && !fim);

  if (!date) return { error: "Informe a data da folga." };
  if (!diaInteiro) {
    if (!inicio || !fim) return { error: "Informe o horário de início e de fim do bloqueio." };
    if (minutosDoHorario(fim) <= minutosDoHorario(inicio)) {
      return { error: "O horário de fim precisa ser depois do início." };
    }
  }

  const db = createAdminClient();
  const { error } = await db.from("schedule_exceptions").insert({
    tenant_id: tenantId,
    provider_id: providerRaw === "" || providerRaw === "all" ? null : providerRaw,
    exception_date: date,
    start_time: diaInteiro ? null : inicio,
    end_time: diaInteiro ? null : fim,
    reason: String(formData.get("reason") ?? "").trim() || null,
  });
  return { error: error ? traduzirErro(error.message) : undefined };
}

export async function removeScheduleException(
  tenantId: string,
  exceptionId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("schedule_exceptions")
    .delete()
    .eq("id", exceptionId)
    .eq("tenant_id", tenantId);
  return { error: error ? traduzirErro(error.message) : undefined };
}

// ---------- Consultas ----------

export async function listProviders(
  tenantId: string,
  { somenteAtivos = false }: { somenteAtivos?: boolean } = {},
): Promise<Provider[]> {
  const db = createAdminClient();
  let query = db
    .from("providers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true });
  if (somenteAtivos) query = query.eq("is_active", true);

  const { data } = await query.returns<Provider[]>();
  return data ?? [];
}

export async function listProviderSchedules(
  tenantId: string,
): Promise<ProviderSchedule[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("provider_schedules")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("weekday", { ascending: true })
    .order("start_time", { ascending: true })
    .returns<ProviderSchedule[]>();
  return data ?? [];
}

/** Folgas a partir de hoje (as antigas não interessam nas telas). */
export async function listScheduleExceptions(
  tenantId: string,
  desdeISO: string,
): Promise<ScheduleException[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("schedule_exceptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("exception_date", desdeISO)
    .order("exception_date", { ascending: true })
    .returns<ScheduleException[]>();
  return data ?? [];
}

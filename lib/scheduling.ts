// Regras de agenda — tudo puro, sem banco, para poder ser testado e usado
// tanto no server quanto no client.
//
// Convenção: horário de trabalho e folga são "hora de parede" no fuso do
// negócio (`time` no banco, "HH:MM" aqui); agendamento é instante
// (timestamptz / Date). A conversão entre os dois mundos passa sempre por
// zonedToUtc / partesNoFuso, nunca por new Date("...") solto.

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** Passo padrão da grade de horários, em minutos. */
export const DEFAULT_SLOT_STEP = 15;

export const WEEKDAY_LABELS = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** Intervalo em minutos desde a meia-noite local. */
export interface Bloco {
  start: number;
  end: number;
}

// ---------- horas como texto ----------

/** "09:30" → 570. Aceita "09:30:00" (formato `time` do Postgres). */
export function minutosDoHorario(time: string): number {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
}

/** 570 → "09:30". */
export function horarioDeMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ---------- fuso ----------

// Offset do fuso naquele instante, em ms (positivo = adiantado do UTC).
function offsetDoFuso(instante: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(instante)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return comoUtc - instante.getTime();
}

/**
 * "2026-07-30" + "09:00" no fuso do negócio → instante real.
 * Roda o ajuste duas vezes porque o offset depende do próprio instante
 * (mudança de horário de verão em fusos que ainda têm).
 */
export function zonedToUtc(
  dateISO: string,
  time: string,
  timeZone = DEFAULT_TIMEZONE,
): Date {
  const [ano, mes, dia] = dateISO.split("-").map(Number);
  const minutos = minutosDoHorario(time);
  const ingenuo = Date.UTC(ano, mes - 1, dia, 0, minutos);

  let ts = ingenuo - offsetDoFuso(new Date(ingenuo), timeZone);
  ts = ingenuo - offsetDoFuso(new Date(ts), timeZone);
  return new Date(ts);
}

export interface PartesNoFuso {
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  time: string;
  /** 0 = domingo … 6 = sábado */
  weekday: number;
  /** minutos desde a meia-noite local */
  minutos: number;
}

/** Instante → data/hora/dia da semana no fuso do negócio. */
export function partesNoFuso(
  instante: Date | string,
  timeZone = DEFAULT_TIMEZONE,
): PartesNoFuso {
  const d = typeof instante === "string" ? new Date(instante) : instante;
  const local = new Date(d.getTime() + offsetDoFuso(d, timeZone));

  const date = local.toISOString().slice(0, 10);
  const minutos = local.getUTCHours() * 60 + local.getUTCMinutes();
  return {
    date,
    time: horarioDeMinutos(minutos),
    weekday: local.getUTCDay(),
    minutos,
  };
}

/** Hoje no fuso do negócio, como "YYYY-MM-DD". */
export function hojeNoFuso(timeZone = DEFAULT_TIMEZONE, agora = new Date()): string {
  return partesNoFuso(agora, timeZone).date;
}

// ---------- datas como texto (sem depender de fuso) ----------

/** "2026-07-30" → 0 (domingo) … 6 (sábado). */
export function weekdayDaData(dateISO: string): number {
  const [ano, mes, dia] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

/** Soma dias a "YYYY-MM-DD" devolvendo "YYYY-MM-DD". */
export function somarDias(dateISO: string, dias: number): string {
  const [ano, mes, dia] = dateISO.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

/** Primeiro dia do mês de "YYYY-MM-DD" (ou "YYYY-MM"). */
export function inicioDoMes(mesOuData: string): string {
  return `${mesOuData.slice(0, 7)}-01`;
}

/** Mês seguinte no formato "YYYY-MM". */
export function mesSeguinte(mes: string): string {
  const [ano, m] = mes.slice(0, 7).split("-").map(Number);
  return m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
}

/** Mês anterior no formato "YYYY-MM". */
export function mesAnterior(mes: string): string {
  const [ano, m] = mes.slice(0, 7).split("-").map(Number);
  return m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, "0")}`;
}

/**
 * Grade do calendário mensal: sempre semanas completas (domingo→sábado),
 * então o mês nunca começa "no meio" de uma linha.
 */
export function gradeDoMes(mes: string): string[] {
  const primeiro = inicioDoMes(mes);
  const inicio = somarDias(primeiro, -weekdayDaData(primeiro));

  const ultimoDoMes = somarDias(inicioDoMes(mesSeguinte(mes)), -1);
  const fim = somarDias(ultimoDoMes, 6 - weekdayDaData(ultimoDoMes));

  const dias: string[] = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

// ---------- blocos de horário ----------

/** Une blocos que se sobrepõem ou se encostam, em ordem. */
export function normalizarBlocos(blocos: Bloco[]): Bloco[] {
  const ordenados = [...blocos]
    .filter((b) => b.end > b.start)
    .sort((a, b) => a.start - b.start);

  const saida: Bloco[] = [];
  for (const bloco of ordenados) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && bloco.start <= ultimo.end) {
      ultimo.end = Math.max(ultimo.end, bloco.end);
    } else {
      saida.push({ ...bloco });
    }
  }
  return saida;
}

/** Remove de `base` tudo que estiver coberto por `remover`. */
export function subtrairBlocos(base: Bloco[], remover: Bloco[]): Bloco[] {
  let atual = normalizarBlocos(base);

  for (const corte of normalizarBlocos(remover)) {
    const proximo: Bloco[] = [];
    for (const bloco of atual) {
      // sem sobreposição
      if (corte.end <= bloco.start || corte.start >= bloco.end) {
        proximo.push(bloco);
        continue;
      }
      if (corte.start > bloco.start) proximo.push({ start: bloco.start, end: corte.start });
      if (corte.end < bloco.end) proximo.push({ start: corte.end, end: bloco.end });
    }
    atual = proximo;
  }
  return atual;
}

/** Dois intervalos se sobrepõem? (fim exclusivo: 09:00–09:30 e 09:30–10:00 não) */
export function seSobrepoe(a: Bloco, b: Bloco): boolean {
  return a.start < b.end && b.start < a.end;
}

export interface SlotsLivresInput {
  /** Data avaliada, "YYYY-MM-DD" no fuso do negócio. */
  dateISO: string;
  /** Blocos de trabalho do dia (minutos locais). */
  trabalho: Bloco[];
  /** Folgas/bloqueios e agendamentos já ocupados (minutos locais). */
  ocupado: Bloco[];
  /** Duração do procedimento, em minutos. */
  duracao: number;
  /** Granularidade dos horários oferecidos. */
  passo?: number;
  /** Agora, para não oferecer horário que já passou. */
  agora?: Date;
  timeZone?: string;
  /** Antecedência mínima para marcar, em minutos. */
  antecedenciaMin?: number;
}

/**
 * Horários ("HH:MM") em que um atendimento de `duracao` caberia inteiro dentro
 * do horário de trabalho, sem encostar em nada ocupado.
 */
export function slotsLivres({
  dateISO,
  trabalho,
  ocupado,
  duracao,
  passo = DEFAULT_SLOT_STEP,
  agora = new Date(),
  timeZone = DEFAULT_TIMEZONE,
  antecedenciaMin = 0,
}: SlotsLivresInput): string[] {
  if (duracao <= 0) return [];

  const disponiveis = subtrairBlocos(trabalho, ocupado);

  const hoje = partesNoFuso(agora, timeZone);
  const minimo =
    dateISO === hoje.date ? hoje.minutos + antecedenciaMin : dateISO < hoje.date ? Infinity : -Infinity;

  const slots: string[] = [];
  for (const bloco of disponiveis) {
    // Alinha o primeiro horário do bloco ao passo (08:07 com passo 15 → 08:15).
    const primeiro = Math.ceil(bloco.start / passo) * passo;
    for (let inicio = primeiro; inicio + duracao <= bloco.end; inicio += passo) {
      if (inicio < minimo) continue;
      slots.push(horarioDeMinutos(inicio));
    }
  }
  return slots;
}

// ---------- formatação ----------

export function formatarHorario(
  instante: string | Date,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return new Date(instante).toLocaleTimeString("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarDataHora(
  instante: string | Date,
  timeZone = DEFAULT_TIMEZONE,
): string {
  return new Date(instante).toLocaleString("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "2026-07-30" → "quinta, 30 de julho de 2026". */
export function formatarDataLonga(dateISO: string): string {
  const [ano, mes, dia] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** "2026-07" → "julho de 2026". */
export function formatarMes(mes: string): string {
  const [ano, m] = mes.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(ano, m - 1, 1)).toLocaleDateString("pt-BR", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

export function formatarPreco(centavos: number | null): string | null {
  if (centavos === null) return null;
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatarDuracao(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}

// ---------- vínculo profissional × procedimento ----------

/**
 * Profissionais habilitados para um procedimento. Quem não tem vínculo nenhum
 * entra na lista (regra "sem vínculo = atende todos").
 */
export function providersDoProcedimento<T extends { id: string }>(
  providers: T[],
  vinculos: { provider_id: string; procedure_id: string }[],
  procedureId: string,
): T[] {
  const comVinculo = new Set(vinculos.map((v) => v.provider_id));
  const habilitados = new Set(
    vinculos.filter((v) => v.procedure_id === procedureId).map((v) => v.provider_id),
  );
  return providers.filter((p) => !comVinculo.has(p.id) || habilitados.has(p.id));
}

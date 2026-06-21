// Helpers de fidelidade: referência de período e cálculo de streak.
// Compartilhado entre o portal (leitura) e o futuro /api/checkin (escrita).

export type LoyaltyFrequency = "monthly" | "weekly";

// Identificador do período de um check-in.
//   monthly -> "2026-06"
//   weekly  -> "2026-W24" (semana ISO)
export function periodRef(date: Date, frequency: LoyaltyFrequency): string {
  const year = date.getUTCFullYear();
  if (frequency === "weekly") {
    return `${isoWeekYear(date)}-W${String(isoWeek(date)).padStart(2, "0")}`;
  }
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Período atual (referência "agora").
export function currentPeriodRef(frequency: LoyaltyFrequency): string {
  return periodRef(new Date(), frequency);
}

// Streak = nº de períodos consecutivos (terminando no atual ou no anterior)
// em que houve check-in. Lista de period_refs já existentes do usuário.
export function streakFromPeriods(
  periods: string[],
  frequency: LoyaltyFrequency,
): number {
  const seen = new Set(periods);
  let streak = 0;
  // Tolera não ter check-in ainda no período atual: começa a contagem a
  // partir do atual, mas só "quebra" depois do primeiro buraco.
  let cursor = new Date();
  let started = false;
  for (let i = 0; i < 520; i++) {
    const ref = periodRef(cursor, frequency);
    if (seen.has(ref)) {
      streak++;
      started = true;
    } else if (started) {
      break;
    } else if (i > 0) {
      // dois períodos sem check-in logo de cara → streak zerado
      break;
    }
    cursor = previousPeriod(cursor, frequency);
  }
  return streak;
}

function previousPeriod(date: Date, frequency: LoyaltyFrequency): Date {
  const d = new Date(date);
  if (frequency === "weekly") {
    d.setUTCDate(d.getUTCDate() - 7);
  } else {
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return d;
}

// Semana ISO-8601 (1–53).
function isoWeek(date: Date): number {
  const d = isoThursday(date);
  const firstThursday = isoThursday(new Date(Date.UTC(d.getUTCFullYear(), 0, 4)));
  const diff = d.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
}

// Ano "dono" da semana ISO (pode diferir do ano civil na virada).
function isoWeekYear(date: Date): number {
  return isoThursday(date).getUTCFullYear();
}

// Quinta-feira da semana ISO que contém `date`.
function isoThursday(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = d.getUTCDay() || 7; // domingo=7
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d;
}

// Limites de duração de sessão. Aplicados no middleware (fonte da verdade,
// ver lib/supabase/middleware.ts) e espelhados no client só para disparar o
// refresh da página quando o tempo estoura com a aba aberta
// (ver components/session-timeout.tsx).

/** Inatividade: sem nenhuma request/interação por esse tempo → desloga. */
export const IDLE_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3h

/** Duração máxima da sessão, contada do login, mesmo em uso contínuo. */
export const ABSOLUTE_TIMEOUT_MS = 10 * 60 * 60 * 1000; // 10h

/** `${session_id}.${timestamp do login}` — httpOnly. */
export const SESSION_START_COOKIE = "fz-session-start";

/** Timestamp da última request autenticada — httpOnly. */
export const LAST_ACTIVITY_COOKIE = "fz-last-activity";

/** Timestamp do login legível no browser (o watcher precisa dele). */
export const SESSION_START_PUBLIC_COOKIE = "fz-session-start-at";

/**
 * Validade dos cookies de rastreio. Tem que ser MUITO maior que os limites:
 * quem decide a expiração é a comparação de timestamps, e um cookie que
 * expira sozinho antes disso zera o contador em vez de deslogar (era o bug
 * de voltar ao site depois de 10h+ e continuar logado, já que o refresh
 * token do Supabase sobrevive bem mais que os cookies de rastreio).
 */
export const TRACKING_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export type SessionExpiryReason = "inatividade" | "duracao";

const horas = (ms: number) => Math.round(ms / 3_600_000);

export const SESSION_EXPIRY_MESSAGES: Record<SessionExpiryReason, string> = {
  inatividade: `Sua sessão foi encerrada após ${horas(IDLE_TIMEOUT_MS)} horas sem atividade. Entre novamente.`,
  duracao: `Sua sessão expirou após ${horas(ABSOLUTE_TIMEOUT_MS)} horas. Entre novamente.`,
};

/**
 * Decide se a sessão estourou. Pura de propósito — o middleware só lê
 * cookies e delega aqui (ver lib/supabase/middleware.ts).
 *
 * @param start         quando a sessão começou (ms)
 * @param lastActivity  última atividade registrada (ms), ou null se não há
 *   cookie — nesse caso vale o início da sessão, que é o último instante
 *   comprovado de atividade (sem cookie não existe prova de nada mais novo).
 */
export function decidirExpiracao({
  now,
  start,
  lastActivity,
}: {
  now: number;
  start: number;
  lastActivity: number | null;
}): SessionExpiryReason | null {
  if (now - start >= ABSOLUTE_TIMEOUT_MS) return "duracao";
  if (now - (lastActivity ?? start) >= IDLE_TIMEOUT_MS) return "inatividade";
  return null;
}

export function mensagemDeExpiracao(reason?: string | null): string | undefined {
  if (reason === "inatividade" || reason === "duracao") {
    return SESSION_EXPIRY_MESSAGES[reason];
  }
  return undefined;
}

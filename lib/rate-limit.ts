import "server-only";
import { headers } from "next/headers";

// Contador de tentativas por chave em janela fixa (força bruta em login, código
// de verificação, envio de e-mail).
// shortcut: memória do processo — vale para uma instância só (a VM roda uma) e
// zera no deploy. Com réplicas, mover para o banco ou Redis.
interface Janela {
  total: number;
  expiraEm: number;
}

const janelas = new Map<string, Janela>();

function atual(chave: string, agora: number): Janela | undefined {
  const j = janelas.get(chave);
  if (j && j.expiraEm <= agora) {
    janelas.delete(chave);
    return undefined;
  }
  return j;
}

/** Minutos até liberar, ou 0 se a chave ainda pode tentar. */
export function minutosBloqueado(chave: string, max: number, agora = Date.now()): number {
  const j = atual(chave, agora);
  return j && j.total >= max ? Math.max(1, Math.ceil((j.expiraEm - agora) / 60_000)) : 0;
}

/** Conta uma tentativa; a janela começa na primeira. */
export function registrarTentativa(chave: string, janelaMs: number, agora = Date.now()): void {
  const j = atual(chave, agora);
  if (j) j.total += 1;
  else janelas.set(chave, { total: 1, expiraEm: agora + janelaMs });
  if (janelas.size > 50_000) {
    for (const [k, v] of janelas) if (v.expiraEm <= agora) janelas.delete(k);
  }
}

export function limparTentativas(chave: string): void {
  janelas.delete(chave);
}

/**
 * IP de quem fez a request, pelo X-Forwarded-For do Caddy (ele descarta o
 * header vindo de cliente não confiável e grava o IP real). Sem proxy na frente
 * (dev local) não há IP confiável: devolve null e só o limite por conta vale.
 */
export async function ipDaRequest(): Promise<string | null> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",").at(-1)?.trim() || h.get("x-real-ip")?.trim();
  return ip || null;
}

export function mensagemDeBloqueio(minutos: number): string {
  return `Muitas tentativas. Tente novamente em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
}

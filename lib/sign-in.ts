import "server-only";
import { createClient } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/error-messages";
import {
  ipDaRequest,
  limparTentativas,
  mensagemDeBloqueio,
  minutosBloqueado,
  registrarTentativa,
} from "@/lib/rate-limit";

const JANELA_MS = 15 * 60 * 1000;
const MAX_POR_CONTA = 5;
const MAX_POR_IP = 20;

/**
 * Login por senha com limite de tentativas erradas por conta e por IP. O
 * GoTrue também limita, mas vê todo login vindo do IP do servidor do app.
 */
export async function entrarComSenha(emailBruto: string, password: string): Promise<{ error?: string }> {
  const email = emailBruto.trim().toLowerCase();
  if (!email || !password) return { error: "Informe e-mail e senha." };

  const ip = await ipDaRequest();
  const chaves = [`login:conta:${email}`, ...(ip ? [`login:ip:${ip}`] : [])];
  const bloqueio = Math.max(
    minutosBloqueado(chaves[0], MAX_POR_CONTA),
    ip ? minutosBloqueado(chaves[1], MAX_POR_IP) : 0,
  );
  if (bloqueio) return { error: mensagemDeBloqueio(bloqueio) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      chaves.forEach((c) => registrarTentativa(c, JANELA_MS));
    }
    return { error: traduzirErro(error.message) };
  }
  limparTentativas(chaves[0]);
  return {};
}

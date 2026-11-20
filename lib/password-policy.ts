import "server-only";
import { createHash } from "node:crypto";

export const SENHA_MIN = 8;
// bcrypt (usado pelo GoTrue) ignora o que passa de 72 bytes.
const SENHA_MAX = 72;

/**
 * Regras de senha (NIST SP 800-63B): tamanho mínimo, sem regra de composição,
 * e bloqueio de senha que já apareceu em vazamento. Devolve a mensagem de erro
 * ou null se a senha serve.
 */
export async function validarSenha(senha: string, email?: string): Promise<string | null> {
  if (senha.length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (Buffer.byteLength(senha) > SENHA_MAX) return `A senha pode ter no máximo ${SENHA_MAX} caracteres.`;
  const usuario = email?.split("@")[0]?.toLowerCase();
  if (email && (senha.toLowerCase() === email.toLowerCase() || senha.toLowerCase() === usuario)) {
    return "A senha não pode ser o seu e-mail.";
  }
  if (await senhaVazada(senha)) {
    return "Essa senha aparece em vazamentos de dados conhecidos. Escolha outra.";
  }
  return null;
}

// Have I Been Pwned por k-anonimato: só os 5 primeiros caracteres do SHA-1 saem
// daqui. Se o serviço não responder, não trava o cadastro (fail-open).
async function senhaVazada(senha: string): Promise<boolean> {
  const hash = createHash("sha1").update(senha).digest("hex").toUpperCase();
  const prefixo = hash.slice(0, 5);
  const sufixo = hash.slice(5);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    if (!res.ok) return false;
    const corpo = await res.text();
    return corpo.split("\n").some((linha) => {
      const [suf, total] = linha.trim().split(":");
      return suf === sufixo && Number(total) > 0;
    });
  } catch {
    return false;
  }
}

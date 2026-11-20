"use server";

import { redirect } from "next/navigation";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { traduzirErro } from "@/lib/error-messages";
import { validarSenha } from "@/lib/password-policy";
import { fatorTotp } from "@/lib/mfa";
import {
  limparTentativas,
  mensagemDeBloqueio,
  minutosBloqueado,
  registrarTentativa,
} from "@/lib/rate-limit";

// Actions de conta compartilhadas entre painel do dono, superadmin e portal:
// troca de senha e verificação em duas etapas (TOTP).

const CODIGO = /^\d{6}$/;
const MFA_MAX = 5;
const MFA_JANELA_MS = 15 * 60 * 1000;

/** Nova senha para quem está logado (inclui a sessão criada pelo link de recuperação). */
export async function atualizarSenha(password: string, confirm: string): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Link expirado ou inválido. Solicite um novo." };
  if (password !== confirm) return { error: "As senhas não coincidem." };
  const invalida = await validarSenha(password, user.email);
  if (invalida) return { error: invalida };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  return error ? { error: traduzirErro(error.message) } : {};
}

/** Começa a ativação: cria o fator (ainda não verificado) e devolve o QR code. */
export async function iniciarMfa(): Promise<{ factorId?: string; qrCode?: string; secret?: string; error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  if (fatorTotp(user)) return { error: "A verificação em duas etapas já está ativa." };

  const supabase = await createClient();
  // Tentativa anterior abandonada deixa fator não verificado, que bloqueia um novo.
  const { data: fatores } = await supabase.auth.mfa.listFactors();
  for (const f of fatores?.all ?? []) {
    if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Autenticador ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error || !data) return { error: traduzirErro(error?.message, "Não foi possível ativar agora.") };
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Confere o código do app autenticador. Serve para ativar e para entrar. */
export async function confirmarCodigoMfa(code: string, factorId?: string): Promise<{ error?: string }> {
  const user = await getAuthUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };

  const chave = `mfa:${user.id}`;
  const bloqueio = minutosBloqueado(chave, MFA_MAX);
  if (bloqueio) return { error: mensagemDeBloqueio(bloqueio) };

  const codigo = code.replace(/\s/g, "");
  if (!CODIGO.test(codigo)) return { error: "Digite os 6 números do aplicativo." };

  const id = factorId ?? fatorTotp(user)?.id;
  if (!id) return { error: "Verificação em duas etapas não está ativa nesta conta." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: id, code: codigo });
  if (error) {
    registrarTentativa(chave, MFA_JANELA_MS);
    return { error: /invalid|expired/i.test(error.message) ? "Código inválido ou expirado." : traduzirErro(error.message) };
  }
  limparTentativas(chave);
  return {};
}

/** Desativa: exige um código atual, para quem só tem a sessão não conseguir tirar. */
export async function desativarMfa(code: string): Promise<{ error?: string }> {
  const user = await getAuthUser();
  const fator = user && fatorTotp(user);
  if (!fator) return { error: "Verificação em duas etapas não está ativa." };

  const verificado = await confirmarCodigoMfa(code, fator.id);
  if (verificado.error) return verificado;

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId: fator.id });
  return error ? { error: traduzirErro(error.message) } : {};
}

/** Desiste do login com código pendente. */
export async function sairDaVerificacao(destino: string) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(destino);
}

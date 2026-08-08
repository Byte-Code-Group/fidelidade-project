import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { resetPasswordEmail } from "@/lib/emails/reset-password";

export interface EnviarLinkOptions {
  email: string;
  /** Origem do link — portal do tenant ou endereço da plataforma. */
  origin: string;
  /** Path pra onde mandar depois de validar o token (ex.: "/redefinir-senha"). */
  destino: string;
  /** Marca exibida no e-mail. Sem isso, é a própria Fideliza. */
  brandName?: string;
  primaryColor?: string;
}

export type EnviarLinkResultado =
  | { ok: true }
  | { ok: false; error: string }
  /** E-mail sem conta — quem chama responde como se tivesse enviado. */
  | { ok: false; naoEncontrado: true };

/**
 * Gera o link de recuperação e envia pelo Resend, com o template da marca.
 *
 * `generateLink` só cria o token, sem disparar mensagem — é o que permite não
 * usar o e-mail padrão da Supabase, que ignora o design do projeto.
 */
export async function enviarLinkDeRecuperacao({
  email,
  origin,
  destino,
  brandName,
  primaryColor,
}: EnviarLinkOptions): Promise<EnviarLinkResultado> {
  const db = createAdminClient();
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
  });

  if (error) {
    if (/user not found|not found/i.test(error.message ?? "")) {
      return { ok: false, naoEncontrado: true };
    }
    return { ok: false, error: error.message };
  }

  const hashedToken = data?.properties?.hashed_token;
  if (!hashedToken) return { ok: false, naoEncontrado: true };

  const resetLink =
    `${origin.replace(/\/$/, "")}/auth/recuperar` +
    `?token_hash=${encodeURIComponent(hashedToken)}` +
    `&next=${encodeURIComponent(destino)}`;

  const { subject, html } = resetPasswordEmail({
    resetLink,
    userName: data?.user?.user_metadata?.full_name as string | undefined,
    brandName,
    primaryColor,
  });

  const envio = await sendEmail({ to: email, subject, html });
  if (!envio.ok) return { ok: false, error: envio.error ?? "Falha no envio." };

  return { ok: true };
}

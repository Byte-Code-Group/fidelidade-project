import "server-only";
import { Resend } from "resend";

// Enquanto fideliza.com.br não estiver verificado em resend.com/domains, o
// remetente precisa ser o domínio de teste do Resend — qualquer outro volta
// com 403 (validation_error). Atenção: com onboarding@resend.dev o plano free
// só entrega no e-mail dono da conta Resend.
const FROM = process.env.EMAIL_FROM || "Fideliza <onboarding@resend.dev>";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  /** Mensagem crua do provedor — passar por `traduzirErro` antes de exibir. */
  error?: string;
}

// Devolve o resultado em vez de lançar: e-mail é efeito secundário na maioria
// dos fluxos (boas-vindas, resgate) e não deve derrubá-los. Quem depende do
// envio — recuperação de senha — checa o retorno.
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  if (!process.env.RESEND_API_KEY) {
    console.error("[email] RESEND_API_KEY ausente — envio ignorado");
    return { ok: false, error: "Envio de e-mail não configurado." };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (error) {
    console.error("[email]", error);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

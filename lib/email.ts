import "server-only";
import nodemailer from "nodemailer";

// OCI Email Delivery por SMTP (STARTTLS na 587). O remetente precisa ser um
// "Approved Sender" no console da Oracle — qualquer outro é recusado.
const FROM = process.env.EMAIL_FROM || "Fideliza <nao-responda@fidelidade.bytecodegroup.com.br>";

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

let transport: nodemailer.Transporter | null = null;

function getTransport() {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transport ??= nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transport;
}

// Devolve o resultado em vez de lançar: e-mail é efeito secundário na maioria
// dos fluxos (boas-vindas, resgate) e não deve derrubá-los. Quem depende do
// envio — recuperação de senha — checa o retorno.
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const smtp = getTransport();
  if (!smtp) {
    console.error("[email] SMTP_HOST/SMTP_USER/SMTP_PASS ausentes — envio ignorado");
    return { ok: false, error: "Envio de e-mail não configurado." };
  }

  try {
    await smtp.sendMail({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
    return { ok: true };
  } catch (err) {
    console.error("[email]", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

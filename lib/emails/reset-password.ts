export interface ResetPasswordEmailData {
  /** Link de uso único que abre a tela de nova senha. */
  resetLink: string;
  userName?: string;
  /** Tempo de validade exibido no corpo do e-mail. */
  validade?: string;
  /** Marca do remetente. No portal é o nome do negócio; senão, a Fideliza. */
  brandName?: string;
  primaryColor?: string;
}

// Azul da plataforma (blue-600 do Tailwind) — mesmo do painel e das telas de
// autenticação. Vale quando o e-mail sai da própria Fideliza; no portal de um
// negócio, a cor vem de tenant_settings.
const BRAND_COLOR = "#2563eb";

export function resetPasswordEmail(d: ResetPasswordEmailData): {
  subject: string;
  html: string;
} {
  const year = new Date().getFullYear();
  const validade = d.validade ?? "1 hora";
  const marca = d.brandName ?? "Fideliza";
  const BRAND = d.primaryColor || BRAND_COLOR;

  return {
    subject: `Redefinir sua senha · ${marca}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:560px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:${BRAND};padding:36px 40px;text-align:center">
            <p style="margin:0;color:rgba(255,255,255,.8);font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase">${marca}</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:26px;font-weight:700">Redefinir senha</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.6">
              ${d.userName ? `Olá, <strong>${d.userName}</strong>! ` : ""}Recebemos um pedido para redefinir a senha da sua conta.
              Clique no botão abaixo para escolher uma nova senha.
            </p>

            <div style="text-align:center;margin:32px 0">
              <a href="${d.resetLink}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:15px 36px;border-radius:10px">
                Criar nova senha
              </a>
            </div>

            <p style="margin:0 0 24px;font-size:13px;color:#777;line-height:1.6;text-align:center">
              O link é de uso único e expira em ${validade}.
            </p>

            <p style="margin:0 0 8px;font-size:12px;color:#999;line-height:1.6">
              Se o botão não funcionar, copie e cole este endereço no navegador:
            </p>
            <p style="margin:0;font-size:12px;color:${BRAND};word-break:break-all;line-height:1.6">
              ${d.resetLink}
            </p>

            <p style="margin:28px 0 0;padding:16px 20px;background:#f8f8f8;border-left:4px solid ${BRAND};border-radius:8px;font-size:13px;color:#666;line-height:1.6">
              <strong>Não foi você?</strong><br>Ignore este e-mail. Sua senha atual continua valendo e nada muda na sua conta.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #eee;text-align:center;background:#fafafa">
            <p style="margin:0;font-size:12px;color:#999">© ${year} ${marca}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

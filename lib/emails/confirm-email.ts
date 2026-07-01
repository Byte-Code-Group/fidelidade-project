export interface ConfirmEmailData {
  tenantName: string;
  primaryColor: string;
  confirmLink: string;
  userName?: string;
}

export function confirmEmailTemplate(d: ConfirmEmailData): { subject: string; html: string } {
  const year = new Date().getFullYear();
  return {
    subject: `Confirme seu e-mail em ${d.tenantName}`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
        <tr>
          <td style="background:${d.primaryColor};padding:48px 40px;text-align:center">
            <h1 style="margin:0;color:#fff;font-size:28px;font-weight:700">Bem-vindo!</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:16px">${d.tenantName}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:48px 40px">
            <p style="margin:0 0 24px;color:#333;font-size:16px;line-height:1.6">
              ${d.userName ? `Olá <strong>${d.userName}</strong>,` : ""}
              ${d.userName ? "<br><br>" : ""}Obrigado por se cadastrar! Confirme seu e-mail clicando no botão.
            </p>
            <div style="text-align:center;margin:36px 0">
              <a href="${d.confirmLink}" style="display:inline-block;background:${d.primaryColor};color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:8px">
                ✓ Confirmar E-mail
              </a>
            </div>
            <p style="margin:32px 0 0;padding:20px;background:#f9f9f9;border-left:4px solid ${d.primaryColor};border-radius:4px;font-size:13px;color:#666;line-height:1.6">
              <strong>Não reconhece esse cadastro?</strong><br>Ignore este e-mail. Seu endereço não será registrado sem sua confirmação.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;border-top:1px solid #eee;text-align:center;background:#fafafa">
            <p style="margin:0;font-size:12px;color:#999">© ${year} ${d.tenantName}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

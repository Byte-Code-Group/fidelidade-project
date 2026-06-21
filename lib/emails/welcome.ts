export interface WelcomeEmailData {
  tenantName: string;
  primaryColor: string;
  memberName: string;
  memberCode: string;
  portalUrl: string;
}

export function welcomeEmail(d: WelcomeEmailData): { subject: string; html: string } {
  return {
    subject: `Bem-vindo ao ${d.tenantName}! 🎉`,
    html: `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:system-ui,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 16px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;max-width:560px;width:100%">
        <!-- Header -->
        <tr>
          <td style="background:${d.primaryColor};padding:32px 40px;text-align:center">
            <p style="margin:0;color:#fff;font-size:13px;font-weight:600;letter-spacing:1px;text-transform:uppercase;opacity:.8">${d.tenantName}</p>
            <h1 style="margin:8px 0 0;color:#fff;font-size:26px;font-weight:700">Bem-vindo, ${d.memberName}!</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;color:#333;font-size:15px;line-height:1.6">
              Sua conta no programa de fidelidade <strong>${d.tenantName}</strong> foi criada com sucesso.
            </p>
            <!-- Carteirinha -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f8f8f8;border-radius:12px;padding:20px 24px;margin:24px 0">
              <tr>
                <td>
                  <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#999">
                    Código da carteirinha
                  </p>
                  <p style="margin:0;font-size:22px;font-weight:700;color:${d.primaryColor};letter-spacing:2px">
                    ${d.memberCode}
                  </p>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 28px;color:#555;font-size:14px;line-height:1.6">
              Acesse o portal para ver sua carteirinha, acumular pontos e resgatar recompensas.
            </p>
            <div style="text-align:center">
              <a href="${d.portalUrl}"
                style="display:inline-block;background:${d.primaryColor};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:999px">
                Acessar meu portal
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center">
            <p style="margin:0;font-size:12px;color:#aaa">
              Você recebeu este e-mail porque se cadastrou em <strong>${d.tenantName}</strong>.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  };
}

export interface RedemptionEmailData {
  tenantName: string;
  primaryColor: string;
  memberName: string;
  rewardName: string;
  pointsSpent: number;
  pointsRemaining: number;
  portalUrl: string;
}

export function redemptionEmail(d: RedemptionEmailData): { subject: string; html: string } {
  return {
    subject: `Resgate confirmado: ${d.rewardName} 🎁`,
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
            <h1 style="margin:8px 0 0;color:#fff;font-size:26px;font-weight:700">Resgate confirmado! 🎁</h1>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 24px;color:#333;font-size:15px;line-height:1.6">
              Olá, <strong>${d.memberName}</strong>! Seu resgate foi registrado com sucesso.
              Nossa equipe entrará em contato para a entrega.
            </p>
            <!-- Resumo do resgate -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f8f8f8;border-radius:12px;padding:20px 24px;margin:0 0 24px">
              <tr>
                <td style="padding-bottom:12px;border-bottom:1px solid #eee">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#999">Recompensa</p>
                  <p style="margin:0;font-size:17px;font-weight:700;color:#111">${d.rewardName}</p>
                </td>
              </tr>
              <tr>
                <td style="padding-top:12px">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="font-size:13px;color:#555">Pontos utilizados</td>
                      <td align="right" style="font-size:13px;font-weight:600;color:${d.primaryColor}">−${d.pointsSpent} pts</td>
                    </tr>
                    <tr>
                      <td style="font-size:13px;color:#555;padding-top:4px">Saldo restante</td>
                      <td align="right" style="font-size:13px;font-weight:600;color:#333;padding-top:4px">${d.pointsRemaining} pts</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <div style="text-align:center">
              <a href="${d.portalUrl}/loja"
                style="display:inline-block;background:${d.primaryColor};color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 32px;border-radius:999px">
                Ver minha loja
              </a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f0f0f0;text-align:center">
            <p style="margin:0;font-size:12px;color:#aaa">
              Você recebeu este e-mail porque é membro de <strong>${d.tenantName}</strong>.
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

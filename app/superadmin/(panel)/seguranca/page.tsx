import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MfaSettings } from "@/components/mfa-settings";
import { requirePlatformAdmin } from "@/lib/superadmin";
import { fatorTotp } from "@/lib/mfa";

export default async function SegurancaAdminPage() {
  const user = await requirePlatformAdmin();
  return (
    <div>
      <PageHeader
        icon="lock"
        title="Segurança"
        subtitle="Conta de administrador da plataforma: recomendamos manter a verificação em duas etapas ativa."
      />
      <Card>
        <CardContent>
          <MfaSettings ativo={!!fatorTotp(user)} />
        </CardContent>
      </Card>
    </div>
  );
}

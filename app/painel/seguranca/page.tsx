import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { MfaSettings } from "@/components/mfa-settings";
import { requireTenantOwner } from "@/lib/owner";
import { fatorTotp } from "@/lib/mfa";

export default async function SegurancaPage() {
  const { user } = await requireTenantOwner();
  return (
    <div>
      <PageHeader icon="lock" title="Segurança" subtitle={`Proteção de acesso da conta ${user.email ?? ""}.`} />
      <Card>
        <CardContent>
          <MfaSettings ativo={!!fatorTotp(user)} />
        </CardContent>
      </Card>
    </div>
  );
}

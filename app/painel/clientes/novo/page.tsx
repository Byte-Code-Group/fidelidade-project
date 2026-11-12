import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { ClientFields } from "@/components/profile-field-inputs";
import { ClientFormShell } from "@/components/client-crud";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileField } from "@/lib/types";
import { ownerCreateClient } from "../../actions";

export default async function NewClientPage() {
  const { tenantId } = await requireTenantOwner();
  const { data: fields } = await createAdminClient()
    .from("profile_fields")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .returns<ProfileField[]>();

  return (
    <div className="space-y-4">
      <Link href="/painel/clientes" className="inline-flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100">
        <Icon name="chevronLeft" className="h-4 w-4" />
        Clientes
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Novo cliente</h1>
        <p className="mt-1 text-sm text-gray-500">
          A carteirinha é criada na hora. Para entrar no portal, o cliente usa &ldquo;Esqueci minha senha&rdquo; com este e-mail.
        </p>
      </div>
      <Card>
        <CardContent>
          <ClientFormShell action={ownerCreateClient} submitLabel="Cadastrar cliente">
            <ClientFields fields={fields ?? []} values={new Map()} />
          </ClientFormShell>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/icons";
import { ClientFields } from "@/components/profile-field-inputs";
import { ClientFormShell } from "@/components/client-crud";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ProfileField } from "@/lib/types";
import { ownerUpdateClient } from "../../../actions";

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();

  const [{ data: client }, { data: fields }, { data: values }] = await Promise.all([
    db
      .from("users")
      .select("full_name, email, phone")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .eq("role", "client")
      .maybeSingle<{ full_name: string | null; email: string | null; phone: string | null }>(),
    db
      .from("profile_fields")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("display_order", { ascending: true })
      .returns<ProfileField[]>(),
    db
      .from("profile_field_values")
      .select("field_id, value")
      .eq("tenant_id", tenantId)
      .eq("user_id", id)
      .returns<{ field_id: string; value: string | null }[]>(),
  ]);
  if (!client) notFound();

  return (
    <div className="space-y-4">
      <Link href={`/painel/clientes/${id}`} className="inline-flex items-center gap-1.5 text-sm opacity-60 hover:opacity-100">
        <Icon name="chevronLeft" className="h-4 w-4" />
        {client.full_name ?? "Cliente"}
      </Link>
      <h1 className="text-2xl font-bold">Editar cliente</h1>
      <Card>
        <CardContent>
          <ClientFormShell action={ownerUpdateClient.bind(null, id)} submitLabel="Salvar alterações">
            <ClientFields
              fields={fields ?? []}
              values={new Map((values ?? []).map((v) => [v.field_id, v.value]))}
              client={client}
            />
          </ClientFormShell>
        </CardContent>
      </Card>
    </div>
  );
}

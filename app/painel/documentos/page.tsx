import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentTemplatesList } from "@/components/document-templates-list";
import { FIELD_REGEX } from "@/lib/docx-mapping";
import type { DocumentTemplate } from "@/lib/types";
import { ownerCreateDocumentTemplate, ownerReorderDocumentTemplates } from "../actions";

export default async function OwnerDocumentTemplatesPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: templates } = await db
    .from("document_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .returns<DocumentTemplate[]>();

  const rows = (templates ?? []).map((t) => ({
    ...t,
    fieldCount: new Set([...t.content.matchAll(FIELD_REGEX)].map((m) => m[1])).size,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Documentos</h1>
        <p className="mt-1 max-w-prose text-sm opacity-60">
          Modelos que a IA preenche com os dados do cliente: contrato, atestado, termo. Envie o .docx, marque
          onde entra cada dado e gere o documento pela ficha do cliente.
        </p>
      </div>

      <DocumentTemplatesList
        templates={rows}
        createAction={ownerCreateDocumentTemplate}
        reorderAction={ownerReorderDocumentTemplates}
      />
    </div>
  );
}

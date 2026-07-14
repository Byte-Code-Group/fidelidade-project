import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { DocumentTemplatesList } from "@/components/document-templates-list";
import type { DocumentTemplate } from "@/lib/types";
import {
  ownerCreateDocumentTemplate,
  ownerUpdateDocumentTemplate,
  ownerDeleteDocumentTemplate,
  ownerReorderDocumentTemplates,
} from "../actions";

export default async function OwnerDocumentTemplatesPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const { data: templates } = await db
    .from("document_templates")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .returns<DocumentTemplate[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Modelos de documento que a IA usa pra gerar documentos pro cliente
          (contrato, atestado, termo...). Arraste pelo ⠿ pra reordenar.
        </p>
      </div>

      <DocumentTemplatesList
        templates={templates ?? []}
        createAction={ownerCreateDocumentTemplate}
        updateAction={ownerUpdateDocumentTemplate}
        deleteAction={ownerDeleteDocumentTemplate}
        reorderAction={ownerReorderDocumentTemplates}
      />
    </div>
  );
}

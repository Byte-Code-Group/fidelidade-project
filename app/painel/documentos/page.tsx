import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, signedUrl } from "@/lib/storage";
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

  // Bucket privado: o anexo do modelo é um path, precisa de signed URL.
  const templateRows = await Promise.all(
    (templates ?? []).map(async (t) => ({
      ...t,
      file_url: t.file_url
        ? await signedUrl(BUCKETS.documentTemplates, t.file_url)
        : null,
    })),
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="mt-1 text-sm text-gray-500">
          Modelos de documento que a IA usa pra gerar documentos pro cliente
          (contrato, atestado, termo...). Arraste pelo ⠿ pra reordenar.
          Num .docx com campos como {"{{ nome_cliente }}"}, a IA só preenche os
          campos e mantém o layout; gere pelo cliente, na aba Documentos.
        </p>
      </div>

      <DocumentTemplatesList
        templates={templateRows}
        createAction={ownerCreateDocumentTemplate}
        updateAction={ownerUpdateDocumentTemplate}
        deleteAction={ownerDeleteDocumentTemplate}
        reorderAction={ownerReorderDocumentTemplates}
      />
    </div>
  );
}

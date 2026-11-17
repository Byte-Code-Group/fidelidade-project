import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, signedUrl } from "@/lib/storage";
import { documentFieldGroups } from "@/lib/document-fields";
import { DocxMapper } from "@/components/docx-mapper";
import { DocumentTemplateEditor } from "@/components/document-templates-list";
import { Icon } from "@/components/icons";
import type { DocumentTemplate } from "@/lib/types";
import { ownerUpdateDocumentTemplate, ownerDeleteDocumentTemplate } from "../../actions";

export default async function DocumentTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();
  const [{ data: template }, { data: fields }] = await Promise.all([
    db
      .from("document_templates")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .maybeSingle<DocumentTemplate>(),
    db.from("profile_fields").select("label").eq("tenant_id", tenantId).order("display_order"),
  ]);
  if (!template) notFound();

  const fileUrl = template.file_url ? await signedUrl(BUCKETS.documentTemplates, template.file_url) : null;
  const isDocx = !!fileUrl && !!template.file_name?.toLowerCase().endsWith(".docx");

  return (
    <div className="space-y-4">
      <Link
        href="/painel/documentos"
        className="inline-flex items-center gap-1 text-sm opacity-60 transition hover:opacity-100"
      >
        <Icon name="chevronLeft" className="h-4 w-4" />
        Documentos
      </Link>

      {isDocx ? (
        <DocxMapper
          // key: depois de salvar, o arquivo novo tem outra URL → recomeça do zero
          key={template.file_url}
          templateId={template.id}
          name={template.name}
          fileName={template.file_name!}
          fileUrl={fileUrl}
          groups={documentFieldGroups((fields ?? []).map((f) => f.label))}
          updateAction={ownerUpdateDocumentTemplate}
        />
      ) : (
        <DocumentTemplateEditor
          template={{ ...template, file_url: fileUrl }}
          updateAction={ownerUpdateDocumentTemplate}
        />
      )}

      <DeleteTemplate templateId={template.id} />
    </div>
  );
}

function DeleteTemplate({ templateId }: { templateId: string }) {
  async function remove() {
    "use server";
    const { error } = await ownerDeleteDocumentTemplate(templateId);
    if (error) throw new Error(error);
    redirect("/painel/documentos");
  }
  return (
    <form action={remove} className="pt-4">
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Excluir modelo
      </button>
    </form>
  );
}

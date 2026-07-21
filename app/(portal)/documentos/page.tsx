import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import { BUCKETS, signedUrl } from "@/lib/storage";
import type { Document } from "@/lib/types";
import { DocumentTabs } from "./document-tabs";

export default async function DocumentosPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();

  const supabase = await createClient();
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { data: rawDocs } = await supabase
    .from("documents")
    .select("id, category, title, file_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<
      Pick<Document, "id" | "category" | "title" | "file_url" | "created_at">[]
    >();

  // Bucket privado: cada path vira uma signed URL temporária.
  const documents = await Promise.all(
    (rawDocs ?? []).map(async (doc) => ({
      ...doc,
      file_url: await signedUrl(BUCKETS.documents, doc.file_url),
    })),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documentos"
        subtitle="Acesse seus arquivos, termos e receituários."
      />
      <DocumentTabs documents={documents} />
    </div>
  );
}

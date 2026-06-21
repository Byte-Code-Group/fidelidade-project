import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentTenant } from "@/lib/tenant";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Document } from "@/lib/types";
import { DocumentTabs } from "./document-tabs";

const SIGNED_URL_TTL = 60 * 60; // 1 hora

export default async function DocumentosPage() {
  const ctx = await getCurrentTenant();
  if (!ctx) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rawDocs } = await supabase
    .from("documents")
    .select("id, category, title, file_url, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<
      Pick<Document, "id" | "category" | "title" | "file_url" | "created_at">[]
    >();

  // Para paths do Storage (sem protocolo) gera signed URL via service role.
  // O bucket é privado — service role bypassa RLS.
  const db = createAdminClient();
  const documents = await Promise.all(
    (rawDocs ?? []).map(async (doc) => {
      if (doc.file_url.startsWith("http")) return doc;
      const { data } = await db.storage
        .from("documents")
        .createSignedUrl(doc.file_url, SIGNED_URL_TTL);
      return { ...doc, file_url: data?.signedUrl ?? doc.file_url };
    }),
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

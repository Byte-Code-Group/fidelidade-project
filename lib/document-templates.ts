import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKETS, documentTemplatePath, pathBelongsTo } from "@/lib/storage";

const ALLOWED_EXTENSIONS = ["pdf", "docx"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Extrai o texto de um PDF ou DOCX anexado — é esse texto que vira o
// "content" que a IA lê pra entender o formato do documento.
async function extractTemplateText(
  file: File,
  ext: string,
): Promise<{ text?: string; error?: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return { text: result.text.trim() };
    } finally {
      await parser.destroy();
    }
  }

  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value.trim() };
}

// Bucket privado: guarda o PATH, não uma URL pública. Quem for exibir o
// arquivo gera uma signed URL na hora (ver signedUrl em lib/storage.ts).
async function uploadTemplateFile(
  tenantId: string,
  file: File,
  ext: string,
): Promise<{ url?: string; error?: string }> {
  const db = createAdminClient();
  const path = documentTemplatePath(tenantId, ext);
  const { error } = await db.storage
    .from(BUCKETS.documentTemplates)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) return { error: error.message };

  return { url: path };
}

// Se um arquivo PDF/DOCX foi anexado, extrai o texto (vira o content) e
// sobe o arquivo original pro storage. Sem arquivo novo → não mexe em nada.
async function processTemplateFile(tenantId: string, formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return {};

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return { error: "Formato não suportado (use PDF ou DOCX)." };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { error: "Arquivo muito grande (máx. 10MB)." };
  }

  const { text, error: extractError } = await extractTemplateText(file, ext);
  if (extractError) return { error: extractError };
  if (!text) return { error: "Não consegui extrair texto do arquivo." };

  const { url, error: uploadError } = await uploadTemplateFile(tenantId, file, ext);
  if (uploadError) return { error: uploadError };

  return { content: text, file_url: url, file_name: file.name };
}

export async function insertDocumentTemplate(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nome é obrigatório." };

  const fromFile = await processTemplateFile(tenantId, formData);
  if (fromFile.error) return { error: fromFile.error };

  const content = fromFile.content ?? String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Cole o conteúdo ou anexe um arquivo PDF/DOCX." };

  const db = createAdminClient();
  const { count } = await db
    .from("document_templates")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { error } = await db.from("document_templates").insert({
    tenant_id: tenantId,
    name,
    content,
    file_url: fromFile.file_url ?? null,
    file_name: fromFile.file_name ?? null,
    display_order: count ?? 0,
  });
  return { error: error?.message };
}

export async function applyDocumentTemplateUpdate(
  tenantId: string,
  templateId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Nome é obrigatório." };

  const fromFile = await processTemplateFile(tenantId, formData);
  if (fromFile.error) return { error: fromFile.error };

  const content = fromFile.content ?? String(formData.get("content") ?? "").trim();
  if (!content) return { error: "Cole o conteúdo ou anexe um arquivo PDF/DOCX." };

  const db = createAdminClient();

  // Troca de anexo: guarda o path antigo pra apagar depois do update.
  let previousFile: string | null = null;
  if (fromFile.file_url) {
    const { data: existing } = await db
      .from("document_templates")
      .select("file_url")
      .eq("id", templateId)
      .eq("tenant_id", tenantId)
      .maybeSingle<{ file_url: string | null }>();
    previousFile = existing?.file_url ?? null;
  }

  const { error } = await db
    .from("document_templates")
    .update({
      name,
      content,
      ...(fromFile.file_url ? { file_url: fromFile.file_url, file_name: fromFile.file_name } : {}),
    })
    .eq("id", templateId)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  if (previousFile && previousFile !== fromFile.file_url) {
    await removeTemplateFile(tenantId, previousFile);
  }
  return {};
}

export async function removeDocumentTemplate(
  tenantId: string,
  templateId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();

  // Lê o anexo antes de apagar a linha, senão o arquivo fica órfão no bucket.
  const { data: existing } = await db
    .from("document_templates")
    .select("file_url")
    .eq("id", templateId)
    .eq("tenant_id", tenantId)
    .maybeSingle<{ file_url: string | null }>();

  const { error } = await db
    .from("document_templates")
    .delete()
    .eq("id", templateId)
    .eq("tenant_id", tenantId);
  if (error) return { error: error.message };

  await removeTemplateFile(tenantId, existing?.file_url);
  return {};
}

// Remove o anexo do bucket, conferindo que o path é mesmo do tenant (barreira
// contra id manipulado). Paths antigos em formato de URL externa são ignorados.
async function removeTemplateFile(tenantId: string, path?: string | null) {
  if (!path || path.startsWith("http")) return;
  if (!pathBelongsTo(path, tenantId)) return;
  const db = createAdminClient();
  await db.storage.from(BUCKETS.documentTemplates).remove([path]);
}

// Reordena conforme a posição arrastada no painel do dono.
export async function reorderDocumentTemplates(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("document_templates")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error?.message };
}

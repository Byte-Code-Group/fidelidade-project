import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Convenção única de organização do Supabase Storage.
 *
 * O primeiro segmento do path é SEMPRE o tenant_id — é o que isola um negócio
 * do outro. Nos arquivos pessoais do cliente final, o segundo segmento é
 * SEMPRE o user_id, isolando um cliente do outro dentro do mesmo negócio.
 *
 *   branding/{tenant}/logo-{ts}.{ext}             público
 *   rewards/{tenant}/{ts}.{ext}                   público
 *   document-templates/{tenant}/{ts}.{ext}        privado
 *   documents/{tenant}/{user}/{origem}/{id}.{ext} privado
 *
 * As policies de storage.objects (migration 0032) impõem essa mesma estrutura
 * no banco. Montar path fora daqui quebra o isolamento — use estes helpers.
 */
export const BUCKETS = {
  branding: "branding",
  rewards: "rewards",
  documentTemplates: "document-templates",
  documents: "documents",
} as const;

export type DocumentOrigin = "upload" | "ia";

export function brandingPath(tenantId: string, ext: string): string {
  return `${tenantId}/logo-${Date.now()}.${ext}`;
}

export function rewardPath(tenantId: string, ext: string): string {
  return `${tenantId}/${Date.now()}.${ext}`;
}

export function documentTemplatePath(tenantId: string, ext: string): string {
  return `${tenantId}/${Date.now()}.${ext}`;
}

/**
 * Arquivo pessoal do cliente. Separa upload manual de documento gerado pela
 * IA em subpastas distintas — facilita auditar e permite limpar um sem tocar
 * no outro.
 */
export function documentPath(
  tenantId: string,
  userId: string,
  origin: DocumentOrigin,
  ext: string,
): string {
  return `${tenantId}/${userId}/${origin}/${crypto.randomUUID()}.${ext}`;
}

const SIGNED_URL_TTL = 60 * 60; // 1 hora

/**
 * URL temporária para um objeto de bucket privado. `stored` pode ser um path
 * interno ou uma URL externa já completa (documentos antigos apontam para
 * links de fora) — no segundo caso é devolvido como está.
 */
export async function signedUrl(
  bucket: string,
  stored: string,
): Promise<string> {
  if (stored.startsWith("http")) return stored;
  const db = createAdminClient();
  const { data } = await db.storage
    .from(bucket)
    .createSignedUrl(stored, SIGNED_URL_TTL);
  return data?.signedUrl ?? stored;
}

/**
 * Confere que um path pertence mesmo ao tenant (e, quando informado, ao
 * cliente) antes de ler ou apagar. Barreira contra path traversal vindo de
 * um id manipulado.
 */
export function pathBelongsTo(
  path: string,
  tenantId: string,
  userId?: string,
): boolean {
  if (path.includes("..")) return false;
  const parts = path.split("/");
  if (parts[0] !== tenantId) return false;
  if (userId && parts[1] !== userId) return false;
  return true;
}

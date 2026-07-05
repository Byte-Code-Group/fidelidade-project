import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

function rewardFields(formData: FormData) {
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const stockRaw = String(formData.get("stock") ?? "").trim();
  return {
    name: String(formData.get("name") ?? "").trim(),
    description: text("description"),
    points_cost: Number(formData.get("points_cost") ?? 0),
    stock: stockRaw === "" ? null : Number(stockRaw),
    is_active: formData.get("is_active") === "on",
  };
}

// Faz upload da imagem (se enviada) para o bucket 'rewards' e retorna a URL
// pública. Sem arquivo novo → retorna undefined (mantém a imagem atual).
async function uploadRewardImage(
  tenantId: string,
  formData: FormData,
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return {};

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { error: "Formato não suportado (use PNG, JPG, WEBP ou GIF)." };
  }
  if (file.size > MAX_IMAGE_SIZE) {
    return { error: "Imagem muito grande (máx. 2MB)." };
  }

  const db = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${tenantId}/${Date.now()}.${ext}`;

  const { error: upErr } = await db.storage
    .from("rewards")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) return { error: upErr.message };

  const { data: pub } = db.storage.from("rewards").getPublicUrl(path);
  return { url: pub.publicUrl };
}

export async function insertReward(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const fields = rewardFields(formData);
  if (!fields.name) return { error: "Nome é obrigatório." };

  const { url: image_url, error: imageError } = await uploadRewardImage(tenantId, formData);
  if (imageError) return { error: imageError };

  const db = createAdminClient();
  const { count } = await db
    .from("rewards")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { error } = await db
    .from("rewards")
    .insert({ tenant_id: tenantId, ...fields, image_url: image_url ?? null, display_order: count ?? 0 });
  return { error: error?.message };
}

export async function applyRewardUpdate(
  tenantId: string,
  rewardId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const { url: image_url, error: imageError } = await uploadRewardImage(tenantId, formData);
  if (imageError) return { error: imageError };

  const db = createAdminClient();
  const { error } = await db
    .from("rewards")
    .update({ ...rewardFields(formData), ...(image_url ? { image_url } : {}) })
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

export async function removeReward(
  tenantId: string,
  rewardId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("rewards")
    .delete()
    .eq("id", rewardId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

// Reordena conforme a posição arrastada no painel do dono.
export async function reorderRewards(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("rewards")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error?.message };
}

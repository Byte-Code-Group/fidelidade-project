import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSocialKey } from "@/components/social-logos";
import type { MissionType } from "@/lib/types";

// O tipo determina o ícone (logo da rede social, ou genérico p/ "custom") —
// nunca é um valor livre escolhido à parte.
function missionType(formData: FormData): MissionType {
  const raw = String(formData.get("type") ?? "custom");
  return isSocialKey(raw) ? raw : "custom";
}

function missionFields(formData: FormData) {
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  const type = missionType(formData);
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: text("description"),
    icon: type === "custom" ? null : type,
    type,
    external_url: text("external_url"),
    points: Number(formData.get("points") ?? 0),
    requires_validation: formData.get("requires_validation") === "on",
    is_active: formData.get("is_active") === "on",
  };
}

export async function insertMission(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const fields = missionFields(formData);
  if (!fields.title) return { error: "Título é obrigatório." };
  const db = createAdminClient();
  const { count } = await db
    .from("missions")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  const { error } = await db
    .from("missions")
    .insert({ tenant_id: tenantId, ...fields, display_order: count ?? 0 });
  return { error: error?.message };
}

// Reordena conforme a posição arrastada no painel do dono.
export async function reorderMissions(
  tenantId: string,
  orderedIds: string[],
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from("missions")
        .update({ display_order: index })
        .eq("id", id)
        .eq("tenant_id", tenantId),
    ),
  );
  const failed = results.find((r) => r.error);
  return { error: failed?.error?.message };
}

export async function applyMissionUpdate(
  tenantId: string,
  missionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("missions")
    .update(missionFields(formData))
    .eq("id", missionId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

export async function removeMission(
  tenantId: string,
  missionId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("missions")
    .delete()
    .eq("id", missionId)
    .eq("tenant_id", tenantId);
  return { error: error?.message };
}

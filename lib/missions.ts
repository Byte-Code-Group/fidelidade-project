import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const SOCIAL_KEYS = ["instagram", "facebook", "youtube", "x"];

export function missionFields(formData: FormData) {
  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  // Rede social (se escolhida) vira o ícone → renderiza o logo no portal.
  const social = String(formData.get("social") ?? "");
  const icon = SOCIAL_KEYS.includes(social) ? social : text("icon");
  return {
    title: String(formData.get("title") ?? "").trim(),
    description: text("description"),
    icon,
    type: String(formData.get("type") ?? "custom"),
    external_url: text("external_url"),
    points: Number(formData.get("points") ?? 0),
    requires_validation: formData.get("requires_validation") === "on",
    is_active: formData.get("is_active") === "on",
    display_order: Number(formData.get("display_order") ?? 0),
  };
}

export async function insertMission(tenantId: string, formData: FormData) {
  const fields = missionFields(formData);
  if (!fields.title) return;
  const db = createAdminClient();
  await db.from("missions").insert({ tenant_id: tenantId, ...fields });
}

export async function applyMissionUpdate(
  tenantId: string,
  missionId: string,
  formData: FormData,
) {
  const db = createAdminClient();
  await db
    .from("missions")
    .update(missionFields(formData))
    .eq("id", missionId)
    .eq("tenant_id", tenantId);
}

export async function removeMission(tenantId: string, missionId: string) {
  const db = createAdminClient();
  await db
    .from("missions")
    .delete()
    .eq("id", missionId)
    .eq("tenant_id", tenantId);
}

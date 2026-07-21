import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { clampModulesToTemplate, MODULES } from "@/lib/segment-templates";
import { BUCKETS, brandingPath } from "@/lib/storage";

// Lógica de negócio pura (sem gate de auth) reaproveitada tanto pelo
// Super Admin (app/superadmin/actions.ts) quanto pelo painel do dono
// (app/painel/actions.ts) — cada chamador resolve o próprio gate antes.

export async function applyTenantSettingsUpdate(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const db = createAdminClient();

  // Módulos: checkboxes presentes no form viram true, mas SEMPRE limitados ao
  // teto do template do tenant — não dá pra ativar módulo que o template não tem.
  const { data: t } = await db
    .from("tenants")
    .select("segment_template")
    .eq("id", tenantId)
    .maybeSingle<{ segment_template: string }>();

  const desired = Object.fromEntries(
    MODULES.map((m) => [m.key, formData.get(`module_${m.key}`) === "on"]),
  );
  const modules_enabled = clampModulesToTemplate(
    t?.segment_template ?? "generico",
    desired,
  );

  const text = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  const { error } = await db
    .from("tenant_settings")
    .update({
      // Visual (logo_url não entra aqui — tem action própria de upload)
      primary_color: String(formData.get("primary_color") ?? "#2563eb"),
      secondary_color: String(formData.get("secondary_color") ?? "#1e40af"),
      theme_mode: String(formData.get("theme_mode") ?? "light"),
      // Labels
      label_client: String(formData.get("label_client") ?? "Cliente"),
      label_appointment: String(
        formData.get("label_appointment") ?? "Agendamento",
      ),
      // Persona IA
      ai_name: String(formData.get("ai_name") ?? "Assistente"),
      ai_welcome_message: text("ai_welcome_message"),
      ai_tone: String(formData.get("ai_tone") ?? "amigavel"),
      ai_behavior: text("ai_behavior"),
      // Rodapé
      footer_address: text("footer_address"),
      footer_phone: text("footer_phone"),
      footer_whatsapp: text("footer_whatsapp"),
      footer_website: text("footer_website"),
      // Módulos
      modules_enabled,
      // Fidelidade
      loyalty_goal: Number(formData.get("loyalty_goal") ?? 6),
      loyalty_frequency: String(formData.get("loyalty_frequency") ?? "monthly"),
      loyalty_points_per_checkin: Number(
        formData.get("loyalty_points_per_checkin") ?? 1,
      ),
      loyalty_streak_reset: formData.get("loyalty_streak_reset") === "on",
      // Recompensa
      reward_name: text("reward_name"),
      reward_description: text("reward_description"),
    })
    .eq("tenant_id", tenantId);

  return { error: error?.message };
}

// Upload do logo da empresa para o Storage (bucket público 'branding') e grava
// a URL pública em tenant_settings.logo_url. Service role → bypassa RLS.
export async function applyTenantLogoUpload(
  tenantId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecione um arquivo de imagem." };
  }

  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowed.includes(file.type)) {
    return { error: "Formato não suportado (use PNG, JPG, WEBP ou SVG)." };
  }
  if (file.size > 2 * 1024 * 1024) {
    return { error: "Imagem muito grande (máx. 2MB)." };
  }

  const db = createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = brandingPath(tenantId, ext);

  const { error: upErr } = await db.storage
    .from(BUCKETS.branding)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) return { error: upErr.message };

  const { data: pub } = db.storage.from(BUCKETS.branding).getPublicUrl(path);
  const { error } = await db
    .from("tenant_settings")
    .update({ logo_url: pub.publicUrl })
    .eq("tenant_id", tenantId);

  return { error: error?.message };
}

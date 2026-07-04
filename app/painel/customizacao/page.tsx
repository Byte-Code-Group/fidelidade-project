import { notFound } from "next/navigation";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { MODULES, getTemplate } from "@/lib/segment-templates";
import type { ProfileField, Tenant, TenantSettings } from "@/lib/types";
import { CustomizationForm } from "@/components/customization-form";
import {
  ownerUpdateTenantSettings,
  ownerUploadLogo,
  ownerCreateProfileField,
  ownerUpdateProfileField,
  ownerDeleteProfileField,
} from "../actions";

export default async function OwnerCustomizacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { tenantId } = await requireTenantOwner();
  const { error, saved } = await searchParams;

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", tenantId)
    .maybeSingle<Tenant>();
  if (!tenant) notFound();

  const { data: settings } = await db
    .from("tenant_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle<TenantSettings>();
  if (!settings) notFound();

  // Teto do template: só estes módulos podem ser ativados neste negócio.
  const tpl = getTemplate(tenant.segment_template);
  const allowedModules = MODULES.filter((m) => tpl.modules.includes(m.key)).map(
    (m) => ({ key: m.key as string, label: m.label }),
  );

  const { data: profileFields } = await db
    .from("profile_fields")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("display_order", { ascending: true })
    .returns<ProfileField[]>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Customização</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cores, textos, logo e páginas do seu portal.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {decodeURIComponent(error)}
        </p>
      )}
      {saved && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
          Alterações salvas.
        </p>
      )}

      <CustomizationForm
        tenantName={tenant.name}
        templateLabel={tpl.label}
        templateEmoji={tpl.emoji}
        portalUrl={tenant.custom_domain ? `https://${tenant.custom_domain}` : `/p/${tenant.slug}`}
        settings={settings}
        allowedModules={allowedModules}
        saveAction={ownerUpdateTenantSettings}
        uploadAction={ownerUploadLogo}
        profileFields={profileFields ?? []}
        createProfileFieldAction={ownerCreateProfileField}
        updateProfileFieldAction={ownerUpdateProfileField}
        deleteProfileFieldAction={ownerDeleteProfileField}
      />
    </div>
  );
}

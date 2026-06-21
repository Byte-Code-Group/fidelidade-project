import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tenant, TenantContext, TenantSettings } from "@/lib/types";

// Header injetado pelo middleware (ver middleware.ts).
export const TENANT_SLUG_HEADER = "x-tenant-slug";

// Slug do tenant da request atual (ou null no apex/domínio sem subdomínio).
export async function getTenantSlug(): Promise<string | null> {
  const h = await headers();
  return h.get(TENANT_SLUG_HEADER);
}

// Busca tenant + settings por slug. Cacheado por request (React cache()).
// Usa admin client: branding é público e precisa carregar antes do login.
export const getTenantBySlug = cache(
  async (slug: string): Promise<TenantContext | null> => {
    const supabase = createAdminClient();

    const { data: tenant } = await supabase
      .from("tenants")
      .select("*")
      .eq("slug", slug)
      .maybeSingle<Tenant>();

    if (!tenant) return null;

    const { data: settings } = await supabase
      .from("tenant_settings")
      .select("*")
      .eq("tenant_id", tenant.id)
      .maybeSingle<TenantSettings>();

    if (!settings) return null;

    return { tenant, settings };
  },
);

// Atalho: resolve o tenant da request atual a partir do header.
export const getCurrentTenant = cache(
  async (): Promise<TenantContext | null> => {
    const slug = await getTenantSlug();
    if (!slug) return null;
    return getTenantBySlug(slug);
  },
);

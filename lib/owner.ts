import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface TenantOwnerContext {
  user: User;
  tenantId: string;
}

// Usuário autenticado + tenant_id vinculado (se houver). Não redireciona.
export async function getTenantOwner(): Promise<TenantOwnerContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle<{ tenant_id: string | null }>();

  if (!data?.tenant_id) return null;
  return { user, tenantId: data.tenant_id };
}

// Gate para páginas/actions do painel do dono. Redireciona se não autorizado.
// tenantId é sempre derivado aqui, nunca aceito como argumento vindo de fora.
export async function requireTenantOwner(opts?: {
  noTenantRedirect?: string;
}): Promise<TenantOwnerContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/conta/login");

  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle<{ tenant_id: string | null }>();

  if (!data?.tenant_id) redirect(opts?.noTenantRedirect ?? "/conta/configurar");
  return { user, tenantId: data.tenant_id };
}

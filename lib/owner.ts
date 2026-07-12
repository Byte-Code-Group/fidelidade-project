import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const ACTIVE_TENANT_COOKIE = "owner_active_tenant";

export interface OwnedTenant {
  id: string;
  name: string;
  saas_plan: string;
  status: string;
}

export interface TenantOwnerContext {
  user: User;
  tenantId: string;
  tenants: OwnedTenant[];
}

// Todos os negócios (tenants) que esse usuário possui (exclui a linha
// "placeholder" com tenant_id null, criada no signup antes do 1º negócio).
export const getOwnerTenants = cache(async (userId: string): Promise<OwnedTenant[]> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_users")
    .select("tenant_id, created_at, tenants(id, name, saas_plan, status)")
    .eq("user_id", userId)
    .not("tenant_id", "is", null)
    .order("created_at", { ascending: true })
    .returns<{ tenant_id: string; tenants: OwnedTenant | null }[]>();

  return (data ?? []).flatMap((row) => (row.tenants ? [row.tenants] : []));
});

// Negócio "ativo" no painel: o escolhido via cookie (switcher), com
// fallback pro primeiro criado — nunca aceito como argumento vindo de fora.
async function resolveActiveTenantId(tenants: OwnedTenant[]): Promise<string | null> {
  if (tenants.length === 0) return null;
  const cookieStore = await cookies();
  const picked = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
  if (picked && tenants.some((t) => t.id === picked)) return picked;
  return tenants[0].id;
}

// Usuário autenticado + tenant ativo (se houver). Não redireciona.
export async function getTenantOwner(): Promise<TenantOwnerContext | null> {
  const user = await getAuthUser();
  if (!user) return null;

  const tenants = await getOwnerTenants(user.id);
  const tenantId = await resolveActiveTenantId(tenants);
  if (!tenantId) return null;
  return { user, tenantId, tenants };
}

// Gate para páginas/actions do painel do dono. Redireciona se não autorizado.
// tenantId é sempre derivado aqui, nunca aceito como argumento vindo de fora.
export async function requireTenantOwner(opts?: {
  noTenantRedirect?: string;
}): Promise<TenantOwnerContext> {
  const user = await getAuthUser();
  if (!user) redirect("/conta/login");

  const tenants = await getOwnerTenants(user.id);
  const tenantId = await resolveActiveTenantId(tenants);
  if (!tenantId) redirect(opts?.noTenantRedirect ?? "/conta/configurar");
  return { user, tenantId, tenants };
}

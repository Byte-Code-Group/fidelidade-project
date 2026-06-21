import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Usuário autenticado SE for platform admin (senão null).
// Checagem via service role (platform_admins tem RLS sem policies).
export async function getPlatformAdmin(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? user : null;
}

// Gate para páginas/actions do /superadmin. Redireciona se não autorizado.
export async function requirePlatformAdmin(): Promise<User> {
  const user = await getPlatformAdmin();
  if (!user) redirect("/superadmin/login");
  return user;
}

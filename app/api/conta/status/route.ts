import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTenantOwner } from "@/lib/owner";

// Consultado via fetch client-side pela página /conta/aguardando.
// Ao voltar do checkout do Asaas (navegação cross-site), o cookie de
// sessão pode não chegar na primeira renderização SSR; um fetch feito
// depois que a página já carregou é same-site e traz o cookie normalmente.
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, tenantStatus: null });
  }

  const owner = await getTenantOwner();
  if (!owner) {
    return NextResponse.json({ authenticated: true, tenantStatus: null });
  }

  const db = createAdminClient();
  const { data: tenant } = await db
    .from("tenants")
    .select("status")
    .eq("id", owner.tenantId)
    .maybeSingle<{ status: string }>();

  return NextResponse.json({
    authenticated: true,
    tenantStatus: tenant?.status ?? null,
  });
}

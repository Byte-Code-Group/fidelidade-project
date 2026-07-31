import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/server";
import { getTenantOwner } from "@/lib/owner";
import { syncTenantStatusWithAsaas } from "@/lib/tenant-billing";

// Consultado via fetch client-side pela página /conta/aguardando.
// Ao voltar do checkout do Asaas (navegação cross-site), o cookie de
// sessão pode não chegar na primeira renderização SSR; um fetch feito
// depois que a página já carregou é same-site e traz o cookie normalmente.
//
// Não confia só no que está salvo no banco: o webhook é a fonte primária
// de ativação, mas pode falhar (config errada no painel Asaas, evento não
// entregue, cliente restaurado manualmente etc.) — por isso reconcilia
// direto com o Asaas antes de responder.
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ authenticated: false, tenantStatus: null });
  }

  const owner = await getTenantOwner();
  if (!owner) {
    return NextResponse.json({ authenticated: true, tenantStatus: null });
  }

  // Sincroniza todos os negócios do dono, não só o ativo: o negócio que
  // acabou de ser pago nem sempre é o do cookie (dono com mais de um), e
  // reconciliar só o ativo deixava o recém-pago preso em "pending".
  const statuses = await Promise.all(
    owner.tenants.map(async (t) => [t.id, await syncTenantStatusWithAsaas(t.id)] as const),
  );
  const byId = new Map(statuses);

  return NextResponse.json({
    authenticated: true,
    tenantStatus: byId.get(owner.tenantId) ?? null,
    anyActive: statuses.some(([, s]) => s === "active"),
  });
}

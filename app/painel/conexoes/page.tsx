import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { MissionTypeIcon } from "@/components/mission-fields";
import { getSubscription } from "@/lib/asaas";
import { getContaDePagamento } from "@/lib/tenant-asaas";
import { AsaasAccountCard } from "@/components/asaas-account-card";
import { ownerConnectAsaas, ownerDisconnectAsaas } from "../actions";
import type { Mission } from "@/lib/types";

export default async function OwnerConexoesPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();

  const [{ data: socialMissions }, { data: tenant }] = await Promise.all([
    db
      .from("missions")
      .select("*")
      .eq("tenant_id", tenantId)
      .neq("type", "custom")
      .returns<Mission[]>(),
    db
      .from("tenants")
      .select("asaas_customer_id, asaas_subscription_id, slug, custom_domain")
      .eq("id", tenantId)
      .maybeSingle<{
        asaas_customer_id: string | null;
        asaas_subscription_id: string | null;
        slug: string;
        custom_domain: string | null;
      }>(),
  ]);

  const contaDeRecebimento = await getContaDePagamento(tenantId);

  // O site que o Asaas pede é o portal DESTE negócio (domínio próprio, se
  // houver), não o endereço da plataforma.
  const portalUrl = tenant?.custom_domain
    ? `https://${tenant.custom_domain}`
    : tenant
      ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000"}/p/${tenant.slug}`
      : undefined;

  let subscription: { status: string; nextDueDate: string; value: number } | null = null;
  if (tenant?.asaas_subscription_id && process.env.ASAAS_API_KEY) {
    try {
      subscription = await getSubscription(tenant.asaas_subscription_id);
    } catch {
      // Asaas offline ou id inválido — mostra só o status local.
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Conexões</h1>
        <p className="mt-1 text-sm text-gray-500">
          Redes sociais, pagamentos e integrações do seu negócio.
        </p>
      </div>

      {/* Redes sociais */}
      <Card>
        <CardContent className="space-y-3">
          <div>
            <h2 className="font-semibold">Redes sociais</h2>
            <p className="text-xs text-gray-500">
              Gerenciadas como missões de rede social — edite em Missões.
            </p>
          </div>
          {!socialMissions || socialMissions.length === 0 ? (
            <p className="rounded-lg bg-black/5 px-3 py-2.5 text-sm opacity-70 dark:bg-white/10">
              Nenhuma rede social conectada ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {socialMissions.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2.5 text-sm"
                >
                  <MissionTypeIcon type={m.type} className="h-6 w-6 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.title}</p>
                    {m.external_url && (
                      <p className="truncate text-xs text-gray-500">{m.external_url}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/painel/missoes" className="text-sm text-[var(--primary)] hover:underline">
            Gerenciar em Missões →
          </Link>
        </CardContent>
      </Card>

      {/* WhatsApp Business API */}
      <Card>
        <CardContent className="space-y-2">
          <h2 className="font-semibold">WhatsApp Business API</h2>
          <p className="text-sm text-gray-500">
            Disparo automático de mensagens via WhatsApp Business API está no
            roadmap da plataforma — ainda não disponível.
          </p>
          <p className="text-xs text-gray-400">
            Hoje você já pode exibir um link de WhatsApp clicável no portal em{" "}
            <Link href="/painel/customizacao" className="text-[var(--primary)] hover:underline">
              Customização → Rodapé/contato
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      {/* Recebimento dos clientes do negócio */}
      <AsaasAccountCard
        conta={contaDeRecebimento}
        portalUrl={portalUrl}
        conectarAction={ownerConnectAsaas}
        desconectarAction={ownerDisconnectAsaas}
      />

      {/* Assinatura do negócio COM a plataforma */}
      <Card>
        <CardContent className="space-y-2">
          <h2 className="font-semibold">Sua assinatura da plataforma</h2>
          {tenant?.asaas_customer_id ? (
            <>
              <p className="text-sm text-green-600">Conectado ao Asaas</p>
              {subscription && (
                <p className="text-xs text-gray-500">
                  Assinatura {subscription.status} · R$ {subscription.value} · próx. vencimento{" "}
                  {new Date(subscription.nextDueDate).toLocaleDateString("pt-BR")}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">Ainda não conectado.</p>
          )}
          <Link href="/painel/assinatura" className="text-sm text-[var(--primary)] hover:underline">
            Gerenciar assinatura →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

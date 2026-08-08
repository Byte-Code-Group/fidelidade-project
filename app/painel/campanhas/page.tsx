import { requireTenantOwner } from "@/lib/owner";
import { createAdminClient } from "@/lib/supabase/admin";
import { getContaWhatsApp } from "@/lib/tenant-whatsapp";
import { listCampaigns, statsDasCampanhas, templatesDoTenant } from "@/lib/campaigns";
import { WhatsAppAccountCard } from "@/components/whatsapp-account-card";
import { CampaignsList } from "@/components/campaigns-list";
import {
  ownerConnectWhatsApp,
  ownerDisconnectWhatsApp,
  ownerCreateCampaign,
  ownerUpdateCampaign,
  ownerDeleteCampaign,
  ownerPreviewCampaignAudience,
  ownerStartCampaign,
  ownerSendCampaignBatch,
  ownerCancelCampaign,
} from "../actions";

export default async function OwnerCampanhasPage() {
  const { tenantId } = await requireTenantOwner();
  const db = createAdminClient();

  const conta = await getContaWhatsApp(tenantId);

  const [campaigns, stats, { templates, error: erroTemplates }, { data: plans }] =
    await Promise.all([
      listCampaigns(tenantId),
      statsDasCampanhas(tenantId),
      // Sem número conectado isso devolve lista vazia sem chamar a Meta.
      templatesDoTenant(tenantId),
      db
        .from("business_plans")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("display_order", { ascending: true })
        .returns<{ id: string; name: string }[]>(),
    ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Campanhas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Mensagens em massa pelo WhatsApp do seu negócio, com filtro de público
          e acompanhamento de entrega.
        </p>
      </div>

      <WhatsAppAccountCard
        conta={conta}
        conectarAction={ownerConnectWhatsApp}
        desconectarAction={ownerDisconnectWhatsApp}
      />

      {erroTemplates && (
        <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-600">
          Não consegui carregar seus templates: {erroTemplates}
        </p>
      )}

      <CampaignsList
        campaigns={campaigns}
        stats={stats}
        templates={templates}
        plans={plans ?? []}
        conectado={!!conta}
        createAction={ownerCreateCampaign}
        updateAction={ownerUpdateCampaign}
        deleteAction={ownerDeleteCampaign}
        previewAction={ownerPreviewCampaignAudience}
        startAction={ownerStartCampaign}
        sendBatchAction={ownerSendCampaignBatch}
        cancelAction={ownerCancelCampaign}
      />
    </div>
  );
}

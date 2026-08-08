import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { assinarAppNaConta, verificarNumero, type CredenciaisWhatsApp } from "@/lib/whatsapp";
import { siteUrl } from "@/lib/urls";

// Número de WhatsApp DO NEGÓCIO no Cloud API. Mesmo desenho do Asaas
// (lib/tenant-asaas.ts): a plataforma guarda o token cifrado e chama a Meta em
// nome do negócio; o token nunca volta pro browser.

const API_VERSION_PADRAO = "v22.0";

interface LinhaConta {
  tenant_id: string;
  access_token_enc: string;
  phone_number_id: string;
  waba_id: string;
  display_phone: string | null;
  verified_name: string | null;
  verify_token: string;
  api_version: string;
  connected_at: string;
}

export interface ContaWhatsApp {
  tenantId: string;
  phoneNumberId: string;
  wabaId: string;
  displayPhone: string | null;
  verifiedName: string | null;
  connectedAt: string;
  /** Endereço e token que o dono precisa colar no painel da Meta. */
  webhookUrl: string | null;
  verifyToken: string;
}

/** Dados mostráveis no painel — nunca inclui o token de acesso. */
export async function getContaWhatsApp(tenantId: string): Promise<ContaWhatsApp | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_whatsapp_accounts")
    .select(
      "tenant_id, phone_number_id, waba_id, display_phone, verified_name, verify_token, connected_at",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle<Omit<LinhaConta, "access_token_enc" | "api_version">>();

  if (!data) return null;
  return {
    tenantId: data.tenant_id,
    phoneNumberId: data.phone_number_id,
    wabaId: data.waba_id,
    displayPhone: data.display_phone,
    verifiedName: data.verified_name,
    connectedAt: data.connected_at,
    webhookUrl: urlDoWebhook(tenantId),
    verifyToken: data.verify_token,
  };
}

/** Credencial pronta pra chamar a Meta em nome do negócio. */
export async function getCredenciaisWhatsApp(
  tenantId: string,
): Promise<CredenciaisWhatsApp | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_whatsapp_accounts")
    .select("access_token_enc, phone_number_id, waba_id, api_version")
    .eq("tenant_id", tenantId)
    .maybeSingle<
      Pick<LinhaConta, "access_token_enc" | "phone_number_id" | "waba_id" | "api_version">
    >();

  if (!data) return null;
  try {
    return {
      accessToken: decryptSecret(data.access_token_enc),
      phoneNumberId: data.phone_number_id,
      wabaId: data.waba_id,
      apiVersion: data.api_version,
    };
  } catch {
    // APP_ENCRYPTION_KEY trocada ou linha adulterada: tratar como desconectado
    // é melhor do que estourar no meio de um disparo.
    return null;
  }
}

export function urlDoWebhook(tenantId: string): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? siteUrl();
  return site ? `${site.replace(/\/$/, "")}/api/webhooks/whatsapp/${tenantId}` : null;
}

/**
 * O webhook da Meta é único por app, não por negócio: a mesma URL serve todos.
 * O tenantId vai no caminho e o verify_token confere que é mesmo daquele
 * negócio (ver a rota em app/api/webhooks/whatsapp/[tenantId]).
 */
export async function tenantDoWebhook(
  tenantId: string,
  token: string | null,
): Promise<boolean> {
  if (!token) return false;
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_whatsapp_accounts")
    .select("verify_token")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ verify_token: string }>();
  return !!data && data.verify_token === token;
}

/** Valida o token contra a Meta, guarda cifrado e inscreve nosso webhook. */
export async function conectarWhatsApp(
  tenantId: string,
  entrada: { accessToken: string; phoneNumberId: string; wabaId: string },
): Promise<{ error?: string; displayPhone?: string; aviso?: string }> {
  const accessToken = entrada.accessToken.trim();
  const phoneNumberId = entrada.phoneNumberId.trim();
  const wabaId = entrada.wabaId.trim();

  if (!accessToken || !phoneNumberId || !wabaId) {
    return { error: "Preencha o token, o ID do número e o ID da conta comercial." };
  }
  if (!/^\d+$/.test(phoneNumberId) || !/^\d+$/.test(wabaId)) {
    return { error: "ID do número e ID da conta comercial são só números." };
  }

  const cred: CredenciaisWhatsApp = {
    accessToken,
    phoneNumberId,
    wabaId,
    apiVersion: API_VERSION_PADRAO,
  };

  const info = await verificarNumero(cred);
  if (info.error) return { error: info.error };

  // Sem inscrição no WABA a Meta não manda status de entrega nem resposta do
  // cliente — a campanha envia, mas fica cega. Não impede conectar.
  const inscricao = await assinarAppNaConta(cred);

  const db = createAdminClient();
  // Reconectar não pode trocar o verify_token: ele já está colado no painel da
  // Meta e trocar quebraria o webhook em silêncio.
  const { data: anterior } = await db
    .from("tenant_whatsapp_accounts")
    .select("verify_token")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ verify_token: string }>();

  const { error } = await db.from("tenant_whatsapp_accounts").upsert(
    {
      tenant_id: tenantId,
      access_token_enc: encryptSecret(accessToken),
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      display_phone: info.displayPhone ?? null,
      verified_name: info.verifiedName ?? null,
      verify_token: anterior?.verify_token ?? randomBytes(24).toString("hex"),
      api_version: API_VERSION_PADRAO,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) return { error: "Não consegui salvar a conexão. Tente de novo." };

  return {
    displayPhone: info.displayPhone,
    aviso: inscricao.error
      ? "conectado, mas não consegui ativar o webhook — o status de entrega não vai atualizar sozinho"
      : undefined,
  };
}

export async function desconectarWhatsApp(tenantId: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { error } = await db
    .from("tenant_whatsapp_accounts")
    .delete()
    .eq("tenant_id", tenantId);
  return { error: error ? "Não consegui desconectar agora. Tente de novo." : undefined };
}

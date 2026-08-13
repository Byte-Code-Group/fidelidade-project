import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  API_VERSION_PADRAO,
  assinarAppNaConta,
  registrarNumero,
  trocarCodePorToken,
  verificarNumero,
  type CredenciaisWhatsApp,
} from "@/lib/whatsapp";
import { siteUrl } from "@/lib/urls";

// Número de WhatsApp DO NEGÓCIO no Cloud API. Mesmo desenho do Asaas
// (lib/tenant-asaas.ts): a plataforma guarda o token cifrado e chama a Meta em
// nome do negócio; o token nunca volta pro browser.
//
// Dois caminhos de conexão, mesmo resultado no banco:
//  • conectarWhatsApp — manual, o dono cola token e IDs (funciona sempre);
//  • conectarWhatsAppPorOnboarding — Embedded Signup, 1 clique (exige que a
//    plataforma seja Tech Provider aprovada pela Meta).

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

/**
 * Grava a conexão cifrada. Devolve a mensagem de erro, ou undefined em caso de
 * sucesso — os dois caminhos de conexão (manual e Embedded Signup) terminam
 * aqui pra não divergirem no que é salvo.
 */
async function salvarConta(
  tenantId: string,
  dados: {
    accessToken: string;
    phoneNumberId: string;
    wabaId: string;
    displayPhone: string | null;
    verifiedName: string | null;
  },
): Promise<string | undefined> {
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
      access_token_enc: encryptSecret(dados.accessToken),
      phone_number_id: dados.phoneNumberId,
      waba_id: dados.wabaId,
      display_phone: dados.displayPhone,
      verified_name: dados.verifiedName,
      verify_token: anterior?.verify_token ?? randomBytes(24).toString("hex"),
      api_version: API_VERSION_PADRAO,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  return error ? "Não consegui salvar a conexão. Tente de novo." : undefined;
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

  const erroSalvar = await salvarConta(tenantId, {
    accessToken,
    phoneNumberId,
    wabaId,
    displayPhone: info.displayPhone ?? null,
    verifiedName: info.verifiedName ?? null,
  });
  if (erroSalvar) return { error: erroSalvar };

  return {
    displayPhone: info.displayPhone,
    aviso: inscricao.error
      ? "conectado, mas não consegui ativar o webhook — o status de entrega não vai atualizar sozinho"
      : undefined,
  };
}

/**
 * Conexão em 1 clique (Embedded Signup). O popup da Meta devolve os IDs e um
 * `code`; aqui o code vira token do cliente, o número é registrado e o app é
 * inscrito no webhook — o dono do negócio não toca em nada disso.
 *
 * Ordem importa: sem registrar o número o envio é recusado, e sem inscrever o
 * app não chega status de entrega.
 */
export async function conectarWhatsAppPorOnboarding(
  tenantId: string,
  entrada: { code: string; phoneNumberId: string; wabaId: string; pin?: string },
): Promise<{ error?: string; displayPhone?: string; aviso?: string }> {
  const code = entrada.code.trim();
  const phoneNumberId = entrada.phoneNumberId.trim();
  const wabaId = entrada.wabaId.trim();

  if (!code || !phoneNumberId || !wabaId) {
    return { error: "A Meta não devolveu os dados da conta. Tente conectar de novo." };
  }

  const { accessToken, error: erroToken } = await trocarCodePorToken(code);
  if (erroToken || !accessToken) {
    return { error: erroToken ?? "Não consegui obter o acesso à sua conta." };
  }

  const cred: CredenciaisWhatsApp = {
    accessToken,
    phoneNumberId,
    wabaId,
    apiVersion: API_VERSION_PADRAO,
  };

  const info = await verificarNumero(cred);
  if (info.error) return { error: info.error };

  const avisos: string[] = [];

  // PIN só existe quando o dono digitou. Sem ele o número pode já estar
  // registrado de uma conexão anterior — não dá pra afirmar que quebrou.
  if (entrada.pin) {
    const registro = await registrarNumero(cred, entrada.pin);
    if (registro.error) return { error: registro.error };
  } else {
    avisos.push("sem o PIN não dá pra registrar o número — se o envio falhar, reconecte informando o PIN");
  }

  const inscricao = await assinarAppNaConta(cred);
  if (inscricao.error) {
    avisos.push("não consegui ativar o webhook — o status de entrega não vai atualizar sozinho");
  }

  const erroSalvar = await salvarConta(tenantId, {
    accessToken,
    phoneNumberId,
    wabaId,
    displayPhone: info.displayPhone ?? null,
    verifiedName: info.verifiedName ?? null,
  });
  if (erroSalvar) return { error: erroSalvar };

  return {
    displayPhone: info.displayPhone,
    aviso: avisos.length > 0 ? avisos.join("; ") : undefined,
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

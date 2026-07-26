import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import {
  createWebhookNaConta,
  deleteWebhookNaConta,
  getMyAccount,
  type AsaasConta,
  type AsaasEnvironment,
} from "@/lib/asaas";
import { randomBytes } from "node:crypto";

// Conta Asaas do PRÓPRIO negócio — é nela que caem as assinaturas dos clientes
// finais (business_plans). A plataforma não intermedeia: só guarda a
// credencial cifrada e dispara as chamadas em nome do negócio.
//
// Não confundir com a conta da plataforma (ASAAS_API_KEY no env), que cobra a
// mensalidade do negócio — essa continua em lib/tenant-billing.ts.

export interface ContaDePagamento {
  tenantId: string;
  environment: AsaasEnvironment;
  accountName: string | null;
  accountEmail: string | null;
  webhookId: string | null;
  connectedAt: string;
  /** O Asaas recusou o retorno pro portal: falta cadastrar o site na conta. */
  callbackBloqueado: boolean;
}

interface LinhaConta {
  tenant_id: string;
  api_key_enc: string;
  environment: AsaasEnvironment;
  account_name: string | null;
  account_email: string | null;
  webhook_id: string | null;
  webhook_token: string | null;
  connected_at: string;
  callback_bloqueado: boolean;
}

/** Dados mostráveis no painel — nunca inclui a chave. */
export async function getContaDePagamento(
  tenantId: string,
): Promise<ContaDePagamento | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_payment_accounts")
    .select(
      "tenant_id, environment, account_name, account_email, webhook_id, connected_at, callback_bloqueado",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle<Omit<LinhaConta, "api_key_enc" | "webhook_token">>();

  if (!data) return null;
  return {
    tenantId: data.tenant_id,
    environment: data.environment,
    accountName: data.account_name,
    accountEmail: data.account_email,
    webhookId: data.webhook_id,
    connectedAt: data.connected_at,
    callbackBloqueado: data.callback_bloqueado,
  };
}

/** Credencial pronta pra chamar o Asaas em nome do negócio. */
export async function getCredenciais(tenantId: string): Promise<AsaasConta | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_payment_accounts")
    .select("api_key_enc, environment")
    .eq("tenant_id", tenantId)
    .maybeSingle<Pick<LinhaConta, "api_key_enc" | "environment">>();

  if (!data) return null;
  try {
    return { apiKey: decryptSecret(data.api_key_enc), environment: data.environment };
  } catch {
    // APP_ENCRYPTION_KEY trocada ou linha adulterada: melhor tratar como
    // desconectado do que estourar no meio de um agendamento/assinatura.
    return null;
  }
}

function urlDoWebhook(tenantId: string): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  return site ? `${site}/api/webhooks/asaas/tenant/${tenantId}` : null;
}

/**
 * Valida a chave contra o Asaas, guarda cifrada e registra o webhook que
 * avisa a plataforma quando o cliente final paga/atrasa.
 */
export async function conectarAsaas(
  tenantId: string,
  apiKey: string,
  environment: AsaasEnvironment,
  { ownerEmail }: { ownerEmail?: string | null } = {},
): Promise<{ error?: string; accountName?: string; aviso?: string }> {
  const chave = apiKey.trim();
  if (!chave) return { error: "Cole a chave de API da sua conta Asaas." };

  const conta: AsaasConta = { apiKey: chave, environment };

  let info;
  try {
    info = await getMyAccount(conta);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/401|403/.test(msg)) {
      return {
        error:
          environment === "sandbox"
            ? "Chave recusada pelo Asaas. Confira se ela é da conta de sandbox."
            : "Chave recusada pelo Asaas. Confira se copiou a chave inteira e se é da conta de produção.",
      };
    }
    return { error: "Não consegui falar com o Asaas agora. Tente de novo em instantes." };
  }

  const db = createAdminClient();
  const anterior = await db
    .from("tenant_payment_accounts")
    .select("api_key_enc, environment, webhook_id")
    .eq("tenant_id", tenantId)
    .maybeSingle<Pick<LinhaConta, "api_key_enc" | "environment" | "webhook_id">>();

  // Reconectar com outra chave: o webhook antigo fica órfão na conta anterior.
  if (anterior.data?.webhook_id) {
    try {
      const antiga = {
        apiKey: decryptSecret(anterior.data.api_key_enc),
        environment: anterior.data.environment,
      };
      await deleteWebhookNaConta(antiga, anterior.data.webhook_id);
    } catch {
      // Chave velha inválida ou webhook já removido — não impede reconectar.
    }
  }

  const webhookToken = randomBytes(24).toString("hex"); // 48 chars, dentro do mínimo do Asaas
  const url = urlDoWebhook(tenantId);
  const email = info.email ?? ownerEmail ?? undefined;

  let webhookId: string | null = null;
  let avisoWebhook: string | undefined;
  if (url && email) {
    try {
      const webhook = await createWebhookNaConta(conta, {
        name: "Fideliza.OS",
        url,
        email,
        authToken: webhookToken,
      });
      webhookId = webhook.id;
    } catch {
      // Sem webhook a cobrança funciona, só não atualiza sozinha o status.
      avisoWebhook = "conectado, mas não consegui criar o webhook automático";
    }
  }

  const { error } = await db.from("tenant_payment_accounts").upsert(
    {
      tenant_id: tenantId,
      provider: "asaas",
      api_key_enc: encryptSecret(chave),
      environment,
      account_name: info.companyName ?? info.name ?? null,
      account_email: info.email ?? null,
      webhook_id: webhookId,
      webhook_token: webhookToken,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) return { error: "Não consegui salvar a conexão. Tente de novo." };

  return { accountName: info.companyName ?? info.name ?? undefined, aviso: avisoWebhook };
}

export async function desconectarAsaas(tenantId: string): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_payment_accounts")
    .select("api_key_enc, environment, webhook_id")
    .eq("tenant_id", tenantId)
    .maybeSingle<Pick<LinhaConta, "api_key_enc" | "environment" | "webhook_id">>();

  if (data?.webhook_id) {
    try {
      await deleteWebhookNaConta(
        { apiKey: decryptSecret(data.api_key_enc), environment: data.environment },
        data.webhook_id,
      );
    } catch {
      // Webhook já apagado no Asaas ou chave revogada — segue e limpa aqui.
    }
  }

  const { error } = await db
    .from("tenant_payment_accounts")
    .delete()
    .eq("tenant_id", tenantId);
  return { error: error ? "Não consegui desconectar agora." : undefined };
}

/** Confere o token que o Asaas devolve no header do webhook. */
export async function tenantDoWebhook(
  tenantId: string,
  token: string | null,
): Promise<boolean> {
  if (!token) return false;
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_payment_accounts")
    .select("webhook_token")
    .eq("tenant_id", tenantId)
    .maybeSingle<Pick<LinhaConta, "webhook_token">>();
  return Boolean(data?.webhook_token) && data!.webhook_token === token;
}

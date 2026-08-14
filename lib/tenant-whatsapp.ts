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
import {
  apagarInstancia,
  configurarWebhook,
  criarInstancia,
  dadosDaInstancia,
  desconectarInstancia,
  estadoDaConexao,
  obterQrCode,
  servidorEvolution,
  type EstadoConexao,
  type ServidorEvolution,
} from "@/lib/evolution";

// Número de WhatsApp DO NEGÓCIO. Mesmo desenho do Asaas
// (lib/tenant-asaas.ts): a plataforma guarda o segredo cifrado e chama a API em
// nome do negócio; o token nunca volta pro browser.
//
// Dois provedores possíveis, mesma tabela e mesmo fluxo de campanha depois:
//
//  'meta'      — Cloud API oficial. Três caminhos de conexão:
//                conectarWhatsApp (manual) e conectarWhatsAppPorOnboarding
//                (Embedded Signup, exige Tech Provider aprovado).
//                Só envia template aprovado, e a Meta cobra por mensagem.
//  'evolution' — QR code, igual WhatsApp Web. Texto livre, sem custo por
//                mensagem, número segue funcionando no celular. Em troca é
//                engenharia reversa: viola os Termos do WhatsApp e o número
//                pode ser banido. Ver deploy/evolution/README.md.

export type ProvedorWhatsApp = "meta" | "evolution";

interface LinhaConta {
  tenant_id: string;
  provider: ProvedorWhatsApp;
  access_token_enc: string | null;
  phone_number_id: string | null;
  waba_id: string | null;
  instance_name: string | null;
  display_phone: string | null;
  verified_name: string | null;
  verify_token: string;
  api_version: string;
  connected_at: string;
}

export interface ContaWhatsApp {
  tenantId: string;
  provider: ProvedorWhatsApp;
  phoneNumberId: string | null;
  wabaId: string | null;
  instanceName: string | null;
  displayPhone: string | null;
  verifiedName: string | null;
  connectedAt: string;
  /** Endereço e token que o dono precisa colar no painel da Meta. */
  webhookUrl: string | null;
  verifyToken: string;
}

/** O que o disparo precisa saber pra mandar mensagem, já resolvido por provedor. */
export type EnvioWhatsApp =
  | { provider: "meta"; cred: CredenciaisWhatsApp }
  | { provider: "evolution"; servidor: ServidorEvolution; instancia: string };

/** Dados mostráveis no painel — nunca inclui o token de acesso. */
export async function getContaWhatsApp(tenantId: string): Promise<ContaWhatsApp | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_whatsapp_accounts")
    .select(
      "tenant_id, provider, phone_number_id, waba_id, instance_name, display_phone, verified_name, verify_token, connected_at",
    )
    .eq("tenant_id", tenantId)
    .maybeSingle<Omit<LinhaConta, "access_token_enc" | "api_version">>();

  if (!data) return null;
  return {
    tenantId: data.tenant_id,
    provider: data.provider,
    phoneNumberId: data.phone_number_id,
    wabaId: data.waba_id,
    instanceName: data.instance_name,
    displayPhone: data.display_phone,
    verifiedName: data.verified_name,
    connectedAt: data.connected_at,
    webhookUrl: urlDoWebhook(tenantId),
    verifyToken: data.verify_token,
  };
}

/**
 * Resolve o provedor da conexão e devolve o que o disparo precisa. É por aqui
 * que lib/campaigns.ts decide entre template da Meta e texto livre.
 */
export async function getEnvioWhatsApp(tenantId: string): Promise<EnvioWhatsApp | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_whatsapp_accounts")
    .select("provider, access_token_enc, phone_number_id, waba_id, api_version, instance_name")
    .eq("tenant_id", tenantId)
    .maybeSingle<
      Pick<
        LinhaConta,
        | "provider"
        | "access_token_enc"
        | "phone_number_id"
        | "waba_id"
        | "api_version"
        | "instance_name"
      >
    >();

  if (!data) return null;

  if (data.provider === "evolution") {
    const servidor = servidorEvolution();
    // Servidor removido do ambiente depois da conexão: melhor tratar como
    // desconectado do que estourar no meio de um disparo.
    if (!servidor || !data.instance_name) return null;
    return { provider: "evolution", servidor, instancia: data.instance_name };
  }

  if (!data.access_token_enc || !data.phone_number_id || !data.waba_id) return null;
  try {
    return {
      provider: "meta",
      cred: {
        accessToken: decryptSecret(data.access_token_enc),
        phoneNumberId: data.phone_number_id,
        wabaId: data.waba_id,
        apiVersion: data.api_version,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Credencial da Meta. Devolve null quando o negócio está conectado por QR code
 * — quem chama aqui só sabe falar Graph API (templates, por exemplo).
 */
export async function getCredenciaisWhatsApp(
  tenantId: string,
): Promise<CredenciaisWhatsApp | null> {
  const envio = await getEnvioWhatsApp(tenantId);
  return envio?.provider === "meta" ? envio.cred : null;
}

function baseDoSite(): string | null {
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? siteUrl();
  return site ? site.replace(/\/$/, "") : null;
}

export function urlDoWebhook(tenantId: string): string | null {
  const site = baseDoSite();
  return site ? `${site}/api/webhooks/whatsapp/${tenantId}` : null;
}

/**
 * Webhook do Evolution. Diferente da Meta, ele não assina o corpo — o segredo
 * vai na própria URL, que só o servidor Evolution e a plataforma conhecem.
 */
function urlDoWebhookEvolution(tenantId: string, verifyToken: string): string | null {
  const site = baseDoSite();
  return site
    ? `${site}/api/webhooks/evolution/${tenantId}?t=${encodeURIComponent(verifyToken)}`
    : null;
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
    provider: ProvedorWhatsApp;
    accessToken?: string;
    phoneNumberId?: string;
    wabaId?: string;
    instanceName?: string;
    displayPhone: string | null;
    verifiedName: string | null;
  },
): Promise<string | undefined> {
  const db = createAdminClient();
  // Reconectar não pode trocar o verify_token: ele já está colado no painel da
  // Meta (ou dentro da URL do webhook no Evolution) e trocar quebraria o
  // recebimento em silêncio.
  const verifyToken = await verifyTokenDoTenant(tenantId);

  const { error } = await db.from("tenant_whatsapp_accounts").upsert(
    {
      tenant_id: tenantId,
      provider: dados.provider,
      access_token_enc: dados.accessToken ? encryptSecret(dados.accessToken) : null,
      phone_number_id: dados.phoneNumberId ?? null,
      waba_id: dados.wabaId ?? null,
      instance_name: dados.instanceName ?? null,
      display_phone: dados.displayPhone,
      verified_name: dados.verifiedName,
      verify_token: verifyToken,
      api_version: API_VERSION_PADRAO,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  return error ? "Não consegui salvar a conexão. Tente de novo." : undefined;
}

/** Reaproveita o segredo do webhook, ou cria um na primeira conexão. */
async function verifyTokenDoTenant(tenantId: string): Promise<string> {
  const db = createAdminClient();
  const { data } = await db
    .from("tenant_whatsapp_accounts")
    .select("verify_token")
    .eq("tenant_id", tenantId)
    .maybeSingle<{ verify_token: string }>();
  return data?.verify_token ?? randomBytes(24).toString("hex");
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
    provider: "meta",
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
    provider: "meta",
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

// ------------------------------------------------------------
// Conexão por QR code (Evolution)
// ------------------------------------------------------------

/** A instância no servidor Evolution é nomeada com o próprio tenant_id. */
function nomeDaInstancia(tenantId: string): string {
  return tenantId;
}

/**
 * Prepara a instância do negócio e devolve o QR code pra ler no celular.
 *
 * Ainda NÃO grava a conexão: enquanto o dono não lê o código, não existe número
 * conectado — salvar aqui deixaria o painel dizendo "conectado" para uma sessão
 * que nunca abriu. Quem grava é confirmarConexaoPorQrCode, ao ver estado
 * "open".
 *
 * O QR expira em segundos; chamar de novo gera outro, e é isso que o painel faz
 * enquanto a tela está aberta.
 */
export async function iniciarConexaoPorQrCode(
  tenantId: string,
): Promise<{ error?: string; qrCode?: string | null; jaConectado?: boolean }> {
  const servidor = servidorEvolution();
  if (!servidor) {
    return { error: "Conexão por QR code não está disponível nesta instalação." };
  }

  const instancia = nomeDaInstancia(tenantId);
  const criacao = await criarInstancia(servidor, instancia);
  if (criacao.error) return { error: criacao.error };

  // Reconfigura o webhook em toda tentativa: é barato, e cobre o caso da
  // instância ter sido criada antes do site ganhar URL pública.
  const verifyToken = await verifyTokenDoTenant(tenantId);
  const url = urlDoWebhookEvolution(tenantId, verifyToken);
  if (url) await configurarWebhook(servidor, instancia, url);

  return await obterQrCode(servidor, instancia);
}

/**
 * Verifica se a leitura do QR code funcionou. Enquanto o estado não for "open"
 * não há o que salvar — o painel repete a chamada.
 *
 * Grava a conexão no primeiro "open": é aqui que o negócio passa a ter
 * provider 'evolution' e o disparo destrava.
 */
export async function confirmarConexaoPorQrCode(
  tenantId: string,
): Promise<{ error?: string; estado?: EstadoConexao; displayPhone?: string | null }> {
  const servidor = servidorEvolution();
  if (!servidor) {
    return { error: "Conexão por QR code não está disponível nesta instalação." };
  }

  const instancia = nomeDaInstancia(tenantId);
  const { estado, error } = await estadoDaConexao(servidor, instancia);
  if (error) return { error };
  if (estado !== "open") return { estado };

  const dados = await dadosDaInstancia(servidor, instancia);
  const erroSalvar = await salvarConta(tenantId, {
    provider: "evolution",
    instanceName: instancia,
    displayPhone: dados.telefone ?? null,
    verifiedName: dados.perfil ?? null,
  });
  if (erroSalvar) return { error: erroSalvar };

  // Só agora o verify_token está gravado. O webhook configurado em
  // iniciarConexaoPorQrCode usou um token que ainda não existia no banco, e a
  // rota rejeitaria tudo — reaponta com o valor definitivo.
  const url = urlDoWebhookEvolution(tenantId, await verifyTokenDoTenant(tenantId));
  if (url) await configurarWebhook(servidor, instancia, url);

  return { estado, displayPhone: dados.telefone ?? null };
}

export async function desconectarWhatsApp(tenantId: string): Promise<{ error?: string }> {
  const db = createAdminClient();

  // Apaga a sessão no servidor Evolution antes da linha: sem isso a instância
  // fica pendurada lá, ainda logada no WhatsApp do cliente, sem nada no painel
  // que permita desligá-la.
  const conta = await getContaWhatsApp(tenantId);
  if (conta?.provider === "evolution" && conta.instanceName) {
    const servidor = servidorEvolution();
    if (servidor) {
      await desconectarInstancia(servidor, conta.instanceName);
      await apagarInstancia(servidor, conta.instanceName);
    }
  }

  const { error } = await db
    .from("tenant_whatsapp_accounts")
    .delete()
    .eq("tenant_id", tenantId);
  return { error: error ? "Não consegui desconectar agora. Tente de novo." : undefined };
}

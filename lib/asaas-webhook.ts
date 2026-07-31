// Webhook da conta Asaas DA PLATAFORMA — o que ativa o portal do dono quando a
// mensalidade é paga (app/api/webhooks/asaas/route.ts).
//
// O webhook de cada NEGÓCIO é criado sozinho ao conectar a conta dele
// (lib/tenant-asaas.ts). Este aqui dependia de alguém lembrar de cadastrar à
// mão no painel do Asaas; quando faltava, assinatura paga só ativava se o dono
// abrisse a tela (o fallback de reconciliação).
//
// Usado pelo painel do superadmin e pelo scripts/setup-asaas-webhook.ts.

import { baseUrlDe, type AsaasEnvironment } from "@/lib/asaas";

export const EVENTOS_NECESSARIOS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
];

export interface WebhookAsaas {
  id: string;
  name: string;
  url: string;
  email: string | null;
  enabled: boolean;
  interrupted: boolean;
  authToken: string | null;
  events: string[];
}

export interface DiagnosticoWebhook {
  /** Falta configuração no ambiente — nem dá pra consultar o Asaas. */
  configuracaoFaltando: string[];
  /** Erro ao falar com o Asaas (chave errada, sandbox invertido, rede). */
  erro: string | null;
  contaNome: string | null;
  contaEmail: string | null;
  ambiente: AsaasEnvironment;
  urlEsperada: string;
  webhook: WebhookAsaas | null;
  /** Vazio = está tudo certo. */
  problemas: string[];
}

interface Ambiente {
  apiKey?: string;
  authToken?: string;
  siteUrl?: string;
  sandbox: boolean;
}

function lerAmbiente(): Ambiente {
  return {
    apiKey: process.env.ASAAS_API_KEY,
    authToken: process.env.ASAAS_WEBHOOK_TOKEN,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    sandbox: String(process.env.ASAAS_SANDBOX ?? "").toLowerCase() === "true",
  };
}

function urlDoWebhook(siteUrl: string): string {
  return `${siteUrl.replace(/\/$/, "")}/api/webhooks/asaas`;
}

async function req<T>(
  base: string,
  apiKey: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Asaas ${res.status} em ${path}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Lista o que está divergente. Vazio = webhook saudável. */
function problemasDe(webhook: WebhookAsaas, authToken: string): string[] {
  const eventosFaltando = EVENTOS_NECESSARIOS.filter(
    (e) => !webhook.events.includes(e),
  );
  return [
    !webhook.enabled && "Está desabilitado no Asaas.",
    webhook.interrupted &&
      "Está interrompido — a fila travou depois de erros seguidos e o Asaas parou de entregar.",
    webhook.authToken !== authToken &&
      "O token cadastrado é diferente do ASAAS_WEBHOOK_TOKEN — nossa rota rejeita com 401.",
    eventosFaltando.length > 0 &&
      `Faltam eventos: ${eventosFaltando.join(", ")}.`,
  ].filter((p): p is string => Boolean(p));
}

export async function diagnosticarWebhookDaPlataforma(): Promise<DiagnosticoWebhook> {
  const { apiKey, authToken, siteUrl, sandbox } = lerAmbiente();
  const ambiente: AsaasEnvironment = sandbox ? "sandbox" : "production";

  const configuracaoFaltando = [
    !apiKey && "ASAAS_API_KEY",
    !authToken && "ASAAS_WEBHOOK_TOKEN",
    !siteUrl && "NEXT_PUBLIC_SITE_URL",
  ].filter((v): v is string => Boolean(v));

  const base = {
    configuracaoFaltando,
    erro: null,
    contaNome: null,
    contaEmail: null,
    ambiente,
    urlEsperada: siteUrl ? urlDoWebhook(siteUrl) : "",
    webhook: null,
    problemas: [],
  } satisfies DiagnosticoWebhook;

  if (configuracaoFaltando.length) return base;

  const baseUrl = baseUrlDe(ambiente);
  try {
    // Valida a credencial antes: erro aqui costuma ser ASAAS_SANDBOX invertido
    // em relação à chave, e o sintoma seria "webhook não existe".
    const conta = await req<{ name?: string; email?: string }>(
      baseUrl,
      apiKey!,
      "/myAccount",
    );
    const { data } = await req<{ data: WebhookAsaas[] }>(
      baseUrl,
      apiKey!,
      "/webhooks",
    );

    const esperada = urlDoWebhook(siteUrl!);
    const webhook = data.find((w) => w.url === esperada) ?? null;

    return {
      ...base,
      contaNome: conta.name ?? null,
      contaEmail: conta.email ?? null,
      webhook,
      problemas: webhook
        ? problemasDe(webhook, authToken!)
        : ["Não existe webhook apontando para esta URL."],
    };
  } catch (err) {
    return {
      ...base,
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Cria o webhook se faltar; se existir, corrige o que estiver divergente. */
export async function garantirWebhookDaPlataforma(): Promise<{
  acao: "criado" | "corrigido" | "nada";
  erro?: string;
}> {
  const diag = await diagnosticarWebhookDaPlataforma();

  if (diag.configuracaoFaltando.length) {
    return {
      acao: "nada",
      erro: `Faltam variáveis: ${diag.configuracaoFaltando.join(", ")}.`,
    };
  }
  if (diag.erro) return { acao: "nada", erro: diag.erro };
  if (!diag.problemas.length) return { acao: "nada" };

  // A URL já veio pronta no diagnóstico (diag.urlEsperada).
  const { apiKey, authToken, sandbox } = lerAmbiente();
  const baseUrl = baseUrlDe(sandbox ? "sandbox" : "production");
  const corpo = {
    name: diag.webhook?.name ?? "Fideliza.OS — plataforma",
    url: diag.urlEsperada,
    email: diag.webhook?.email || diag.contaEmail,
    enabled: true,
    interrupted: false,
    apiVersion: 3,
    authToken,
    sendType: "SEQUENTIALLY",
    events: [...new Set([...(diag.webhook?.events ?? []), ...EVENTOS_NECESSARIOS])],
  };

  try {
    if (diag.webhook) {
      await req(baseUrl, apiKey!, `/webhooks/${diag.webhook.id}`, {
        method: "PUT",
        body: JSON.stringify(corpo),
      });
      return { acao: "corrigido" };
    }
    await req(baseUrl, apiKey!, "/webhooks", {
      method: "POST",
      body: JSON.stringify(corpo),
    });
    return { acao: "criado" };
  } catch (err) {
    return { acao: "nada", erro: err instanceof Error ? err.message : String(err) };
  }
}

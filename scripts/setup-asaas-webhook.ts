/**
 * Cria (ou corrige) o webhook da conta Asaas DA PLATAFORMA — o que ativa o
 * portal do dono quando a mensalidade é paga.
 *
 * Existia um vão aqui: o webhook de cada NEGÓCIO é criado automaticamente ao
 * conectar a conta dele (lib/tenant-asaas.ts), mas o da plataforma dependia de
 * alguém lembrar de cadastrar à mão no painel do Asaas. Sem ele, assinatura só
 * ativa quando o dono abre a tela (o fallback de reconciliação).
 *
 *   ASAAS_API_KEY=... ASAAS_WEBHOOK_TOKEN=... NEXT_PUBLIC_SITE_URL=https://... \
 *     ./node_modules/.bin/tsx scripts/setup-asaas-webhook.ts
 *
 * Sem env na linha de comando, lê de .env.production.local ou .env.local.
 *
 * Idempotente: se o webhook já existe na URL certa, só conserta o que estiver
 * divergente (desabilitado, interrompido, token ou eventos errados).
 * `--dry-run` mostra o que faria sem alterar nada.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DRY_RUN = process.argv.includes("--dry-run");

const EVENTOS_NECESSARIOS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
];

function loadEnv() {
  for (const arquivo of [".env.production.local", ".env.local"]) {
    try {
      const conteudo = readFileSync(resolve(process.cwd(), arquivo), "utf8");
      for (const linha of conteudo.split("\n")) {
        const i = linha.indexOf("=");
        if (i < 0 || linha.trimStart().startsWith("#")) continue;
        const chave = linha.slice(0, i).trim();
        const valor = linha.slice(i + 1).trim().replace(/^["']|["']$/g, "");
        if (valor && !process.env[chave]) process.env[chave] = valor;
      }
    } catch {
      // arquivo não existe — segue com o que veio do ambiente
    }
  }
}

interface AsaasWebhook {
  id: string;
  name: string;
  url: string;
  email: string;
  enabled: boolean;
  interrupted: boolean;
  authToken: string | null;
  events: string[];
}

async function main() {
  loadEnv();

  const apiKey = process.env.ASAAS_API_KEY;
  const authToken = process.env.ASAAS_WEBHOOK_TOKEN;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  const sandbox = String(process.env.ASAAS_SANDBOX ?? "").toLowerCase() === "true";

  const faltando = [
    !apiKey && "ASAAS_API_KEY",
    !authToken && "ASAAS_WEBHOOK_TOKEN",
    !siteUrl && "NEXT_PUBLIC_SITE_URL",
  ].filter(Boolean);
  if (faltando.length) {
    console.error(`Faltam variáveis: ${faltando.join(", ")}`);
    process.exit(1);
  }

  const base = sandbox
    ? "https://sandbox.asaas.com/api/v3"
    : "https://api.asaas.com/v3";
  const urlDoWebhook = `${siteUrl!.replace(/\/$/, "")}/api/webhooks/asaas`;

  console.log(`Ambiente : ${sandbox ? "SANDBOX" : "PRODUÇÃO"} (${base})`);
  console.log(`Webhook  : ${urlDoWebhook}`);
  if (DRY_RUN) console.log("(dry-run — nada será alterado)\n");

  const req = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        access_token: apiKey!,
        ...init.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`Asaas ${res.status} em ${path}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  };

  // Confere a credencial antes de qualquer coisa — erro aqui costuma ser
  // ASAAS_SANDBOX invertido em relação à chave.
  const conta = await req<{ email?: string; name?: string }>("/myAccount");
  console.log(`Conta    : ${conta.name ?? "?"} <${conta.email ?? "?"}>\n`);

  const { data: webhooks } = await req<{ data: AsaasWebhook[] }>("/webhooks");
  const existente = webhooks.find((w) => w.url === urlDoWebhook);

  if (!existente) {
    console.log("Nenhum webhook apontando para essa URL. Criando…");
    if (DRY_RUN) return;
    const criado = await req<AsaasWebhook>("/webhooks", {
      method: "POST",
      body: JSON.stringify({
        name: "Fideliza.OS — plataforma",
        url: urlDoWebhook,
        email: conta.email,
        enabled: true,
        interrupted: false,
        apiVersion: 3,
        authToken,
        sendType: "SEQUENTIALLY",
        events: EVENTOS_NECESSARIOS,
      }),
    });
    console.log(`✓ Criado: ${criado.id}`);
    return;
  }

  console.log(`Webhook encontrado: ${existente.id}`);

  const eventosFaltando = EVENTOS_NECESSARIOS.filter(
    (e) => !existente.events.includes(e),
  );
  const problemas = [
    !existente.enabled && "está desabilitado",
    existente.interrupted && "está interrompido (fila travada por erro)",
    existente.authToken !== authToken && "token diferente de ASAAS_WEBHOOK_TOKEN",
    eventosFaltando.length > 0 && `sem os eventos: ${eventosFaltando.join(", ")}`,
  ].filter(Boolean);

  if (!problemas.length) {
    console.log("✓ Tudo certo — nada a corrigir.");
    return;
  }

  console.log("Problemas encontrados:");
  for (const p of problemas) console.log(`  - ${p}`);
  if (DRY_RUN) return;

  const corrigido = await req<AsaasWebhook>(`/webhooks/${existente.id}`, {
    method: "PUT",
    body: JSON.stringify({
      name: existente.name,
      url: urlDoWebhook,
      email: existente.email || conta.email,
      enabled: true,
      interrupted: false,
      apiVersion: 3,
      authToken,
      sendType: "SEQUENTIALLY",
      events: [...new Set([...existente.events, ...EVENTOS_NECESSARIOS])],
    }),
  });
  console.log(`✓ Corrigido: ${corrigido.id}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

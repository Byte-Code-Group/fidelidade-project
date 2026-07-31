/**
 * Diagnostica e conserta o webhook da conta Asaas DA PLATAFORMA — o que ativa
 * o portal do dono quando a mensalidade é paga.
 *
 * Mesma lógica do painel (Superadmin → Faturamento → Webhook do Asaas); esta é
 * a via de linha de comando, útil quando o painel ainda não está no ar.
 *
 *   ASAAS_API_KEY=... ASAAS_WEBHOOK_TOKEN=... NEXT_PUBLIC_SITE_URL=https://... \
 *     npm run asaas:webhook -- --dry-run
 *
 * Sem env na linha de comando, lê de .env.production.local ou .env.local.
 * Idempotente: cria se faltar, corrige só o que estiver divergente.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

async function main() {
  // O env precisa estar carregado antes de importar a lib, que lê process.env
  // — daí o import ser dinâmico, e não estático no topo do arquivo.
  loadEnv();
  const { diagnosticarWebhookDaPlataforma, garantirWebhookDaPlataforma } =
    await import("../lib/asaas-webhook");

  const dryRun = process.argv.includes("--dry-run");
  const diag = await diagnosticarWebhookDaPlataforma();

  console.log(`Ambiente : ${diag.ambiente}`);
  console.log(`Webhook  : ${diag.urlEsperada || "—"}`);
  console.log(`Conta    : ${diag.contaNome ?? "?"} <${diag.contaEmail ?? "?"}>\n`);

  if (diag.configuracaoFaltando.length) {
    console.error(`Faltam variáveis: ${diag.configuracaoFaltando.join(", ")}`);
    process.exit(1);
  }
  if (diag.erro) {
    console.error(`Erro ao falar com o Asaas: ${diag.erro}`);
    console.error("Normalmente é ASAAS_SANDBOX invertido em relação à chave.");
    process.exit(1);
  }

  if (!diag.problemas.length) {
    console.log("✓ Tudo certo — nada a corrigir.");
    return;
  }

  console.log("Problemas encontrados:");
  for (const p of diag.problemas) console.log(`  - ${p}`);

  if (dryRun) {
    console.log("\n(dry-run — nada foi alterado)");
    return;
  }

  const { acao, erro } = await garantirWebhookDaPlataforma();
  if (erro) {
    console.error(`\nFalhou: ${erro}`);
    process.exit(1);
  }
  console.log(`\n✓ Webhook ${acao}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

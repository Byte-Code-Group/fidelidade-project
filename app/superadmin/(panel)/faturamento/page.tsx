import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { diagnosticarWebhookDaPlataforma } from "@/lib/asaas-webhook";
import { repararWebhookDaPlataforma } from "@/app/superadmin/actions";

const PLAN_PRICES: Record<string, number> = {
  starter: 97,
  pro: 297,
  premium: 697,
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando pagamento",
  active: "Ativo",
  suspended: "Suspenso",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/25 dark:text-blue-400",
  active: "bg-green-100 text-green-700 dark:bg-green-900/25 dark:text-green-400",
  suspended: "bg-red-100 text-red-600 dark:bg-red-900/25 dark:text-red-400",
};

export default async function FaturamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { error, ok } = await searchParams;
  const diagnostico = await diagnosticarWebhookDaPlataforma();
  const db = createAdminClient();
  const { data: tenants } = await db
    .from("tenants")
    .select("id, name, saas_plan, status, owner_email, asaas_subscription_id, created_at")
    .order("created_at", { ascending: false });

  const rows = tenants ?? [];
  const webhookSaudavel =
    !diagnostico.configuracaoFaltando.length &&
    !diagnostico.erro &&
    !diagnostico.problemas.length;
  const activeRows = rows.filter((t) => t.status === "active");
  const mrr = activeRows.reduce(
    (sum, t) => sum + (PLAN_PRICES[t.saas_plan] ?? 0),
    0,
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Faturamento"
        subtitle="Receita recorrente e assinaturas por empresa."
      />

      {/* MRR cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <p className="text-xs opacity-50 uppercase tracking-wider">MRR</p>
            <p className="mt-1 text-2xl font-semibold">
              {mrr.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-xs opacity-50">{activeRows.length} ativo(s)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs opacity-50 uppercase tracking-wider">ARR (projeção)</p>
            <p className="mt-1 text-2xl font-semibold">
              {(mrr * 12).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
            <p className="text-xs opacity-50">MRR × 12</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs opacity-50 uppercase tracking-wider">Total de empresas</p>
            <p className="mt-1 text-2xl font-semibold">{rows.length}</p>
            <p className="text-xs opacity-50">
              {rows.filter((t) => t.status === "pending").length} aguardando pagamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Saúde do webhook da plataforma — quando ele não entrega, assinatura
          paga só ativa quando o dono abre a tela (fallback de reconciliação). */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Webhook do Asaas</h2>
              <p className="text-xs opacity-50">
                É o que ativa o portal do dono assim que a mensalidade é paga.
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                webhookSaudavel
                  ? "bg-green-100 text-green-700 dark:bg-green-900/25 dark:text-green-400"
                  : "bg-red-100 text-red-600 dark:bg-red-900/25 dark:text-red-400"
              }`}
            >
              {webhookSaudavel ? "Ativo" : "Precisa de atenção"}
            </span>
          </div>

          {ok && <p className="text-sm text-green-600 dark:text-green-400">{ok}</p>}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <dl className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="opacity-50">Ambiente:</dt>
              <dd>{diagnostico.ambiente}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="opacity-50">Conta:</dt>
              <dd>{diagnostico.contaNome ?? "—"}</dd>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <dt className="opacity-50">URL:</dt>
              <dd className="truncate">{diagnostico.urlEsperada || "—"}</dd>
            </div>
          </dl>

          {diagnostico.configuracaoFaltando.length > 0 && (
            <p className="text-sm text-red-600 dark:text-red-400">
              Faltam variáveis de ambiente:{" "}
              {diagnostico.configuracaoFaltando.join(", ")}.
            </p>
          )}

          {diagnostico.erro && (
            <div className="text-sm text-red-600 dark:text-red-400">
              <p>Não consegui falar com o Asaas:</p>
              <p className="mt-1 break-words font-mono text-xs opacity-80">
                {diagnostico.erro}
              </p>
              <p className="mt-1 text-xs opacity-70">
                Normalmente é ASAAS_SANDBOX invertido em relação à chave usada.
              </p>
            </div>
          )}

          {diagnostico.problemas.length > 0 && (
            <ul className="list-inside list-disc text-sm text-red-600 dark:text-red-400">
              {diagnostico.problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          {!webhookSaudavel && !diagnostico.configuracaoFaltando.length && !diagnostico.erro && (
            <form action={repararWebhookDaPlataforma}>
              <Button type="submit" pendingLabel="Configurando…">
                {diagnostico.webhook ? "Corrigir webhook" : "Criar webhook"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Tabela de tenants */}
      <Card>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left opacity-50">
                <th className="pb-2 font-medium">Empresa</th>
                <th className="pb-2 font-medium">Plano</th>
                <th className="pb-2 font-medium">Valor</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Asaas</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="py-3">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs opacity-50">{t.owner_email ?? "—"}</p>
                  </td>
                  <td className="py-3 capitalize">{t.saas_plan}</td>
                  <td className="py-3">
                    {t.status === "active"
                      ? (PLAN_PRICES[t.saas_plan] ?? 0).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        }) + "/mês"
                      : "—"}
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLOR[t.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="py-3 text-xs opacity-50">
                    {t.asaas_subscription_id ? "✓ assinatura" : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center opacity-40">
                    Nenhuma empresa cadastrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

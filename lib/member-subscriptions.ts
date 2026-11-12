import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCredenciais } from "@/lib/tenant-asaas";
import {
  AsaasError,
  isDominioRecusado,
  cancelSubscriptionNaConta,
  createCustomerNaConta,
  createSubscriptionNaConta,
  getSubscriptionFirstPaymentNaConta,
  getSubscriptionPaymentsNaConta,
  PAID_PAYMENT_STATUSES,
} from "@/lib/asaas";
import type { AsaasConta } from "@/lib/asaas";

// Assinatura paga do CLIENTE FINAL num plano do negócio (business_plans),
// cobrada na conta Asaas do próprio negócio (ver lib/tenant-asaas.ts).
//
// Negócio sem conta conectada ou plano de preço zero continuam no fluxo
// antigo: troca de plano na carteirinha, sem cobrança (ver
// changeMembershipPlan em lib/memberships.ts).

export type ResultadoAssinatura =
  | { tipo: "sem_cobranca" }
  | { tipo: "cobranca"; invoiceUrl: string }
  | { tipo: "erro"; error: string };

interface MembershipRow {
  id: string;
  plan_id: string | null;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  asaas_invoice_url: string | null;
  subscription_status: string | null;
}

/** CPF/CNPJ do cliente vindo dos campos de cadastro configuráveis do tenant. */
async function cpfDoCliente(tenantId: string, userId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data: campos } = await db
    .from("profile_fields")
    .select("id, field_type")
    .eq("tenant_id", tenantId)
    .in("field_type", ["cpf"])
    .returns<{ id: string; field_type: string }[]>();

  if (!campos?.length) return null;

  const { data: valores } = await db
    .from("profile_field_values")
    .select("value")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .in(
      "field_id",
      campos.map((c) => c.id),
    )
    .returns<{ value: string | null }[]>();

  const bruto = valores?.map((v) => v.value).find((v) => v && v.replace(/\D/g, "").length >= 11);
  return bruto ? bruto.replace(/\D/g, "") : null;
}

/**
 * Cria (ou troca) a assinatura paga do cliente no plano escolhido.
 * Devolve o link da fatura pra mandar o cliente pagar.
 */
export async function assinarPlanoComCobranca(
  tenantId: string,
  userId: string,
  planId: string,
  { siteUrl }: { siteUrl?: string } = {},
): Promise<ResultadoAssinatura> {
  const db = createAdminClient();

  const [{ data: plano }, { data: membership }, { data: perfil }] = await Promise.all([
    db
      .from("business_plans")
      .select("id, name, price_month")
      .eq("id", planId)
      .eq("tenant_id", tenantId)
      .maybeSingle<{ id: string; name: string; price_month: number }>(),
    db
      .from("memberships")
      .select(
        "id, plan_id, asaas_customer_id, asaas_subscription_id, asaas_invoice_url, subscription_status",
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<MembershipRow>(),
    db
      .from("users")
      .select("full_name, email")
      .eq("id", userId)
      .maybeSingle<{ full_name: string | null; email: string | null }>(),
  ]);

  if (!plano) return { tipo: "erro", error: "Plano não encontrado." };
  if (!membership) return { tipo: "erro", error: "Carteirinha não encontrada." };
  if (Number(plano.price_month) <= 0) return { tipo: "sem_cobranca" };

  const conta = await getCredenciais(tenantId);
  if (!conta) return { tipo: "sem_cobranca" };

  // Já tem cobrança em aberto deste mesmo plano: manda pra ELA em vez de
  // criar outra. Sem isso, cada clique em "Assinar" gerava uma assinatura
  // nova e o cliente que já tinha pago caía num loop de faturas.
  if (
    membership.plan_id === planId &&
    membership.subscription_status === "pending" &&
    membership.asaas_invoice_url
  ) {
    return { tipo: "cobranca", invoiceUrl: membership.asaas_invoice_url };
  }

  const cpf = await cpfDoCliente(tenantId, userId);
  if (!cpf) {
    return {
      tipo: "erro",
      error: "Preencha seu CPF no perfil antes de assinar — o pagamento exige esse dado.",
    };
  }

  // Trocar de plano encerra a assinatura anterior: o Asaas não muda o valor
  // de uma assinatura já emitida sem mexer nas cobranças pendentes.
  if (membership.asaas_subscription_id) {
    try {
      await cancelSubscriptionNaConta(conta, membership.asaas_subscription_id);
    } catch {
      // Assinatura já cancelada/removida no Asaas — segue e cria a nova.
    }
  }

  let customerId = membership.asaas_customer_id;
  try {
    if (!customerId) {
      const customer = await createCustomerNaConta(conta, {
        name: perfil?.full_name ?? "Cliente",
        email: perfil?.email ?? undefined,
        cpfCnpj: cpf,
      });
      customerId = customer.id;
    }

    const dadosDaAssinatura = {
      customer: customerId,
      // Só cartão de crédito: assinatura recorrente cobrada sozinha todo mês.
      // Boleto/pix exigiriam o cliente pagar manualmente a cada ciclo.
      billingType: "CREDIT_CARD" as const,
      value: Number(plano.price_month),
      description: `Plano ${plano.name}`,
      externalReference: membership.id,
    };

    // O callback de retorno só é aceito por conta Asaas que tenha um site
    // cadastrado em Minha Conta → Informações. Sem isso o Asaas recusa a
    // assinatura inteira ("Não há nenhum domínio configurado"), então a
    // segunda tentativa vai sem ele: o cliente paga e volta pelo portal.
    const assinatura = await (async () => {
      try {
        const criada = await createSubscriptionNaConta(conta, {
          ...dadosDaAssinatura,
          successUrl: siteUrl ? `${siteUrl}/planos` : undefined,
        });
        await marcarCallbackBloqueado(tenantId, false);
        return criada;
      } catch (err) {
        if (isDominioRecusado(err)) {
          // Fica registrado pro painel cobrar o dono a cadastrar o site.
          await marcarCallbackBloqueado(tenantId, true);
          return createSubscriptionNaConta(conta, dadosDaAssinatura);
        }
        throw err;
      }
    })();

    const cobranca = await primeiraCobranca(conta, assinatura.id);

    await db
      .from("memberships")
      .update({
        plan_id: planId,
        pending_plan_id: null,
        pending_plan_effective_at: null,
        asaas_customer_id: customerId,
        asaas_subscription_id: assinatura.id,
        asaas_invoice_url: cobranca?.invoiceUrl ?? null,
        subscription_status: "pending",
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", membership.id);

    if (!cobranca?.invoiceUrl) {
      return {
        tipo: "erro",
        error: "Assinatura criada, mas o link de pagamento ainda não ficou pronto. Recarregue em instantes.",
      };
    }
    return { tipo: "cobranca", invoiceUrl: cobranca.invoiceUrl };
  } catch (err) {
    console.error("[assinarPlanoComCobranca]", {
      tenantId,
      planId,
      erro: err instanceof Error ? err.message : err,
    });
    // A descrição do Asaas é escrita pra usuário final ("O CPF informado é
    // inválido") — muito mais útil que uma mensagem genérica nossa.
    const descricao = err instanceof AsaasError ? err.descricao : null;
    return {
      tipo: "erro",
      error: descricao
        ? `${descricao} (retorno do Asaas)`
        : "Não consegui gerar a cobrança agora. Tente de novo ou fale com a equipe.",
    };
  }
}

// A cobrança do 1º ciclo é criada logo depois da assinatura, mas nem sempre
// já está lá na resposta imediata.
async function primeiraCobranca(conta: AsaasConta, subscriptionId: string) {
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const cobranca = await getSubscriptionFirstPaymentNaConta(conta, subscriptionId);
    if (cobranca?.invoiceUrl) return cobranca;
    await new Promise((r) => setTimeout(r, 600));
  }
  return null;
}

// Fallback do webhook do negócio (app/api/webhooks/asaas/tenant/[tenantId]).
// Ele é a fonte primária, mas depende do webhook estar criado e de o Asaas
// entregar o evento — quando falha, o cliente pagava e ficava "pending" pra
// sempre. Chamada quando o portal abre a tela de planos.
export async function sincronizarAssinaturaDoCliente(
  tenantId: string,
  userId: string,
): Promise<void> {
  const db = createAdminClient();
  const { data: membership } = await db
    .from("memberships")
    .select("id, asaas_subscription_id, subscription_status")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Pick<MembershipRow, "id" | "asaas_subscription_id" | "subscription_status">>();

  if (!membership?.asaas_subscription_id) return;
  if (membership.subscription_status === "active") return;

  const conta = await getCredenciais(tenantId);
  if (!conta) return;

  try {
    const cobrancas = await getSubscriptionPaymentsNaConta(
      conta,
      membership.asaas_subscription_id,
    );
    if (!cobrancas.some((c) => PAID_PAYMENT_STATUSES.has(c.status))) return;

    await db
      .from("memberships")
      .update({
        subscription_status: "active",
        asaas_invoice_url: null,
        subscription_updated_at: new Date().toISOString(),
      })
      .eq("id", membership.id);
  } catch (err) {
    console.error("[sincronizarAssinaturaDoCliente]", {
      tenantId,
      membershipId: membership.id,
      erro: err instanceof Error ? err.message : err,
    });
  }
}

/** Cancela a cobrança recorrente do cliente (ele deixa de ser cobrado). */
export async function cancelarAssinaturaDoCliente(
  tenantId: string,
  membershipId: string,
): Promise<{ error?: string }> {
  const db = createAdminClient();
  const { data: membership } = await db
    .from("memberships")
    .select("id, asaas_subscription_id")
    .eq("tenant_id", tenantId)
    .eq("id", membershipId)
    .maybeSingle<{ id: string; asaas_subscription_id: string | null }>();

  if (!membership?.asaas_subscription_id) return {};

  const conta = await getCredenciais(tenantId);
  if (conta) {
    try {
      await cancelSubscriptionNaConta(conta, membership.asaas_subscription_id);
    } catch {
      // Já cancelada lá — o estado local abaixo é o que vale pra nós.
    }
  }

  await db
    .from("memberships")
    .update({
      asaas_subscription_id: null,
      asaas_invoice_url: null,
      subscription_status: "canceled",
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("id", membership.id);
  return {};
}

async function marcarCallbackBloqueado(tenantId: string, bloqueado: boolean) {
  const db = createAdminClient();
  await db
    .from("tenant_payment_accounts")
    .update({ callback_bloqueado: bloqueado })
    .eq("tenant_id", tenantId);
}
